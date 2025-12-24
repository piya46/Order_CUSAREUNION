const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: { type: String, required: true },
  description: String,
  permissions: [String]
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
