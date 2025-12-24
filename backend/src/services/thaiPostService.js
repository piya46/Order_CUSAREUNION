// src/services/thaiPostService.js
const axios = require('axios');
const trackingCache = require('../cache/trackingCache');

const tpAuth = axios.create({
  baseURL: process.env.THAI_POST_AUTH_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
});
const tpApi = axios.create({
  baseURL: process.env.THAI_POST_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
});

let cachedToken = null;
let tokenExpireAt = 0; // epoch(ms)

async function fetchAuthToken() {
  const res = await tpAuth.post('', {}, {
    headers: { Authorization: `Token ${process.env.THAI_POST_API_KEY}` }
  });
  const { token, expire } = res.data || {};
  if (!token) throw new Error('ไม่พบ token จาก Thailand Post');
  const expMs = expire ? new Date(expire.replace(' ', 'T') + '+07:00').getTime() : Date.now() + 15 * 60 * 1000;
  cachedToken = token;
  tokenExpireAt = expMs - 60 * 1000; // กันไว้ 1 นาที
  return token;
}

async function getValidToken() {
  if (cachedToken && Date.now() < tokenExpireAt) return cachedToken;
  return fetchAuthToken();
}

function normalizeResult(data, barcode) {
  const items = data?.response?.items?.[barcode] || [];
  return items.map(x => ({
    status: x.status_description || x.status || '',
    location: x.location || x.postcode || '',
    timestamp: x.status_date || x.status_datetime || '',
    description: x.delivery_description || ''
  }));
}

// ---------- hash ชุดสถานะ (stable) ----------
function historyHash(historyArr) {
  const stable = (arr) => arr.map(e => ({
    status: e.status || '',
    location: e.location || '',
    timestamp: e.timestamp || '',
    description: e.description || ''
  }));
  const s = JSON.stringify(stable(historyArr));
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return String(h);
}

// ---------- เคลียร์แคช tracking ----------
function clearRespCache(trackingNo) {
  trackingCache.del(trackingNo);
}

// ✅ ประกาศเป็นตัวแปรก่อน แล้วค่อย export ด้านล่าง
const trackParcel = async (trackingNumber) => {
  let token = await getValidToken();

  const doCall = async (tok) => {
    const res = await tpApi.post('', {
      status: 'all',
      language: 'TH',
      barcode: [trackingNumber]
    }, { headers: { Authorization: `Token ${tok}` } });
    return res.data;
  };

  try {
    const data = await doCall(token);
    return normalizeResult(data, trackingNumber);
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      token = await fetchAuthToken();
      const data = await doCall(token);
      return normalizeResult(data, trackingNumber);
    }
    const code = e.response?.status;
    if (code === 404) throw new Error('ไม่พบเลขพัสดุในระบบ');
    if (code === 429) throw new Error('เรียกถี่เกินไป กรุณาลองใหม่ภายหลัง');
    throw new Error('ไม่สามารถดึงข้อมูลพัสดุได้');
  }
};

module.exports = {
  trackParcel,
  historyHash,
  clearRespCache,
};