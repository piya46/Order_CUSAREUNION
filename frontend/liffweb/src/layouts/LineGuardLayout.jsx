// import { useEffect } from "react";
// import { useLiff } from "../context/LiffContext";
// import { useNavigate } from "react-router-dom";
// import { Outlet } from "react-router-dom";

// export default function LineGuardLayout() {
//   const { isInClient } = useLiff();
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (isInClient === false) {
//       // ถ้าไม่ได้เปิดใน LINE ให้ redirect
//       navigate('/only-in-line', { replace: true });
//     }
//     // ถ้าเป็น undefined คือยัง loading รอให้ useLiff ตอบก่อน
//   }, [isInClient, navigate]);

//   // ยัง loading => return อะไรก็ได้ หรือ Loader
//   if (isInClient === undefined) return null;

//   // ถ้าเปิดในไลน์ถึงจะแสดง children
//   return <Outlet />;
// }


import { useLiff } from '../context/LiffContext';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function LineGuardLayout({ children }) {
  const { ready } = useLiff();
  const location = useLocation();
  const navigate = useNavigate();

  // ตรวจว่าเปิดในไลน์จริงมั้ย
  const isInLineApp = /Line/i.test(navigator.userAgent);

  useEffect(() => {
    if (ready && !isInLineApp) {
      // redirect ไปหน้าห้ามใช้งาน
      navigate('/only-in-line', { replace: true, state: { from: location } });
    }
  }, [ready, isInLineApp, navigate, location]);

  if (!ready) return <div>Loading...</div>;
  if (!isInLineApp) return null; // จะ redirect แล้ว

  return children;
}