const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  issueNumber: { type: String, unique: true },
  refType: { type: String, enum: ['ORDER', 'RECEIVING', 'PRODUCT'] },
  refId: String,
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: String,
  evidenceUrls: [String],
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  adminComment: String,
  status: { type: String, enum: ['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED', 'CLOSED'], default: 'OPEN' }
}, { timestamps: true });

module.exports = mongoose.model('Issue', issueSchema);