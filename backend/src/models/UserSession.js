// models/UserSession.js
const mongoose = require('mongoose');
const userSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: String, required: true }, // เช่น uuid
  deviceInfo: { type: String }, // optional: OS/Browser
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserSession', userSessionSchema);
