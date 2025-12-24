const PurchaseOrder = require('../models/PurchaseOrder');
const { generatePONumber } = require('../utils/generate');
const exportService = require('../services/exportService');
const auditLogService = require('../services/auditLogService');

exports.create = async (req, res, next) => {
  try {
    const po = new PurchaseOrder(req.body);
    po.poNumber = generatePONumber();
    await po.save();

    await auditLogService.log({
      user: req.user?.id,
      action: 'PO_CREATE',
      detail: { poId: po._id, poNumber: po.poNumber },
      ip: req.ip
    });

    res.status(201).json(po);
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    // ✅ แก้ไข: เพิ่ม populate เพื่อดึงรายละเอียดสินค้า (ชื่อ, รหัส, ฯลฯ) ไปแสดงผล
    const pos = await PurchaseOrder.find()
      .populate('items.product') 
      .sort({ createdAt: -1 });

    await auditLogService.log({
      user: req.user?.id,
      action: 'PO_LIST_VIEW',
      detail: { count: pos.length },
      ip: req.ip
    });

    res.json(pos);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    // ✅ แก้ไข: เพิ่ม populate ตรงนี้ด้วย
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('items.product');
      
    if (!po) return res.status(404).json({ error: 'PO not found' });

    await auditLogService.log({
      user: req.user?.id,
      action: 'PO_DETAIL_VIEW',
      detail: { poId: po._id, poNumber: po.poNumber },
      ip: req.ip
    });

    res.json(po);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const before = await PurchaseOrder.findById(req.params.id).lean();
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });

    await auditLogService.log({
      user: req.user?.id,
      action: 'PO_UPDATE',
      detail: { poId: req.params.id, patch: Object.keys(req.body||{}), before, after: po },
      ip: req.ip
    });

    res.json(po);
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const before = await PurchaseOrder.findById(req.params.id).lean();
    await PurchaseOrder.findByIdAndDelete(req.params.id);

    await auditLogService.log({
      user: req.user?.id,
      action: 'PO_DELETE',
      detail: { poId: req.params.id, before },
      ip: req.ip
    });

    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.exportPO = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('items.product');
    if (!po) return res.status(404).json({ error: 'PO not found' });

    await auditLogService.log({
      user: req.user?.id,
      action: 'PO_EXPORT',
      detail: { poId: po._id, type: req.query.type || 'unknown' },
      ip: req.ip
    });

    if (req.query.type === 'pdf') {
      exportService.exportPOtoPDF(po, res);
    } else if (req.query.type === 'excel') {
      await exportService.exportPOtoExcel(po, res);
    } else {
      res.status(400).json({ error: 'Unknown export type' });
    }
  } catch (err) { next(err); }
};