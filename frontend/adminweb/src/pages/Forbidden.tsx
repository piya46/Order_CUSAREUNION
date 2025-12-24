// src/pages/Forbidden.tsx
import { Box, Typography, Button, Container, Paper, Stack, alpha, Chip, useTheme } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { getUser, clearSession } from "../lib/session"; // สมมติว่ามี lib นี้ตามโค้ดก่อนหน้า

export default function Forbidden() {
  const theme = useTheme();
  const nav = useNavigate();
  const user = getUser(); // ดึงข้อมูล user จาก localStorage

  const handleLogout = () => {
    clearSession();
    nav("/login");
  };

  const copyUserId = () => {
    if (user?._id || user?.username) {
      navigator.clipboard.writeText(user.username || user._id);
      alert("คัดลอก User ID เรียบร้อย (ส่งให้ Admin ตรวจสอบได้เลย)");
    }
  };

  return (
    <Box 
      sx={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        bgcolor: "#FFFDF5", // พื้นหลังสีครีมอ่อนๆ
        p: 2
      }}
    >
      <Container maxWidth="sm">
        <Paper 
          elevation={0}
          sx={{ 
            p: 5, 
            borderRadius: 4, 
            textAlign: "center",
            border: "1px solid",
            borderColor: "rgba(0,0,0,0.05)",
            boxShadow: "0 10px 40px rgba(255, 179, 0, 0.15)",
            background: "linear-gradient(180deg, #FFFFFF 0%, #FFFCF2 100%)"
          }}
        >
          {/* Icon Animation */}
          <Box 
            sx={{ 
              width: 100, 
              height: 100, 
              borderRadius: "50%", 
              bgcolor: alpha(theme.palette.error.main, 0.1), 
              color: theme.palette.error.main,
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              mx: "auto",
              mb: 3,
              animation: "pulse 2s infinite"
            }}
          >
            <LockPersonIcon sx={{ fontSize: 50 }} />
          </Box>
          
          <Typography variant="h3" fontWeight={900} color="text.primary" gutterBottom sx={{ letterSpacing: -1 }}>
            403
          </Typography>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            อุ๊ปส์! เข้าไม่ได้ครับ 🐯🚫
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: "auto", lineHeight: 1.6 }}>
            ขออภัยครับ บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้ <br/>
            โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เพิ่มเติม
          </Typography>

          {/* User Info Section (เพื่อให้ Debug ง่าย) */}
          {user && (
            <Box 
                sx={{ 
                    bgcolor: alpha(theme.palette.warning.main, 0.1), 
                    p: 2, 
                    borderRadius: 2, 
                    mb: 4,
                    display: 'inline-block',
                    width: '100%'
                }}
            >
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    ขณะนี้คุณเข้าสู่ระบบในชื่อ
                </Typography>
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
                    <Typography fontWeight={700} variant="body1">
                        {user.username || "Unknown"}
                    </Typography>
                    {user.roles && (
                        <Chip label={user.roles[0] || "No Role"} size="small" color="warning" variant="outlined" />
                    )}
                </Stack>
                <Button 
                    size="small" 
                    startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />} 
                    sx={{ mt: 1, fontSize: '0.75rem', color: 'text.secondary' }}
                    onClick={copyUserId}
                >
                    คัดลอก ID ให้ Admin
                </Button>
            </Box>
          )}

          {/* Actions */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button 
              variant="outlined" 
              size="large" 
              startIcon={<LogoutIcon />} 
              onClick={handleLogout}
              sx={{ borderRadius: 3, px: 3, borderColor: 'divider', color: 'text.secondary' }}
            >
              ออกจากระบบ
            </Button>
            <Button 
              variant="contained" 
              size="large" 
              component={Link} 
              to="/" 
              startIcon={<HomeIcon />}
              sx={{ borderRadius: 3, px: 4, fontWeight: 700, boxShadow: theme.shadows[3] }}
            >
              กลับหน้าหลัก
            </Button>
          </Stack>

        </Paper>
      </Container>
      
      {/* CSS Animation for Pulse Effect */}
      <style>
        {`
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.4); }
            70% { box-shadow: 0 0 0 20px rgba(229, 57, 53, 0); }
            100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0); }
          }
        `}
      </style>
    </Box>
  );
}