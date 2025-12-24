// backend/src/middlewares/auth.js
const jwt = require('jsonwebtoken');

// --- ENV (Admin JWT) ---
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change-me';
const ADMIN_AUD   = process.env.ADMIN_JWT_AUD || '';
const ADMIN_ISS   = process.env.ADMIN_JWT_ISS || '';

// --- ENV (LINE LIFF ID Token) ---
const LINE_CHANNEL_ID = process.env.LINE_LIFF_CHANNEL_ID || process.env.LINE_CHANNEL_ID;
const LINE_ISS        = process.env.LINE_ID_TOKEN_ISS || 'https://access.line.me';
const LINE_JWKS_URL   = process.env.LINE_JWKS_URL || 'https://api.line.me/oauth2/v2.1/certs';

// ----- jose (ESM) dynamic import + cache -----
let _jose = null;           // { createRemoteJWKSet, jwtVerify }
let _JWKS = null;           // cached JWKS
async function ensureJose() {
  if (_jose && _JWKS) return _jose;
  const jose = await import('jose'); // ← แก้ ERR_REQUIRE_ESM
  _jose = jose;
  _JWKS = jose.createRemoteJWKSet(new URL(LINE_JWKS_URL), { cooldownDuration: 60_000 });
  return jose;
}

// ----- helpers -----
const getBearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

// ข้าม preflight เสมอ (แต่ app.js ก็กันไว้แล้ว เผื่อมีการผูก middleware บาง route)
const skipIfOptions = (handler) => (req, res, next) =>
  req.method === 'OPTIONS' ? next() : handler(req, res, next);

// กำหนด opts ของ jwt.verify สำหรับ Admin JWT (เช็คเฉพาะตอนตั้งค่า)
function buildVerifyOpts() {
  const opts = {};
  if (ADMIN_AUD) opts.audience = ADMIN_AUD;
  if (ADMIN_ISS) opts.issuer = ADMIN_ISS;
  return opts;
}

/* =========================
 * Admin-only (Dashboard/API)
 * ========================= */
exports.requireAdmin = (roles = []) =>
  skipIfOptions((req, res, next) => {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const payload = jwt.verify(token, AUTH_SECRET, buildVerifyOpts());
      const primaryRole = payload.role || 'admin';
      req.user = {
        id: payload.sub,
        type: 'admin',
        role: primaryRole,
        roles: Array.isArray(payload.roles) ? payload.roles : [primaryRole],
        permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
        sessionId: payload.sessionId || undefined,
      };
      if (roles.length && !roles.some(r => req.user.roles.includes(r))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  });

/* =========================
 * LIFF user only (Frontend)
 * ========================= */
exports.requireLiffUser = skipIfOptions(async (req, res, next) => {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    if (!LINE_CHANNEL_ID) return res.status(500).json({ error: 'LINE channel id not configured' });

    const { jwtVerify } = await ensureJose();
    const { payload } = await jwtVerify(token, _JWKS, {
      issuer: LINE_ISS,
      audience: LINE_CHANNEL_ID,
    });

    req.user = {
      type: 'liff',
      lineId: payload.sub,
      name: payload.name,
      picture: payload.picture,
      roles: ['customer'],
      permissions: [],
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});


exports.requireAdminOrLiff = skipIfOptions(async (req, res, next) => {
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // 1) ลอง Admin ก่อน
  try {
    const payload = jwt.verify(token, AUTH_SECRET, buildVerifyOpts());
    const primaryRole = payload.role || 'admin';
    req.user = {
      id: payload.sub,
      type: 'admin',
      role: primaryRole,
      roles: Array.isArray(payload.roles) ? payload.roles : [primaryRole],
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      sessionId: payload.sessionId || undefined,
    };
    return next();
  } catch {
    // fallthrough
  }

  // 2) จากนั้นลอง LIFF
  try {
    if (!LINE_CHANNEL_ID) return res.status(500).json({ error: 'LINE channel id not configured' });
    const { jwtVerify } = await ensureJose();
    const { payload } = await jwtVerify(token, _JWKS, {
      issuer: LINE_ISS,
      audience: LINE_CHANNEL_ID,
    });
    req.user = {
      type: 'liff',
      lineId: payload.sub,
      name: payload.name,
      picture: payload.picture,
      roles: ['customer'],
      permissions: [],
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});