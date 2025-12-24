// src/layouts/AppShell.jsx
import { Box } from '@mui/material';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FooterNav, { FOOTER_HEIGHT } from '../components/FooterNav';

const TERMS_KEY = 'aw_terms_agreed_v1';
const HIDE_FOOTER = ['/only-in-line']; // หน้า system ที่ไม่อยากให้มีฟุตเตอร์

export default function AppShell({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // ต้องกดยอมรับก่อนเข้าหน้าเลือกสินค้า/สร้างออเดอร์
  useEffect(() => {
    const needGuard =
      pathname.startsWith('/products') ||
      pathname.startsWith('/order/create');
    if (needGuard) {
      const ok = localStorage.getItem(TERMS_KEY) === '1';
      if (!ok) navigate('/', { replace: true, state: { needAgree: true } });
    }
  }, [pathname, navigate]);

  const showFooter = !HIDE_FOOTER.some(p => pathname.startsWith(p));

  return (
    <Box
      sx={{
        // เผื่อระยะไม่ให้เนื้อหาถูกฟุตเตอร์ทับ (รวม safe-area)
        pb: showFooter ? `calc(${FOOTER_HEIGHT}px + env(safe-area-inset-bottom, 0px))` : 0,
        minHeight: '100vh'
      }}
    >
      <RouteScrollRestoration />
      {children}
      {showFooter && <FooterNav />}
    </Box>
  );
}

function RouteScrollRestoration() {
  const { pathname } = useLocation();
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0,0); }
  }, [pathname]);
  return null;
}