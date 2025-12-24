const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  detail: Object,
  ip: String
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
