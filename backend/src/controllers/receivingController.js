const mongoose = require('mongoose');
const Receiving = require('../models/Receiving');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const { generateReceivingNumber } = require('../utils/generate');
const exportService = require('../services/exportService');
const auditLogService = require('../services/auditLogService');

exports.create = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Validate PO & Fetch PO Data
    let po = null;
    if (req.body.po) {
      po = await PurchaseOrder.findById(req.body.po).session(session);
      if (!po) {
        throw new Error(`ไม่พบใบสั่งซื้อ (PO) ที่ระบุ: ${req.body.po}`);
      }
    }

    // --- เพิ่ม Logic: รวมรายการสินค้าซ้ำ (Merge Duplicates) ---
    // ป้องกันปัญหา Product เดิมมาหลายบรรทัด
    if (req.body.items && req.body.items.length > 0) {
        const mergedItems = new Map();

        req.body.items.forEach(item => {
            // สร้าง Key สำหรับเช็คซ้ำ (ใช้ variantId หรือ size+color)
            const key = item.variantId 
                ? `${item.product}-${item.variantId}` 
                : `${item.product}-${item.size}-${item.color}`;

            if (mergedItems.has(key)) {
                // ถ้ารายการซ้ำ ให้บวกจำนวนเพิ่ม
                const existingItem = mergedItems.get(key);
                existingItem.quantity = (existingItem.quantity || 0) + (item.quantity || 0);
            } else {
                // ถ้ายังไม่มี ให้เพิ่มเข้าไปใหม่
                mergedItems.set(key, { ...item });
            }
        });

        // แปลงกลับเป็น Array
        req.body.items = Array.from(mergedItems.values());
    }
    // ----------------------------------------------------

    const receiving = new Receiving(req.body);
    receiving.receivingNumber = generateReceivingNumber();
    
    // 2. บันทึกใบรับของ (Save Receiving Doc)
    // ตอนนี้ item จะมี variantId ครบแล้ว เพราะแก้ Schema แล้ว
    await receiving.save({ session });

    // 3. วนลูปสินค้าที่รับมา
    if (receiving.items && receiving.items.length > 0) {
      for (const item of receiving.items) {
        if (item.quantity > 0) {
          // --- 3.1 อัปเดต Stock สินค้า (Inventory) ---
          // ตรวจสอบว่ามี variantId หรือไม่ (แปลงเป็น String เพื่อความชัวร์ในการเทียบ)
          const targetVariantId = item.variantId ? item.variantId.toString() : null;

          const query = targetVariantId
            ? { _id: item.product, "variants._id": targetVariantId }
            : { _id: item.product, "variants.size": item.size, "variants.color": item.color };

          const update = { $inc: { "variants.$.stock": item.quantity } };

          const updatedProduct = await Product.findOneAndUpdate(query, update, { new: true, session });
          
          if (!updatedProduct) {
             // เพิ่มรายละเอียด Error ให้ชัดเจนขึ้น
             throw new Error(`ไม่พบสินค้าหรือตัวเลือกสินค้า (Product ID: ${item.product}, Variant: ${targetVariantId || 'size/color'}) - กรุณาตรวจสอบข้อมูลสินค้า`);
          }

          // --- 3.2 อัปเดตยอดรับของใน PO (Update PO Item receivedQuantity) ---
          if (po) {
            // หา Item ใน PO ที่ตรงกับ Item ที่รับเข้ามา
            const poItem = po.items.find(pi => {
                const isSameProduct = pi.product.toString() === item.product.toString();
                // เช็ค Variant: ถ้ามี variantId ให้เทียบ ID, ถ้าไม่มีให้เทียบ size/color
                const isSameVariant = targetVariantId 
                    ? (pi.variantId && pi.variantId.toString() === targetVariantId) // ถ้า PO เก็บ variantId
                      || ( // Fallback กรณี PO เก่าไม่มี variantId เช็ค size/color
                          (pi.size || '') === (item.size || '') && 
                          (pi.color || '') === (item.color || '')
                      )
                    : (pi.size || '') === (item.size || '') && (pi.color || '') === (item.color || '');
                
                return isSameProduct && isSameVariant;
            });

            if (poItem) {
                poItem.receivedQuantity = (poItem.receivedQuantity || 0) + item.quantity;
            }
          }
        }
      }
    }

    // 4. อัปเดตสถานะ PO (Update PO Status Logic)
    if (po) {
        const isAllReceived = po.items.every(item => (item.receivedQuantity || 0) >= item.quantity);
        const isSomeReceived = po.items.some(item => (item.receivedQuantity || 0) > 0);

        let newStatus = po.status;

        if (isAllReceived) {
            newStatus = 'RECEIVED'; 
        } else if (isSomeReceived) {
            newStatus = 'PARTIAL'; 
        }

        po.status = newStatus;
        await po.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // 5. Audit Log
    await auditLogService.log({
      user: req.user?.id,
      action: 'RECEIVING_CREATE',
      detail: { receivingId: receiving._id, receivingNumber: receiving.receivingNumber },
      ip: req.ip
    });

    res.status(201).json(receiving);
  } catch (err) { 
    await session.abortTransaction();
    session.endSession();
    next(err); 
  }
};

// ... (ส่วน getAll, getOne, update, delete, exportReceiving คงเดิมได้ครับ)
exports.getAll = async (req, res, next) => {
    try {
      const receivings = await Receiving.find()
        .populate('items.product', 'name productCode images')
        .populate('po', 'poNumber supplierName')
        .sort({ createdAt: -1 });
  
      await auditLogService.log({
        user: req.user?.id,
        action: 'RECEIVING_LIST_VIEW',
        detail: { count: receivings.length },
        ip: req.ip
      });
  
      res.json(receivings);
    } catch (err) { next(err); }
  };
  
  exports.getOne = async (req, res, next) => {
    try {
      const receiving = await Receiving.findById(req.params.id)
        .populate('items.product')
        .populate('po');
  
      if (!receiving) return res.status(404).json({ error: 'Receiving not found' });
  
      await auditLogService.log({
        user: req.user?.id,
        action: 'RECEIVING_DETAIL_VIEW',
        detail: { receivingId: receiving._id },
        ip: req.ip
      });
  
      res.json(receiving);
    } catch (err) { next(err); }
  };
  
  exports.update = async (req, res, next) => {
    try {
      const before = await Receiving.findById(req.params.id).lean();
      const receiving = await Receiving.findByIdAndUpdate(req.params.id, req.body, { new: true });
  
      await auditLogService.log({
        user: req.user?.id,
        action: 'RECEIVING_UPDATE',
        detail: { receivingId: req.params.id, patch: Object.keys(req.body||{}), before, after: receiving },
        ip: req.ip
      });
  
      res.json(receiving);
    } catch (err) { next(err); }
  };
  
  exports.delete = async (req, res, next) => {
    try {
      const before = await Receiving.findById(req.params.id).lean();
      await Receiving.findByIdAndDelete(req.params.id);
  
      await auditLogService.log({
        user: req.user?.id,
        action: 'RECEIVING_DELETE',
        detail: { receivingId: req.params.id, before },
        ip: req.ip
      });
  
      res.json({ success: true });
    } catch (err) { next(err); }
  };
  
exports.exportReceiving = async (req, res, next) => {
  try {
    // ✅ แบบที่ถูกต้อง (ต้องเพิ่ม populate 'po')
    const receiving = await Receiving.findById(req.params.id)
      .populate('items.product')
      .populate('po'); // <--- เพิ่มบรรทัดนี้ครับ หัวใจสำคัญ!

    if (!receiving) return res.status(404).json({ error: 'Receiving not found' });

    // ... (ส่วน log และเรียก service export) ...
    
    if (req.query.type === 'pdf') {
      exportService.exportReceivingToPDF(receiving, res);
    } else {
      await exportService.exportReceivingToExcel(receiving, res);
    }

  } catch (err) { next(err); }
};