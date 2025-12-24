// src/components/Protected.tsx
import { ReactNode, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { parseJwt, isAdminTokenValid, AdminClaims } from '../lib/jwt';
import { clearSession, getUser } from '../lib/session';

type Props = {
  children: ReactNode;
  roles?: string[];       // อนุญาตเฉพาะ Role เหล่านี้ (เช่น "admin", "manager")
  permissions?: string[]; // อนุญาตเฉพาะผู้ที่มีสิทธิ์เหล่านี้ (เช่น "order:manage")
};

export default function Protected({ children, roles, permissions }: Props) {
  const location = useLocation();
  const token = localStorage.getItem('aw_token') || '';

  const { ok, reason } = useMemo(() => {
    // 1. เช็ค Token เบื้องต้น
    if (!token) return { ok: false, reason: 'no-token' };

    // 2. เช็ค Claims ใน JWT (Expiration, Issuer etc.)
    const claims = parseJwt<AdminClaims>(token);
    if (!claims || !isAdminTokenValid(claims)) return { ok: false, reason: 'invalid-token' };

    // 3. ดึงข้อมูล User (รวมถึง Permissions ที่อาจเก็บใน localStorage หรือ decode จาก token เพิ่มเติม)
    // หมายเหตุ: getUser() ควรดึงข้อมูลล่าสุดที่ Login มา (รวม roles และ permissions array)
    const user = getUser(); 
    const userRoles = user?.roles || [];
    const userPerms = user?.permissions || [];

    // 4. เช็ค Role (ถ้ามีการกำหนด roles props)
    if (roles && roles.length > 0) {
      const hasRole = roles.some(r => userRoles.includes(r));
      if (!hasRole) return { ok: false, reason: 'forbidden' };
    }

    // 5. เช็ค Permission (ถ้ามีการกำหนด permissions props) -> *NEW*
    if (permissions && permissions.length > 0) {
      // เช็คว่ามีสิทธิ์ที่กำหนด"อย่างน้อย 1 อย่าง" หรือ "ทั้งหมด" (ที่นี่ใช้ logic: ต้องมีอย่างน้อย 1 สิทธิ์ที่ตรง)
      // หรือปรับเป็น every() ถ้าต้องการให้มีครบทุกสิทธิ์
      const hasPerm = permissions.some(p => userPerms.includes(p));
      if (!hasPerm) return { ok: false, reason: 'forbidden' };
    }

    return { ok: true, reason: 'ok' };
  }, [token, roles, permissions]);

  if (!ok) {
    if (reason === 'forbidden') {
      // ถ้า Token ถูกต้องแต่ไม่มีสิทธิ์ -> ไปหน้า 403
      return <Navigate to="/403" replace />;
    }
    // ถ้า Token ไม่ถูกต้องหรือหมดอายุ -> เคลียร์ Session แล้วไป Login
    clearSession();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}