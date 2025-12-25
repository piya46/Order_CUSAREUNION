import { useEffect, useState } from 'react';
import { parseJwt, isAdminTokenValid, isTokenUsable } from '../lib/jwt';

export function useAdminAuth() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [claims, setClaims] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    setToken(t);
    // ✅ เช็คก่อนว่า t มีค่าหรือไม่ (แก้ Error TS2345)
    if (t) {
      setClaims(parseJwt(t));
    }
    setReady(true);
  }, []);

  const login = (t: string, user: any) => {
    // clear ตาม requirement ทุกครั้งก่อนเซ็ตใหม่
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('admin_token', t);
    localStorage.setItem('admin_user', JSON.stringify(user || {}));
    setToken(t);
    setClaims(parseJwt(t));
  };

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    setClaims(null);
  };

  return {
    ready,
    token,
    claims,
    isLoggedIn: isTokenUsable(token), // ✅ ตอนนี้ใช้งานได้แล้วเพราะ import มาแล้ว
    roles: claims?.roles || (claims?.role ? [claims.role] : []),
    login,
    logout,
  };
}