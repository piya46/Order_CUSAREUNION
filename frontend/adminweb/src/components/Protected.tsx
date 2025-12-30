// frontend/adminweb/src/components/Protected.tsx
import { ReactNode, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { parseJwt, isAdminTokenValid, AdminClaims } from '../lib/jwt';
import { clearSession, getUser, TOKEN_KEY } from '../lib/session'; // [1] ใช้ TOKEN_KEY

type Props = {
  children: ReactNode;
  roles?: string[];
  permissions?: string[];
};

export default function Protected({ children, roles, permissions }: Props) {
  const location = useLocation();
  const token = localStorage.getItem(TOKEN_KEY) || ''; // [2] อ่าน aw_token ที่ถูกต้อง

  const { ok, reason } = useMemo(() => {
    // 1. เช็ค Token ว่ามีไหม
    if (!token) return { ok: false, reason: 'no-token' };

    // 2. เช็คความถูกต้องของ JWT (หมดอายุหรือยัง)
    const claims = parseJwt<AdminClaims>(token);
    if (!claims || !isAdminTokenValid(claims)) return { ok: false, reason: 'invalid-token' };

    // 3. ดึงข้อมูล User และสิทธิ์จาก aw_user (localStorage)
    const user = getUser(); 
    const userRoles = user?.roles || [];
    const userPerms = user?.permissions || [];

    // [3] เช็ค Role (ถ้ามี props roles)
    if (roles && roles.length > 0) {
      const hasRole = roles.some(r => userRoles.includes(r));
      if (!hasRole) return { ok: false, reason: 'forbidden' };
    }

    // [4] เช็ค Permission (ถ้ามี props permissions)
    // ระบบจะเทียบกับ userPerms ที่อยู่ใน aw_user จริงๆ
    if (permissions && permissions.length > 0) {
      const hasPerm = permissions.some(p => userPerms.includes(p));
      if (!hasPerm) return { ok: false, reason: 'forbidden' };
    }

    return { ok: true, reason: 'ok' };
  }, [token, roles, permissions]);

  // Handle ผลลัพธ์
  if (!ok) {
    if (reason === 'forbidden') {
      return <Navigate to="/403" replace />;
    }
    // กรณี Token ผิด/หมดอายุ -> เคลียร์ Session แล้วไป Login
    clearSession();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}