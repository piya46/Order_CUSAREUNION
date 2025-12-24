const AuditLog = require('../models/AuditLog');

exports.getAll = async (req, res, next) => {
  try {
    const logs = await AuditLog.find().populate('user');
    res.json(logs);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id).populate('user');
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.json(log);
  } catch (err) { next(err); }
};
