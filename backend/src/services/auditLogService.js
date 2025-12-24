const AuditLog = require('../models/AuditLog');

exports.log = async ({ user, action, detail, ip }) => {
  try {
    await AuditLog.create({
      user: user?._id || null,
      action,
      detail,
      ip,
      date: new Date()
    });
  } catch (err) {
    // ถ้าบันทึก log error ให้ console.log ไว้ แต่ไม่ throw ขึ้นไป (กัน flow หลักพัง)
    console.error('AuditLog Error:', err);
  }
};
