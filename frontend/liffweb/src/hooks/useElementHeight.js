// วัดความสูง element จาก selector แบบ realtime (รองรับ iOS/Android/เดสก์ท็อป)
import { useEffect, useState } from 'react';

export default function useElementHeight(selector, fallback = 0) {
  const [h, setH] = useState(fallback);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const el = document.querySelector(selector);
    if (!el) { setH(fallback); return; }

    const read = () => {
      const rect = el.getBoundingClientRect?.();
      setH(rect?.height ? Math.round(rect.height) : (el.offsetHeight || fallback));
    };

    read();

    // ติดตามการเปลี่ยนแปลงด้วย ResizeObserver
    let ro;
    try {
      ro = new ResizeObserver(read);
      ro.observe(el);
    } catch { /* older browsers */ }

    window.addEventListener('orientationchange', read);
    window.addEventListener('resize', read);

    return () => {
      window.removeEventListener('orientationchange', read);
      window.removeEventListener('resize', read);
      try { ro?.disconnect(); } catch {}
    };
  }, [selector, fallback]);

  return h || fallback;
}