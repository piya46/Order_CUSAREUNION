import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function useOnlyInLine() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isLine = window.navigator.userAgent.includes("Line/");
    // อนุญาตเฉพาะหน้า /only-in-line ไม่งั้น redirect วนเอง
    if (!isLine && location.pathname !== "/only-in-line") {
      navigate('/only-in-line', { replace: true });
    }
  }, [navigate, location]);
}