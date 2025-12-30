// frontend/adminweb/src/lib/axios.ts
import axios from 'axios';
import { getToken, clearSession } from './session';

const API = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API,
  withCredentials: false,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    
    // [Security] Handle Session Expired / Revoked / Kick
    if (status === 401) {
      clearSession(); // ล้าง token และ user info
      if (location.pathname !== '/login') {
        // Redirect ไปหน้า Login ถ้ายังไม่ได้อยู่ที่นั่น
        window.location.href = '/login';
      }
    }

    // [Security] Handle Rate Limiting
    if (status === 429) {
      // แจ้งเตือน User เมื่อยิง API ถี่เกินไป
      alert("คุณทำรายการถี่เกินไป กรุณารอสักครู่ (Too many requests)");
    }

    return Promise.reject(err);
  }
);

export default api;