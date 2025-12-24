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
import { keyframes } from "@emotion/react";

const API = import.meta.env.VITE_API_URL || "/api";

/* Animation เบาๆ */
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = `Admin Panel • Login`;
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // พื้นหลังสีเหลืองพาสเทล + gradient
        background: `radial-gradient(circle at 50% 10%, #FFECB3 0%, #FFFAE6 40%, #FFFFFF 100%)`,
        px: 2
      }}
    >
      {/* Background Decor */}
      <Box sx={{
          position: 'absolute', top: -100, right: -100, width: 400, height: 400, 
          bgcolor: '#FFD54F', borderRadius: '50%', opacity: 0.2, filter: 'blur(80px)' 
      }} />
      <Box sx={{
          position: 'absolute', bottom: -50, left: -50, width: 300, height: 300, 
          bgcolor: '#FFB300', borderRadius: '50%', opacity: 0.15, filter: 'blur(60px)' 
      }} />

      <Paper
        elevation={0}
        sx={{
          width: "100%", maxWidth: 420,
          borderRadius: 4,
          p: 5,
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 179, 0, 0.15)",
          boxShadow: "0 20px 40px rgba(255, 179, 0, 0.15)",
          textAlign: 'center'
        }}
      >
        <Box 
          component="img" 
          src="/logo.png" 
          alt="Logo"
          sx={{ 
            width: 120, 
            height: 'auto', 
            mb: 3,
            animation: `${float} 3s ease-in-out infinite`,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
          }} 
        />
        
        <Typography variant="h5" fontWeight={800} gutterBottom sx={{ color: '#212121' }}>
          ยินดีต้อนรับกลับมาครับ! 🐯
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 4 }}>
          เข้าสู่ระบบจัดการงานคืนสู่เหย้า
        </Typography>

        {err && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{err}</Alert>}

        <form onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="ชื่อผู้ใช้ (Username)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth
              autoFocus
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutline color="action" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 }
              }}
            />
            <TextField
              label="รหัสผ่าน (Password)"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(!showPw)} edge="end">
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 }
              }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              size="large"
              sx={{
                py: 1.5,
                borderRadius: 3,
                fontSize: '1.1rem',
                fontWeight: 800,
                boxShadow: '0 8px 20px rgba(255, 179, 0, 0.3)',
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "เข้าสู่ระบบ"}
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 4 }}>
            <Typography variant="caption" color="text.secondary">Admin Panel</Typography>
        </Divider>
      </Paper>
    </Box>
  );
}