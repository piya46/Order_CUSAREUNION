// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Stack, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, CircularProgress, Divider
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonOutline from "@mui/icons-material/PersonOutline";
import LockOutlined from "@mui/icons-material/LockOutlined";
import BoltIcon from "@mui/icons-material/Bolt";
import { keyframes } from "@emotion/react";

const API = import.meta.env.VITE_API_URL || "/api";

/* ------------------------ fancy animations ------------------------ */
const float = keyframes`
  0%   { transform: translate3d(0, 0, 0) }
  50%  { transform: translate3d(0, -12px, 0) }
  100% { transform: translate3d(0, 0, 0) }
`;
const drift = keyframes`
  0%   { transform: translate3d(0,0,0) rotate(0deg) }
  100% { transform: translate3d(var(--dx, 40px), var(--dy, -20px), 0) rotate(8deg) }
`;
const spin = keyframes`
  from { transform: rotate(0deg) }
  to   { transform: rotate(360deg) }
`;
const orbit = keyframes`
  from { transform: rotate(0deg) }
  to   { transform: rotate(360deg) }
`;
const shake = keyframes`
  0%,100% { transform: translateX(0) }
  15% { transform: translateX(-6px) }
  30% { transform: translateX(6px) }
  45% { transform: translateX(-5px) }
  60% { transform: translateX(5px) }
  75% { transform: translateX(-3px) }
  90% { transform: translateX(3px) }
`;

/* ------------------------ Atom SVG component ------------------------ */
type AtomProps = {
  size?: number;
  top?: string | number;
  left?: string | number;
  right?: string | number;
  bottom?: string | number;
  opacity?: number;
  delay?: number;
  duration?: number;
  hue?: number; // สีปรับโทน
};
function Atom({
  size = 120,
  top,
  left,
  right,
  bottom,
  opacity = 0.6,
  delay = 0,
  duration = 14,
  hue = 200
}: AtomProps) {
  return (
    <Box
      sx={{
        position: "absolute",
        top, left, right, bottom,
        opacity,
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,.18))",
        animation: `${drift} ${duration}s ease-in-out ${delay}s infinite alternate`,
        // random-ish drift vector (CSS var)
        "--dx": `${Math.random() * 80 - 40}px`,
        "--dy": `${Math.random() * 50 - 25}px`,
      } as any}
    >
      <Box
        sx={{
          width: size, height: size,
          color: `hsl(${hue} 80% 50%)`,
          animation: `${spin} ${duration * 0.9}s linear infinite`
        }}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          {/* nucleus */}
          <g>
            <radialGradient id="nucleus" cx="50%" cy="50%">
              <stop offset="0%" stopColor={`hsl(${hue} 90% 60%)`} />
              <stop offset="100%" stopColor={`hsl(${hue} 80% 45%)`} />
            </radialGradient>
            <circle cx="50" cy="50" r="8" fill="url(#nucleus)">
              <animate attributeName="r" values="7;8;7" dur="3s" repeatCount="indefinite"/>
            </circle>
          </g>

          {/* 3 orbits with little electrons */}
          {[
            { rx: 30, ry: 14, rot: 0,   speed: 6.5 },
            { rx: 30, ry: 14, rot: 60,  speed: 5.8 },
            { rx: 30, ry: 14, rot: 120, speed: 7.2 },
          ].map((o, i) => (
            <g
              key={i}
              style={{
                transformOrigin: "50px 50px",
                animation: `${orbit} ${o.speed}s linear infinite`
              } as any}
            >
              <ellipse
                cx="50" cy="50"
                rx={o.rx} ry={o.ry}
                transform={`rotate(${o.rot},50,50)`}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.35"
                strokeWidth="1.2"
              />
              {/* electron */}
              <circle
                cx={50}
                cy={50 - o.ry}
                r="2.3"
                transform={`rotate(${o.rot},50,50)`}
                fill="currentColor"
              />
            </g>
          ))}
        </svg>
      </Box>
    </Box>
  );
}

/* ----------------------------- Login ----------------------------- */
export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doShake, setDoShake] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    setDoShake(false);
    try {
      // เคลียร์ทุกอย่างก่อน login ใหม่ (ตาม requirement)
      localStorage.clear();

      const res = await fetch(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");

      localStorage.setItem("aw_token", data.token);
      localStorage.setItem("aw_user", JSON.stringify(data.user || {}));

      nav("/");
    } catch (e: any) {
      setErr(e?.message || "ไม่สามารถเข้าสู่ระบบได้");
      setDoShake(true);
      // reset shake after a moment so it can retrigger next time
      setTimeout(() => setDoShake(false), 700);
    } finally {
      setLoading(false);
    }
  };

  // ปรับ title เล็กน้อยให้ฟีลมีชีวิต
  useEffect(() => {
    document.title = `${import.meta.env.VITE_APP_NAME || "AdminWeb"} • Login`;
  }, []);

  const appName = import.meta.env.VITE_APP_NAME || "AdminWeb";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2, py: 4,
        // multi-layer background
        background:
          `radial-gradient(1200px 500px at 0% -10%, rgba(0,255,171,.18) 0%, rgba(255,255,255,0) 60%),
           radial-gradient(900px 380px at 110% 0%, rgba(2,132,199,.18) 0%, rgba(255,255,255,0) 60%),
           linear-gradient(135deg, #f7fafc 0%, #eef7ff 60%, #f7fff9 100%)`,
        overflow: "hidden"
      }}
    >
      {/* animated atoms floating around */}
      <Atom size={150} top="8%"  left="6%"  delay={0.2} duration={16} hue={195} opacity={0.55}/>
      <Atom size={110} top="18%" right="8%" delay={1.1} duration={13} hue={160} opacity={0.45}/>
      <Atom size={140} bottom="10%" left="10%" delay={0.6} duration={18} hue={220} opacity={0.5}/>
      <Atom size={120} bottom="14%" right="12%" delay={0.0} duration={15} hue={265} opacity={0.42}/>

      {/* glow blobs */}
      <Box sx={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background:
          "radial-gradient(600px 200px at 12% 80%, rgba(7,193,96,.12), transparent 60%), radial-gradient(550px 240px at 90% 15%, rgba(25,118,210,.12), transparent 60%)",
        mixBlendMode: "soft-light"
      }}/>

      {/* card */}
      <Paper
        elevation={0}
        sx={{
          width: "100%", maxWidth: 460,
          borderRadius: 5,
          p: 3,
          backdropFilter: "blur(10px)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.60))",
          border: "1px solid rgba(2,132,199,.15)",
          boxShadow:
            "0 10px 30px rgba(2,132,199,.10), 0 6px 18px rgba(7,193,96,.08)",
          animation: doShake ? `${shake} .55s ease` : "none"
        }}
      >
        <Stack spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
          {/* mini atom badge */}
          <Box
            sx={{
              width: 58, height: 58, borderRadius: "50%",
              display: "grid", placeItems: "center",
              background: "linear-gradient(135deg, #00c2ff 0%, #00ffa2 100%)",
              boxShadow: "0 10px 22px rgba(0,194,255,.30)",
              animation: `${float} 5s ease-in-out infinite`
            }}
          >
            <BoltIcon sx={{ color: "#fff" }} />
          </Box>
          <Typography variant="h5" fontWeight={900} textAlign="center">
            {appName}
          </Typography>
          <Typography color="text.secondary" textAlign="center" sx={{ mt: -0.5 }}>
            ระบบจัดการระบบจัดซื้อออนไลน์
          </Typography>
        </Stack>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <form onSubmit={onSubmit} autoComplete="on">
          <Stack spacing={1.5}>
            <TextField
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth
              autoFocus
              required 
              autoComplete="username"
              inputProps={{
                onInvalid: e => e.currentTarget.setCustomValidity('กรุณากรอกชื่อผู้ใช้'),
                onInput:  e => e.currentTarget.setCustomValidity(''),
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline sx={{ opacity: .7 }} />
                  </InputAdornment>
                )
              }}
            />
            <TextField
              label="Password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              inputProps={{
                onInvalid: e => e.currentTarget.setCustomValidity('กรุณากรอกรหัสผ่าน'),
                onInput:  e => e.currentTarget.setCustomValidity(''),
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ opacity: .7 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(v => !v)} edge="end" aria-label="toggle password visibility">
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                mt: 0.5, py: 1.2, borderRadius: 2.5, fontWeight: 900, letterSpacing: .2,
                background: "linear-gradient(90deg, #1976d2 0%, #00c2ff 50%, #00ffa2 100%)",
                backgroundSize: "200% 100%",
                transition: "transform .15s ease, box-shadow .2s ease, background-position .6s ease",
                boxShadow: "0 10px 24px rgba(25,118,210,.25)",
                "&:hover": {
                  transform: "translateY(-1px)",
                  backgroundPosition: "100% 0",
                  boxShadow: "0 14px 30px rgba(0,194,255,.30)"
                }
              }}
              fullWidth
            >
              {loading ? (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <CircularProgress size={18} sx={{ color: "#fff" }} />
                  <span>กำลังเข้าสู่ระบบ…</span>
                </Stack>
              ) : "เข้าสู่ระบบ"}
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          Tip: กด <b>Enter</b> เพื่อเข้าสู่ระบบอย่างรวดเร็ว
        </Typography>
      </Paper>
    </Box>
  );
}