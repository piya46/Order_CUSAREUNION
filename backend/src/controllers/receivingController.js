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
    // 1. Validate PO (ถ้ามีการอ้างอิง)
    if (req.body.po) {
      const poExists = await PurchaseOrder.findById(req.body.po).session(session);
      if (!poExists) {
        throw new Error(`ไม่พบใบสั่งซื้อ (PO) ที่ระบุ: ${req.body.po}`);
      }
    }

    const receiving = new Receiving(req.body);
    receiving.receivingNumber = generateReceivingNumber();
    
    // 2. บันทึกใบรับของ (Save Receiving Doc)
    await receiving.save({ session });

    // 3. วนลูปอัปเดต Stock สินค้า (Update Inventory)
    if (receiving.items && receiving.items.length > 0) {
      for (const item of receiving.items) {
        if (item.quantity > 0) {
          // Query เจาะจง Variant เพื่อความแม่นยำ
          // ถ้า frontend ส่ง variantId มาให้ใช้ variantId, ถ้าไม่ ให้ใช้ size/color
          const query = item.variantId 
            ? { _id: item.product, "variants._id": item.variantId }
            : { _id: item.product, "variants.size": item.size, "variants.color": item.color };

          const update = { $inc: { "variants.$.stock": item.quantity } };

          const updatedProduct = await Product.findOneAndUpdate(query, update, { new: true, session });
          
          if (!updatedProduct) {
             // ถ้าหาไม่เจอ ให้ throw error เพื่อ rollback transaction ทั้งหมดป้องกันข้อมูล Stock เพี้ยน
             throw new Error(`ไม่พบสินค้าหรือตัวเลือกสินค้า (Product ID: ${item.product}) - กรุณาตรวจสอบข้อมูลสินค้า`);
          }
        }
      }
    }

    // 4. อัปเดตสถานะ PO (Update PO Status)
    if (receiving.po) {
        // เบื้องต้นปรับเป็น RECEIVED (รับแล้ว) 
        // *อนาคตสามารถเพิ่ม Logic เช็คจำนวนรับ vs จำนวนสั่ง เพื่อปรับเป็น PARTIAL ได้
        await PurchaseOrder.findByIdAndUpdate(
            receiving.po, 
            { status: 'RECEIVED' }, 
            { session }
        );
    }

    await session.commitTransaction();
    session.endSession();

    // 5. Audit Log (บันทึกหลัง Transaction สำเร็จ)
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
    // Populate ข้อมูลสินค้าเบื้องต้นเพื่อให้ Frontend แสดงชื่อได้เลย ไม่ต้องยิง API ซ้ำ
    const receivings = await Receiving.find()
      .populate('items.product', 'name productCode images')
      .populate('po', 'poNumber supplierName') // Populate PO info
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
    // การแก้ไขใบรับของอาจกระทบ Stock ควรระวัง (ในที่นี้ update แค่ field ทั่วไปก่อน)
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
    // การลบใบรับของ ต้องพิจารณาว่าจะ Rollback Stock ไหม? 
    // ในที่นี้ลบเอกสารอย่างเดียว (Soft logic) หรือถ้าจะ Rollback ต้องเขียน Transaction เหมือนตอน Create
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