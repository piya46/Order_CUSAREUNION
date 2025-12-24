// src/lib/axios.ts
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
    if (status === 401) {
      clearSession(); // ล้าง + แจ้ง cross-tab
      if (location.pathname !== '/login') {
        location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);

export default api;