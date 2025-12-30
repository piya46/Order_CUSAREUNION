// frontend/adminweb/src/store/auth.ts
import { useEffect, useState } from 'react';
import { parseJwt, isTokenUsable } from '../lib/jwt';
import { TOKEN_KEY, USER_KEY, clearSession } from '../lib/session'; // [1] Import Key ที่ถูกต้องจาก session.ts
import api from '../lib/axios'; // Import axios instance ที่เราทำ Interceptor ไว้

export function useAdminAuth() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [claims, setClaims] = useState<any>(null);

  useEffect(() => {
    // [2] แก้ไข: ดึง Token ด้วย Key ที่ถูกต้อง ("aw_token")
    const t = localStorage.getItem(TOKEN_KEY); 
    setToken(t);
    if (t) {
      setClaims(parseJwt(t));
    }
    setReady(true);
  }, []);

  const login = (t: string, user: any) => {
    // [3] แก้ไข: บันทึกข้อมูลด้วย Key ที่ถูกต้อง ("aw_token", "aw_user")
    localStorage.clear();
    sessionStorage.clear();
    
    // ใช้ Key จาก session.ts เพื่อความถูกต้อง
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    
    setToken(t);
    setClaims(parseJwt(t));
  };

  const logout = async () => {
    try {
      // [Security] แจ้ง Backend ให้ลบ Session ใน Database ทิ้ง
      if (token) {
        await api.post('/users/logout'); 
      }
    } catch (err) {
      console.error('Logout API failed:', err);
      // ถึง API Error ก็จะทำงานต่อเพื่อลบข้อมูลในเครื่อง Client
    }

    // [4] แก้ไข: ใช้ฟังก์ชันมาตรฐานจาก session.ts เพื่อลบข้อมูลให้เกลี้ยง
    clearSession(); 
    
    setToken(null);
    setClaims(null);
    
    // Redirect ไปหน้า Login
    window.location.href = '/login';
  };

  return {
    ready,
    token,
    claims,
    isLoggedIn: isTokenUsable(token),
    roles: claims?.roles || (claims?.role ? [claims.role] : []),
    login,
    logout,
  };
}