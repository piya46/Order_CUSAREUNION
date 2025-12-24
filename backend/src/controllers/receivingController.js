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
    const receiving = new Receiving(req.body);
    receiving.receivingNumber = generateReceivingNumber();
    
    // 1. บันทึกใบรับของ
    await receiving.save({ session });

    // 2. วนลูปอัปเดตสต็อกสินค้าทีละรายการ
    // เช็คว่ามี items ส่งมาหรือไม่
    if (receiving.items && receiving.items.length > 0) {
      for (const item of receiving.items) {
        if (item.quantity > 0) {
          // ค้นหาและอัปเดตสต็อกสินค้า
          // ใช้ arrayFilters เพื่อเจาะจง variant ที่ถูกต้อง หรือถ้าไม่มี variant ก็ข้ามไป
          // หมายเหตุ: กรณีนี้สมมติว่า Frontend ส่ง variantId มา หรือถ้าใช้ size/color ต้องปรับ query ให้ตรง
          
          const query = item.variantId 
            ? { _id: item.product, "variants._id": item.variantId }
            : { _id: item.product, "variants.size": item.size, "variants.color": item.color };

          const update = { $inc: { "variants.$.stock": item.quantity } };

          const updatedProduct = await Product.findOneAndUpdate(query, update, { new: true, session });
          
          if (!updatedProduct) {
             // ถ้าหาไม่เจอ อาจเป็นเพราะข้อมูลสินค้าไม่ตรง หรือถูกลบไปแล้ว
             // ใน transaction ควร throw error เพื่อ rollback ทั้งหมด
             throw new Error(`ไม่พบสินค้าหรือตัวเลือกสินค้า (Product ID: ${item.product})`);
          }
        }
      }
    }

    // 3. อัปเดตสถานะ PO (ถ้ามีการอ้างอิง)
    if (receiving.po) {
        // อัปเดตสถานะ PO เป็น RECEIVED
        await PurchaseOrder.findByIdAndUpdate(
            receiving.po, 
            { status: 'RECEIVED' }, 
            { session }
        );
    }

    await session.commitTransaction();
    session.endSession();

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
    const receivings = await Receiving.find();

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
    const receiving = await Receiving.findById(req.params.id);
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
    const receiving = await Receiving.findById(req.params.id);
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