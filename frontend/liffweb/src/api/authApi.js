// src/api/authApi.js
import api from './axios';


const STORAGE_KEY = 'APP_AUTH_TOKEN';

/** ตั้ง/เอาออก Authorization header ให้ axios (Bearer <token>) */
export function setAxiosAuth(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** โหลด token จาก localStorage แล้วตั้ง header ทันที (เรียกตอน import) */
export function bootstrapAuthFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token } = JSON.parse(raw);
    if (token) {
      setAxiosAuth(token);
      return token;
    }
  } catch {}
  return null;
}

/** เซฟ token ลง storage + ตั้ง header */
function saveToken(token) {
  if (!token) return clearToken();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token }));
  setAxiosAuth(token);
}

/** ล้าง token ใน storage + header */
export function clearToken() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  setAxiosAuth(null);
}

/**
 * แลก LIFF id_token -> app token (ฝั่ง backend ของคุณต้อง verify id_token)
 * @param {string} idToken - liff.getIDToken()
 * @returns {Promise<{ token: string, user?: any }>}
 */
// src/api/authApi.js

/**
 * ส่ง LINE ID Token ไปให้ backend แลกเป็น access token ของระบบเรา
 * backend ควร validate idToken แล้วออก JWT ของระบบกลับมา
 */
export async function exchangeLiffToken(idToken) {
  const { data } = await api.post('/auth/liff/exchange', { idToken });
  // สมมุติ backend ส่ง { token: '...' }
  if (data?.token) {
    localStorage.setItem('auth_token', data.token);
  }
  return data;
}

/**
 * ตรวจสอบสิทธิ์ปัจจุบัน (option ตาม backend)
 * @returns {Promise<any>}
 */
export function getMe() {
  return api.get('/auth/me').then(r => r.data);
}

/**
 * ออกจากระบบ (option ตาม backend)
 * - เรียก backend เพื่อล้างเซสชัน (ถ้ามี) แล้วล้าง token ฝั่ง client
 */
export async function logoutServer() {
  try { await api.post('/auth/logout'); } catch { /* เงียบได้ */ }
  clearToken();
}

/**
 * ใช้เมื่อต้องการ "ต่ออายุสิทธิ์" ด้วย LIFF ใหม่ (เช่น เมื่อโดน 401)
 * @param {() => string | Promise<string>} getIdTokenFn - ฟังก์ชันที่จะคืนค่า id_token (เช่น () => liff.getIDToken())
 */
export async function reauthorizeWithLiff(getIdTokenFn) {
  const idToken = await Promise.resolve(getIdTokenFn());
  return exchangeLiffToken(idToken);
}


export async function exchangeLiffIdToken(idToken) {
  // ตัวอย่าง: backend มี POST /auth/liff
  // ส่งอะไรเพิ่ม เช่น channelId ก็ให้ backendอ่านจาก ENV ฝั่ง server แทน
  const res = await api.post('/auth/liff', { idToken });
  return res.data; // { ok: true, user: {...}, ... }
}

/**
 * ดึง token ปัจจุบันจาก storage (ถ้าต้องการใช้งานเป็นกรณีพิเศษ)
 */
export function getStoredToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token || null;
  } catch {
    return null;
  }
}

// -- bootstrap ทันทีเมื่อไฟล์ถูก import --
bootstrapAuthFromStorage();