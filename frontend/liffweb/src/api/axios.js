import axios from 'axios';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
if (!API_BASE) {

  console.warn('[api] VITE_API_BASE_URL ไม่ได้ตั้งค่า: โปรดตั้งค่าให้ชี้ไปซับโดเมนของ backend');
}

// ---- utility: แปลง path ให้เป็น absolute URL ของ backend ----
export function toBackendURL(u) {
  if (!u) return u;
  try {
    // รองรับทั้ง path relative และ absolute (ถ้า absolute อยู่แล้วจะคืนค่าเดิม)
    return new URL(u, API_BASE + '/').href;
  } catch {
    return u;
  }
}

// ---- axios instance ที่ชี้ไป backend domain ----
const api = axios.create({
  baseURL: API_BASE,        // เช่น https://api.cusa.pstpyst.com
  withCredentials: false,   // ใช้ Bearer token ผ่าน header แทน cookie
  timeout: 15000,
});

// ---- auth helpers ----
const AUTH_KEYS = ['idToken','liffIdToken','auth_token','APP_AUTH_TOKEN','lineUserId'];
function clearAuthKeys() { for (const k of AUTH_KEYS) { try { localStorage.removeItem(k); } catch {} } }
function getLiveIdToken() { try { return window?.liff?.getIDToken?.() || ''; } catch { return ''; } }
function getStoredIdToken() {
  try {
    return (
      localStorage.getItem('liffIdToken') ||
      localStorage.getItem('idToken') ||
      localStorage.getItem('auth_token') || // เผื่อแลก app token
      ''
    );
  } catch { return ''; }
}
function getLineUserId() { try { return localStorage.getItem('lineUserId') || ''; } catch { return ''; } }

// ---- request interceptor ----
api.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  // 1) บังคับ prefix "/api" ให้อัตโนมัติถ้า dev เผลอเรียกแบบ "orders/..." หรือ "/orders"
  if (config.url && typeof config.url === 'string') {
    const u = config.url;
    const isAbsolute = /^https?:\/\//i.test(u);
    if (!isAbsolute && !u.startsWith('/api')) {
      config.url = '/api' + (u.startsWith('/') ? '' : '/') + u;
    }
  }

  // 2) แนบ Bearer token (สดจาก liff ก่อน ถ้าไม่มีค่อย fallback storage)
  let token = '';
  const hdr = config.headers.Authorization;
  if (typeof hdr === 'string' && hdr.startsWith('Bearer ')) token = hdr.slice(7);
  if (!token) token = getLiveIdToken() || getStoredIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // 3) แนบ LINE user id (ถ้ามี)
  const uid = getLineUserId();
  if (uid && !config.headers['X-LINE-USERID']) config.headers['X-LINE-USERID'] = uid;

  // 4) เฮดเดอร์ที่ช่วย CORS preflight ให้ผ่านง่าย
  if (!config.headers.Accept) config.headers.Accept = 'application/json';
  if (!config.headers['X-Requested-With']) config.headers['X-Requested-With'] = 'XMLHttpRequest';

  return config;
});

// ---- response interceptor: จัดการ 401 แบบไม่ลูป ----
let onUnauthorized = null;
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

let isReauthing = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const cfg = err?.config || {};
    if (status === 401 && !cfg.__authRetried) {
      cfg.__authRetried = true;
      clearAuthKeys();
      if (!isReauthing && typeof onUnauthorized === 'function') {
        isReauthing = true;
        try { onUnauthorized(); } finally {
          setTimeout(() => { isReauthing = false; }, 2000);
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;