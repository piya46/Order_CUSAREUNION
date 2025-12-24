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

    const receiving = new Receiving(req.body);
    receiving.receivingNumber = generateReceivingNumber();
    
    // 2. บันทึกใบรับของ (Save Receiving Doc)
    await receiving.save({ session });

    // 3. วนลูปสินค้าที่รับมา
    if (receiving.items && receiving.items.length > 0) {
      for (const item of receiving.items) {
        if (item.quantity > 0) {
          // --- 3.1 อัปเดต Stock สินค้า (Inventory) ---
          const query = item.variantId 
            ? { _id: item.product, "variants._id": item.variantId }
            : { _id: item.product, "variants.size": item.size, "variants.color": item.color };

          const update = { $inc: { "variants.$.stock": item.quantity } };

          const updatedProduct = await Product.findOneAndUpdate(query, update, { new: true, session });
          
          if (!updatedProduct) {
             throw new Error(`ไม่พบสินค้าหรือตัวเลือกสินค้า (Product ID: ${item.product}) - กรุณาตรวจสอบข้อมูลสินค้า`);
          }

          // --- 3.2 อัปเดตยอดรับของใน PO (Update PO Item receivedQuantity) ---
          if (po) {
            // หา Item ใน PO ที่ตรงกับ Item ที่รับเข้ามา (เทียบ Product + Size + Color)
            const poItem = po.items.find(pi => 
                pi.product.toString() === item.product.toString() &&
                (pi.size || '') === (item.size || '') &&
                (pi.color || '') === (item.color || '')
            );

            if (poItem) {
                // บวกยอดรับเพิ่มเข้าไป
                poItem.receivedQuantity = (poItem.receivedQuantity || 0) + item.quantity;
            }
          }
        }
      }
    }

    // 4. อัปเดตสถานะ PO (Update PO Status Logic)
    if (po) {
        // เช็คว่ารับครบทุกรายการหรือยัง?
        const isAllReceived = po.items.every(item => (item.receivedQuantity || 0) >= item.quantity);
        const isSomeReceived = po.items.some(item => (item.receivedQuantity || 0) > 0);

        let newStatus = po.status;

        if (isAllReceived) {
            newStatus = 'RECEIVED'; // รับครบแล้ว
        } else if (isSomeReceived) {
            newStatus = 'PARTIAL'; // รับบางส่วน
        }

        po.status = newStatus;
        await po.save({ session }); // บันทึก PO ที่อัปเดตยอดและสถานะแล้ว
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
    const receiving = await Receiving.findById(req.params.id).populate('items.product');
    if (!receiving) return res.status(404).json({ error: 'Receiving not found' });

    await auditLogService.log({
      user: req.user?.id,
      action: 'RECEIVING_EXPORT',
      detail: { receivingId: receiving._id, type: req.query.type || 'unknown' },
      ip: req.ip
    });

    if (req.query.type === 'pdf') {
      exportService.exportReceivingToPDF(receiving, res);
    } else if (req.query.type === 'excel') {
      await exportService.exportReceivingToExcel(receiving, res);
    } else {
      res.status(400).json({ error: 'Unknown export type' });
    }
  } catch (err) { next(err); }
};