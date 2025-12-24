// src/components/Protected.tsx
import { ReactNode, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { parseJwt, isAdminTokenValid, AdminClaims } from '../lib/jwt';
import { clearSession } from '../lib/session';

type Props = {
  children: ReactNode;
  roles?: string[]; // อนุญาตเฉพาะ roles เหล่านี้ (ถ้าไม่ส่ง -> แค่ต้องเป็นแอดมินที่ token valid)
};

export default function Protected({ children, roles }: Props) {
  const location = useLocation();
  const token = localStorage.getItem('aw_token') || '';

  const { ok, reason } = useMemo(() => {
    const claims = parseJwt<AdminClaims>(token);
    if (!token || !claims) return { ok: false, reason: 'no-token' };
    if (!isAdminTokenValid(claims)) return { ok: false, reason: 'invalid-claims' };

    if (!roles || roles.length === 0) return { ok: true, reason: 'ok' };

    const userRoles =
      (claims.roles && Array.isArray(claims.roles) && claims.roles.length > 0)
        ? claims.roles
        : (claims.role ? [claims.role] : []);

    const allowed = roles.some(r => userRoles.includes(r));
    return { ok: allowed, reason: allowed ? 'ok' : 'forbidden' };
  }, [token, roles]);

  if (!ok) {
    if (reason !== 'forbidden') {
      clearSession(); // กันวนลูป
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}