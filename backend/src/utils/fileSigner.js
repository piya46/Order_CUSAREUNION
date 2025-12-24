// backend/src/utils/fileSigner.js
const crypto = require('crypto');

const SECRET = process.env.FILE_SIGN_SECRET || 'change-me';
const DEFAULT_TTL = parseInt(process.env.FILE_SIGN_TTL || '300', 10); // วินาที

function hmac(key, exp) {
  const payload = `${key}.${exp}`;
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

function buildSignedUrl(key, ttlSec = DEFAULT_TTL) {
  const safeKey = String(key).replace(/[/\\]/g, '');
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = hmac(safeKey, exp);
  return `/api/files/${encodeURIComponent(safeKey)}?exp=${exp}&sig=${sig}`;
}

function verifySignature(key, exp, sig) {
  if (!key || !exp || !sig) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(exp) < now) return false;
  const safeKey = String(key).replace(/[/\\]/g, '');
  const expected = hmac(safeKey, Number(exp));
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = { buildSignedUrl, verifySignature };
