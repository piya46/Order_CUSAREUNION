const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: { type: String, required: true },
  name: String,
  email: String,
  phone: String,
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  lineUserId: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
