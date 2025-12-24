const AuditLog = require('../models/AuditLog');

module.exports = (action) => async (req, res, next) => {
  try {
    await AuditLog.create({
      user: req.user?.id || null,
      action,
      ip: req.ip,
      detail: req.body,
      date: new Date()
    });
    next();
  } catch (err) {
    next(); // ไม่ขัด flow หลัก
  }
};
