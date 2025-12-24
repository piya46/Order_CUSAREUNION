const Receiving = require('../models/Receiving');
const { generateReceivingNumber } = require('../utils/generate');
const exportService = require('../services/exportService');
const auditLogService = require('../services/auditLogService'); // ✅ เพิ่ม

exports.create = async (req, res, next) => {
  try {
    const receiving = new Receiving(req.body);
    receiving.receivingNumber = generateReceivingNumber();
    await receiving.save();

    await auditLogService.log({
      user: req.user?.id,
      action: 'RECEIVING_CREATE',
      detail: { receivingId: receiving._id, receivingNumber: receiving.receivingNumber },
      ip: req.ip
    });

    res.status(201).json(receiving);
  } catch (err) { next(err); }
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