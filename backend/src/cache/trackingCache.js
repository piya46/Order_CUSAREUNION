// src/cache/trackingCache.js
const NodeCache = require('node-cache');

// TTL เริ่มต้น 30 นาที (อ่านจาก env ได้เป็น ms, ถ้าไม่มีก็ 30 นาที)
const DEFAULT_TTL_MS = Number(process.env.TP_RESP_TTL_MS || 30 * 60 * 1000);
// NodeCache รับเป็นวินาที
const cache = new NodeCache({ stdTTL: Math.floor(DEFAULT_TTL_MS / 1000) });

function get(key) {
  return cache.get(key);
}

function set(key, val, ttlMs) {
  if (typeof ttlMs === 'number') {
    const ttlSec = ttlMs === 0 ? 0 : Math.max(1, Math.floor(ttlMs / 1000));
    cache.set(key, val, ttlSec);
  } else {
    cache.set(key, val);
  }
}

function del(key) { cache.del(key); }

module.exports = { get, set, del };