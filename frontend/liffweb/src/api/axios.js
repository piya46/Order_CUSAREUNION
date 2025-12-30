// frontend/liffweb/src/api/axios.js
import axios from 'axios';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
if (!API_BASE) {
  console.warn('[api] VITE_API_BASE_URL ไม่ได้ตั้งค่า: โปรดตั้งค่าให้ชี้ไปซับโดเมนของ backend');
}

export function toBackendURL(u) {
  if (!u) return u;
  try {
    return new URL(u, API_BASE + '/').href;
  } catch {
    return u;
  }
}

const api = axios.create({
  baseURL: API_BASE,        
  withCredentials: false,   
  timeout: 15000,
});

const AUTH_KEYS = ['idToken','liffIdToken','auth_token','APP_AUTH_TOKEN','lineUserId'];
function clearAuthKeys() { for (const k of AUTH_KEYS) { try { localStorage.removeItem(k); } catch {} } }
function getLiveIdToken() { try { return window?.liff?.getIDToken?.() || ''; } catch { return ''; } }
function getStoredIdToken() {
  try {
    return (
      localStorage.getItem('liffIdToken') ||
      localStorage.getItem('idToken') ||
      localStorage.getItem('auth_token') || 
      ''
    );
  } catch { return ''; }
}
function getLineUserId() { try { return localStorage.getItem('lineUserId') || ''; } catch { return ''; } }

api.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  if (config.url && typeof config.url === 'string') {
    const u = config.url;
    const isAbsolute = /^https?:\/\//i.test(u);
    if (!isAbsolute && !u.startsWith('/api')) {
      config.url = '/api' + (u.startsWith('/') ? '' : '/') + u;
    }
  }

  let token = '';
  const hdr = config.headers.Authorization;
  if (typeof hdr === 'string' && hdr.startsWith('Bearer ')) token = hdr.slice(7);
  if (!token) token = getLiveIdToken() || getStoredIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const uid = getLineUserId();
  if (uid && !config.headers['X-LINE-USERID']) config.headers['X-LINE-USERID'] = uid;

  if (!config.headers.Accept) config.headers.Accept = 'application/json';
  if (!config.headers['X-Requested-With']) config.headers['X-Requested-With'] = 'XMLHttpRequest';

  return config;
});

let onUnauthorized = null;
export function setOnUnauthorized(fn) { onUnauthorized = fn; }

let isReauthing = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const cfg = err?.config || {};
    
    // [Security] Handle Rate Limit
    if (status === 429) {
      alert("ขออภัย คุณทำรายการถี่เกินไป กรุณารอสักครู่");
      return Promise.reject(err);
    }

    // [Security] Handle Session Expired (Backend ตอบ 401 เมื่อ Token/Session หลุด)
    if (status === 401 && !cfg.__authRetried) {
      cfg.__authRetried = true;
      clearAuthKeys();
      
      // ถ้ามี callback ให้เรียกใช้ (เช่นสั่ง liff.login() หรือ reload)
      if (!isReauthing && typeof onUnauthorized === 'function') {
        isReauthing = true;
        try { onUnauthorized(); } finally {
          setTimeout(() => { isReauthing = false; }, 2000);
        }
      } else {
        // Fallback: reload page เพื่อเริ่ม flow ใหม่
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export default api;