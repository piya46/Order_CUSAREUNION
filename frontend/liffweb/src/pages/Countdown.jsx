import { useEffect, useState } from "react";

// ฟังก์ชันช่วยแปลง ms เป็น hh:mm:ss
function formatCountdown(ms) {
  if (ms <= 0) return "หมดเวลา";
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 1000 / 60) % 60;
  const hr = Math.floor(ms / 1000 / 60 / 60);
  return `${hr > 0 ? hr + " ชั่วโมง " : ""}${min} นาที ${sec} วินาที`;
}

// Component สำหรับแสดง countdown
export function Countdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState(targetDate - Date.now());
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(targetDate - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate, timeLeft]);
  return (
    <span>
      {formatCountdown(timeLeft)}
    </span>
  );
}