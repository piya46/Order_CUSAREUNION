// src/lib/jwt.ts
import { jwtDecode } from 'jwt-decode';

export type AdminClaims = {
  sub?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  aud?: string;
  iss?: string;
  exp?: number; // seconds
  iat?: number;
};

// ปรับให้รับ null ได้ด้วย เพื่อความยืดหยุ่น
export function parseJwt<T = any>(token?: string | null): T | null {
  if (!token) return null;
  try { return jwtDecode<T>(token); } catch { return null; }
}

// ไม่มี exp => ถือว่า "หมดอายุ"
export function isExpired(c?: AdminClaims | null, nowMs = Date.now()) {
  if (!c?.exp) return true;
  return c.exp * 1000 <= nowMs;
}

/** ถ้า VITE_ADMIN_JWT_AUD/ISS ว่าง -> ข้ามการเช็คเงื่อนไขนั้น */
export function isAdminTokenValid(c?: AdminClaims | null) {
  if (!c) return false;

  const envAud = String(import.meta.env.VITE_ADMIN_JWT_AUD ?? '').trim();
  const envIss = String(import.meta.env.VITE_ADMIN_JWT_ISS ?? '').trim();

  const okAud = !envAud || c.aud === envAud;
  const okIss = !envIss || c.iss === envIss;
  const okExp = !isExpired(c);

  return okAud && okIss && okExp;
}


export function isTokenUsable(token?: string | null): boolean {
  if (!token) return false;
  const c = parseJwt<AdminClaims>(token);
  return isAdminTokenValid(c);
}