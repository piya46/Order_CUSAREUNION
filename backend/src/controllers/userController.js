// backend/src/controllers/userController.js
const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const auditLogService = require('../services/auditLogService');
const { v4: uuidv4 } = require('uuid');
const UserSession = require('../models/UserSession');

const ADMIN_AUD = process.env.ADMIN_JWT_AUD || 'admin-api';
const ADMIN_ISS = process.env.ADMIN_JWT_ISS || 'your-company';
const EXPIRES   = config.jwtExpiresIn || process.env.JWT_EXPIRES_IN || '12h';

// ========== Helpers ==========
function signAdminJwt({ userId, roles = [], permissions = [], sessionId }) {
  const primaryRole = roles[0] || 'admin';
  return jwt.sign(
    { role: primaryRole, roles, permissions, sessionId },
    config.jwtSecret,
    { subject: String(userId), audience: ADMIN_AUD, issuer: ADMIN_ISS, expiresIn: EXPIRES }
  );
}

// ========== Controllers ==========
exports.register = async (req, res, next) => {
  try {
    const { username, password, name, email, roles } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({ username, passwordHash, name, email, roles });
    await user.save();

    await auditLogService.log({
      user: null,
      action: 'USER_REGISTER',
      detail: { username: user.username, name: user.name },
      ip: req.ip
    });

    res.status(201).json(user);
  } catch (err) { next(err); }
};

// alias สำหรับ routes ฝั่งแอดมินที่ใช้ชื่อ create
exports.create = exports.register;

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username/password required' });
    }

    const user = await User.findOne({ username }).populate('roles');
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      // แนะนำ: อาจจะหน่วงเวลาสักนิด (เช่น 500ms) ก่อนตอบกลับเพื่อป้องกัน Timing Attack ในระบบที่ซีเรียสมาก
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // limit concurrent sessions
    const sessionCount = await UserSession.countDocuments({ user: user._id });
    if (sessionCount >= 3) {
      return res.status(403).json({ error: 'คุณเข้าสู่ระบบเกินจำนวนสูงสุด 3 เครื่องแล้ว กรุณา logout ออกจากเครื่องเดิมก่อน' });
    }

    const roleNames = (user.roles || []).map(r => r.name);
    const permissions = (user.roles || []).reduce((perms, r) => perms.concat(r.permissions || []), []);
    
    // เก็บข้อมูล Device และ IP
    const deviceInfo = req.headers['user-agent'] || '';
    // req.ip หรือ x-forwarded-for กรณีอยู่หลัง proxy (app.js ต้อง set trust proxy ด้วย)
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    
    const sessionId = uuidv4();
    
    // Create Session
    await UserSession.create({ 
      user: user._id, 
      sessionId, 
      deviceInfo, 
      ipAddress 
    });

    const token = signAdminJwt({
      userId: user._id,
      roles: roleNames,
      permissions,
      sessionId
    });

    await auditLogService.log({
      user: user._id,
      action: 'USER_LOGIN',
      detail: { username: user.username, sessionId },
      ip: req.ip
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        roles: roleNames,
        permissions,
        sessionId,
      },
      expiresIn: EXPIRES
    });
  } catch (err) { next(err); }
};

exports.getAll = async (_req, res, next) => {
  try {
    const users = await User.find().populate('roles');
    res.json(users);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;

    // กันฟิลด์ที่ไม่ควรแก้
    const updatable = ['name', 'email', 'roles', 'password'];
    const patch = {};
    for (const k of updatable) if (k in req.body) patch[k] = req.body[k];

    if (patch.password) {
      patch.passwordHash = await bcrypt.hash(patch.password, 10);
      delete patch.password;
    }

    const user = await User.findByIdAndUpdate(id, patch, { new: true }).populate('roles');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await auditLogService.log({
      user: req.user?.id,
      action: 'USER_UPDATE',
      detail: { userId: id, patch: Object.keys(patch) },
      ip: req.ip
    });

    res.json(user);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // เคลียร์เซสชันของผู้ใช้ที่ถูกลบ
    await UserSession.deleteMany({ user: id });

    await auditLogService.log({
      user: req.user?.id,
      action: 'USER_DELETE',
      detail: { userId: id },
      ip: req.ip
    });

    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.logout = async (req, res, next) => {
  try {
    const { sessionId } = req.user || {};
    if (sessionId) {
      // ลบ Session ออกจาก DB ทันที -> Token เดิมจะใช้ไม่ได้อีกต่อไป (เพราะ middleware เช็ค DB)
      await UserSession.deleteOne({ sessionId });
      
      await auditLogService.log({
        user: req.user?.id,
        action: 'USER_LOGOUT',
        detail: { sessionId },
        ip: req.ip
      });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    // req.user ถูกเติมโดย middleware auth (อ่านจาก JWT)
    const uid = req.user?.id || req.user?.sub;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // ดึงจากฐานข้อมูลเพื่อให้ได้ username/name/email/roles ล่าสุด
    const user = await User.findById(uid).populate('roles');
    if (user) {
      const roleNames = (user.roles || []).map(r => r.name);
      const permissions = (user.roles || []).reduce((arr, r) => arr.concat(r.permissions || []), []);
      return res.json({
        id: String(user._id),
        username: user.username,
        name: user.name,
        email: user.email,
        roles: roleNames,
        permissions,
        sessionId: req.user?.sessionId || null,
      });
    }

    // fallback: กรณีหา user ใน DB ไม่เจอ ให้ส่งเท่าที่มีจาก token
    return res.json({
      id: uid ? String(uid) : undefined,
      username: undefined, 
      name: undefined,
      email: undefined,
      roles: req.user?.roles || [],
      permissions: req.user?.permissions || [],
      sessionId: req.user?.sessionId || null,
    });
  } catch (err) {
    next(err);
  }
};