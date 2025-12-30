// backend/src/models/UserSession.js
const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  sessionId: { 
    type: String, 
    required: true, 
    unique: true // เพิ่ม unique index เพื่อความเร็วและความถูกต้อง
  }, 
  deviceInfo: { type: String }, 
  ipAddress: { type: String }, // เก็บ IP เพื่อตรวจสอบความปลอดภัย
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

userSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 43200 });

module.exports = mongoose.model('UserSession', userSessionSchema);