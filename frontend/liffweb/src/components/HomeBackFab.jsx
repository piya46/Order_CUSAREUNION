// src/components/HomeBackFab.jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Fab, Tooltip } from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import { Link, useLocation } from 'react-router-dom';

/**
 * FAB กลับหน้าหลัก (มุมซ้ายล่าง) ที่ "หลบ" อัตโนมัติเมื่อมีอะไรทับด้านล่างซ้าย
 * หลบพวก: MUI Snackbar/BottomNavigation, cookie banner, reCAPTCHA badge, chat bubble ฯลฯ
 * ถ้าต้องการให้ element อื่น ๆ ถูกนับเป็นสิ่งกีดขวาง ให้ใส่ data-avoid-fab กับ element นั้น
 */
export default function HomeBackFab() {
  const ref = useRef(null);
  const [offsetBottom, setOffsetBottom] = useState(16); // ระยะฐานจากขอบล่าง (px)
  const location = useLocation();

  // ตัวเลือกที่อาจบังบริเวณล่างซ้าย
  const BLOCKER_SELECTORS = [
    '.MuiSnackbar-root',
    '.MuiBottomNavigation-root',
    '.MuiSpeedDial-root',
    '.cookie-banner',
    '.cookie-consent',
    '.grecaptcha-badge',
    '.chat-bubble',
    '.Toastify__toast-container',
    '[data-avoid-fab]',
    '[data-fixed-bottom]',
  ].join(',');

  // ตรวจซ้ำเมื่อมี resize/scroll/DOM เปลี่ยน
  useEffect(() => {
    const on = () => requestAnimationFrame(reflow);
    window.addEventListener('resize', on, { passive: true });
    window.addEventListener('scroll', on, { passive: true });

    const mo = new MutationObserver(on);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reflow ตอน mount และเมื่อเปลี่ยนหน้า (กันกรณี layout ต่างกัน)
  useLayoutEffect(() => {
    reflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function reflow() {
    const el = ref.current;
    if (!el) return;

    // ฐาน: 16px + safe-area ใน CSS (ใช้ผ่าน calc ข้างล่าง)
    let need = 16;

    // วัดขนาด FAB (เผื่ออนาคตอยากใช้)
    const fabRect = el.getBoundingClientRect();
    const fabHeight = fabRect.height || 48; // eslint-disable-line no-unused-vars

    // หา blockers ที่ "อยู่ล่างหน้าจอ" และ "กินพื้นที่ด้านซ้าย"
    const candidates = Array.from(document.querySelectorAll(BLOCKER_SELECTORS));

    const screenH = window.innerHeight;

    candidates.forEach((b) => {
      if (!b.isConnected || !b.offsetParent) return;
      const r = b.getBoundingClientRect();

      // พิจารณาเฉพาะสิ่งที่อยู่แถวล่าง ๆ และกินด้านซ้ายพอสมควร
      const nearBottom = r.top > screenH - 240;           // อยู่ในโซนล่าง 240px
      const touchesLeft = r.left < 220 || r.width > screenH * 0.6; // ชิดซ้ายหรือกว้างมาก
      if (!nearBottom || !touchesLeft) return;

      // ถ้า FAB (ที่มุมซ้ายล่าง) จะไปชน ให้ดันขึ้นเหนือ blocker + margin
      const margin = 12;
      const required = Math.max(0, screenH - r.top + margin);
      if (required > need) need = required;
    });

    // กันพุ่งสูงเกินไป (เช่น DOM แปลก ๆ )
    need = Math.min(need, screenH - 120);

    // อัปเดตเฉพาะเมื่อเปลี่ยนจริง ๆ
    setOffsetBottom((prev) => (Math.abs(prev - need) > 0.5 ? need : prev));
  }

  return (
    <Tooltip title="กลับหน้าหลัก" placement="right">
      <Fab
        ref={ref}
        variant="extended"
        color="primary"
        component={Link}
        to="/"
        sx={{
          position: 'fixed',
          left: 16,
          // รวม safe-area (iOS) เข้าไปด้วย
          bottom: `calc(${Math.round(offsetBottom)}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: (t) => t.zIndex.tooltip + 1,
          boxShadow: 6,
          // ป้องกันโดนคลิกทับง่าย ๆ
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: -4,
          },
        }}
      >
        <HomeRoundedIcon sx={{ mr: 1 }} />
        หน้าหลัก
      </Fab>
    </Tooltip>
  );
}