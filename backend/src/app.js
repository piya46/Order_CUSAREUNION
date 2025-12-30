// backend/src/app.js
require('./jobs/autoCancelOrders');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit'); // [เพิ่ม] ต้อง install package ก่อน
const { verifySignature } = require('./utils/fileSigner');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ---------- Base hardening ----------
app.set('trust proxy', 1); // สำคัญมากหากรันหลัง Nginx/Cloudflare เพื่อให้ Rate Limit ได้ IP จริง
app.disable('x-powered-by');

// [ปรับปรุง] Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // ใน production อาจต้องจูน contentSecurityPolicy ให้เหมาะกับ frontend ที่เรียกใช้
  contentSecurityPolicy: isProd ? undefined : false, 
}));

// ---------- [SECURITY] Rate Limiting ----------
// Global Limiter: จำกัด 100 requests ต่อ 15 นาที ต่อ IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, // ปรับตามความเหมาะสมของ Traffic
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// Login Limiter: เข้มงวดพิเศษ ป้องกัน Brute Force รหัสผ่าน
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // ผิดได้แค่ 10 ครั้งใน 15 นาที
  message: { error: 'Too many login attempts, please try again later.' }
});

// บังคับใช้ Limiter
app.use('/api', apiLimiter); 
app.use('/api/users/login', authLimiter); // เจาะจง route login
// ----------------------------------------------

// ---------- Parsers ----------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Logger ----------
if (!isProd) app.use(morgan('dev'));

// ---------- CORS ----------
const CORS_ALLOWLIST = (process.env.CORS_ALLOWLIST || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_HEADERS = 'Authorization,Content-Type,Accept,X-LINE-USERID,X-Requested-With';

const normalizeOrigin = (s) => String(s || '').replace(/\/+$/, '');
const ALLOWLIST_SET = new Set(CORS_ALLOWLIST.map(normalizeOrigin));

const corsOptions = (req, cb) => {
  const originRaw = req.header('Origin');
  const origin = normalizeOrigin(originRaw);

  const ok = isProd
    ? Boolean(origin && ALLOWLIST_SET.has(origin))
    : true; 

  cb(null, {
    origin: ok,
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: ALLOWED_HEADERS,
    maxAge: 86400,
  });
};

app.use((req, res, next) => {
  if (req.path === '/_health') return next(); 
  if (req.method === 'OPTIONS') {
    return cors(corsOptions)(req, res, () => res.sendStatus(204));
  }
  return cors(corsOptions)(req, res, next);
});

// ---------- Health ----------
const HEALTH_TOKEN = process.env.HEALTH_TOKEN;
const HEALTH_IP_ALLOWLIST = (process.env.HEALTH_ALLOWLIST || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const getClientIp = (req) => {
  const xf = (req.headers['x-forwarded-for'] || '').toString();
  return (xf.split(',')[0].trim()) || req.ip;
};
const ipAllowed = (ip) => HEALTH_IP_ALLOWLIST.length === 0 || HEALTH_IP_ALLOWLIST.includes(ip);

const requireHealthAuth = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!HEALTH_TOKEN || token !== HEALTH_TOKEN) return res.sendStatus(401);
  if (!ipAllowed(getClientIp(req))) return res.sendStatus(403);
  return next();
};

app.get('/_health', requireHealthAuth, (_req, res) => res.status(204).end());

// ---------- Static (public uploads) ----------
const publicDir = path.join(__dirname, 'public_uploads');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
app.use('/public_uploads', express.static(publicDir, {
  maxAge: isProd ? '7d' : 0,
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// ---------- Signed private file (slip) ----------
const privateDir = path.join(__dirname, 'private_uploads');
if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir);

app.get('/api/files/:key', (req, res) => {
  const { key } = req.params;
  const { exp, sig } = req.query;
  if (!verifySignature(key, Number(exp), String(sig || ''))) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  const safe = String(key).replace(/[/\\]/g, '');
  const filePath = path.join(privateDir, safe);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filePath);
});

app.get('/', (req, res) => {
  if (isProd) return res.status(404).send('Not found');
  return res.send('API server (dev)');
});

const routes = require('./routes');
app.use('/api', routes);

// 404
app.use((req, res) => res.status(404).send('Not found'));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Bad request: invalid JSON' });
  if (err.message && err.message.startsWith('Only images and PDF')) {
    return res.status(400).json({ error: err.message });
  }
  // [SECURITY] ใน production ไม่ควรส่ง err.message ที่อาจเผยข้อมูลภายใน
  const errMsg = isProd ? 'Internal server error' : (err.message || 'Internal server error');
  res.status(500).json({ error: errMsg });
});

module.exports = app;