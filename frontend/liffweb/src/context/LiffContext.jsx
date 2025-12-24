// src/context/LiffContext.jsx
import { createContext, useEffect, useState, useCallback, useContext } from 'react';
import { setOnUnauthorized } from '../api/axios';

export const LiffContext = createContext({
  ready: false,
  profile: null,
  error: null,
  reauthorize: null,
});

export function useLiff() { return useContext(LiffContext); }

/* ------------------------------ LIFF SDK loader ------------------------------ */
async function ensureLiffSdk() {
  if (window?.liff) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('LIFF SDK not found'));
    document.head.appendChild(s);
  });
}

/* ---------------------------- Auth helpers (safe) ---------------------------- */
// เคลียร์เฉพาะคีย์ที่เกี่ยวกับ auth เพื่อไม่ให้ state อื่น ๆ หาย
const AUTH_KEYS = ['idToken', 'liffIdToken', 'auth_token', 'APP_AUTH_TOKEN', 'lineUserId'];
function clearAuthKeys() {
  for (const k of AUTH_KEYS) {
    try { localStorage.removeItem(k); } catch {}
  }
}

// เก็บ idToken (สด) ลง storage เพื่อให้ axios ใช้ได้ทันที
function storeIdToken() {
  try {
    const t = window?.liff?.getIDToken?.() || '';
    if (t) {
      localStorage.setItem('idToken', t);
      localStorage.setItem('liffIdToken', t);
    }
    return t;
  } catch {
    return '';
  }
}

/* --------------------------------- Provider --------------------------------- */
export function LiffProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  // รี-ล็อกอินแบบปลอดภัย: เคลียร์เฉพาะ auth keys + liff.logout + liff.login
  const reauthorize = useCallback(() => {
    clearAuthKeys();
    try { window?.liff?.logout?.(); } catch {}
    try { window?.liff?.login?.({ redirectUri: window.location.href }); }
    catch { window.location.replace(window.location.href); }
  }, []);

  // ให้ axios เรียก re-login เมื่อเจอ 401
  useEffect(() => { setOnUnauthorized(() => reauthorize); }, [reauthorize]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await ensureLiffSdk();

        const liffId = import.meta.env.VITE_LIFF_ID;
        if (!liffId) throw new Error('VITE_LIFF_ID is missing');

        await window.liff.init({ liffId, withLoginOnExternalBrowser: true });

        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href });
          return; // รอรีไดเรกต์
        }

        // เก็บ token สด
        storeIdToken();

        // โหลดโปรไฟล์
        const pf = await window.liff.getProfile();
        if (!mounted) return;

        // เก็บ userId ไว้ให้ axios แนบ header X-LINE-USERID ได้
        try { localStorage.setItem('lineUserId', pf.userId || ''); } catch {}

        setProfile({
          userId: pf.userId,
          displayName: pf.displayName,
          pictureUrl: pf.pictureUrl,
        });
        setReady(true);
      } catch (e) {
        console.error('LIFF init error', e);
        if (!mounted) return;
        setError({ message: e?.friendlyMessage || e?.message || 'LIFF init failed' });
        setReady(true); // ให้แอปเรนเดอร์ต่อ พร้อมแสดง error/ปุ่ม re-login
      }
    })();

    // รีเฟรช idToken เมื่อหน้าได้โฟกัส (กัน token หมดอายุ)
    const onFocus = () => { try { storeIdToken(); } catch {} };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <LiffContext.Provider value={{ ready, profile, error, reauthorize }}>
      {children}
    </LiffContext.Provider>
  );
}

/* -------- (ถ้าคุณมีโค้ดเดิมที่ import setLiffAuth/getLiffAuth ให้คงไว้) -------- */
let _idToken = null;
let _userId = null;

export function setLiffAuth({ idToken, userId }) {
  _idToken = idToken || null;
  _userId = userId || null;
}

export function getLiffAuth() {
  return { idToken: _idToken, userId: _userId };
}