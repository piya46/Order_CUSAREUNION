const axios = require('axios');

const AUTH_URL = process.env.THAI_POST_WEBHOOK_AUTH_URL;   // e.g. https://trackwebhook.thailandpost.co.th/post/api/v1/authenticate/token
const HOOK_URL = process.env.THAI_POST_WEBHOOK_HOOK_URL;   // e.g. https://trackwebhook.thailandpost.co.th/post/api/v1/hook
const UNSUB_URL = process.env.THAI_POST_WEBHOOK_UNSUB_URL; // e.g. https://trackwebhook.thailandpost.co.th/post/api/v1/unsubscribe
const API_KEY = process.env.THAI_POST_WEBHOOK_API_KEY;
const CALLBACK = process.env.THAI_POST_WEBHOOK_CALLBACK;   // e.g. https://your.com/api/tracking/webhook/thai-post
const SECRET = process.env.THAI_POST_WEBHOOK_SECRET;

let cached = { token: null, expireAt: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.expireAt) return cached.token;
  const res = await axios.post(AUTH_URL, {}, { headers: { Authorization: `Token ${API_KEY}` } });
  const { token, expire } = res.data || {};
  if (!token) throw new Error('Webhook token not found');
  const ts = expire ? new Date(expire.replace(' ', 'T') + '+07:00').getTime() : Date.now() + 25*24*60*60*1000;
  cached = { token, expireAt: ts - 24*60*60*1000 };
  return token;
}

async function subscribeBarcode(barcode, { req_previous_status = false } = {}) {
  const token = await getToken();
  const cb = `${CALLBACK}?s=${encodeURIComponent(SECRET)}`;
  const body = { barcode: [barcode], req_previous_status, url: cb };
  const res = await axios.post(HOOK_URL, body, { headers: { Authorization: `Token ${token}` } });
  return res.data; // ปกติจะมี uid/ref
}

async function unsubscribe(uid, ref) {
  const token = await getToken();
  const url = `${UNSUB_URL}/${encodeURIComponent(uid)}?ref=${encodeURIComponent(ref)}`;
  const res = await axios.post(url, {}, { headers: { Authorization: `Token ${token}` } });
  return res.data;
}

module.exports = { subscribeBarcode, unsubscribe };