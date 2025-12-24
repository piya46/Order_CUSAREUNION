import { useEffect, useState } from 'react';

// ตรวจว่าคีย์บอร์ดบนมือถือเปิดอยู่ไหม (เน้น iOS Safari/LINE)
export default function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    let base = vv?.height || window.innerHeight;

    const onChange = () => {
      const now = vv?.height || window.innerHeight;
      if (!base) base = now;
      // ถ้าความสูงลดลงเกิน ~150px ให้ถือว่ามีคีย์บอร์ด
      setOpen(base - now > 150);
    };

    const onFocusIn = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') onChange();
    };
    const onFocusOut = () => onChange();

    vv?.addEventListener('resize', onChange);
    window.addEventListener('resize', onChange);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);

    return () => {
      vv?.removeEventListener('resize', onChange);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return open;
}