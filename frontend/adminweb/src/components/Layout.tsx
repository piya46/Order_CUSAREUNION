// src/components/Layout.tsx
import { useState, useMemo } from "react";
import { Box, CssBaseline, AppBar, Toolbar, IconButton, Typography, Avatar, Stack, Tooltip, Chip } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import SideNav, { SIDE_WIDTH } from "./SideNav";
import { useNavigate } from "react-router-dom";
import { adminLogout } from "../api/admin";
import { getUser as readUser, clearSession } from "../lib/session";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();
  const user = useMemo(() => readUser(), []);
  const name = user?.username || "admin";
  const initial = name?.[0]?.toUpperCase() || "A";

  const onLogout = async () => {
    try {
      await adminLogout();
    } catch {}
    clearSession();
    nav("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <CssBaseline />
      <SideNav variant="permanent" />
      <SideNav variant="temporary" mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)} />
      <AppBar
        position="fixed"
        sx={{
          ml: { md: `${SIDE_WIDTH}px` },
          width: { md: `calc(100% - ${SIDE_WIDTH}px)` },
          background: "linear-gradient(90deg, #07C160 0%, #2196f3 40%, #7c4dff 100%)"
        }}
      >
        <Toolbar>
          <IconButton aria-label="เปิดเมนู" color="inherit" edge="start" sx={{ mr: 1, display: { md: "none" } }} onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 800 }}>
            {import.meta.env.VITE_APP_NAME || "AdminWeb"}
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip size="small" label={import.meta.env.MODE?.toUpperCase()} color="default" sx={{ bgcolor: "rgba(255,255,255,.22)", color: "#fff" }} />
            <Tooltip title={name}>
              <Avatar sx={{ bgcolor: "rgba(255,255,255,.85)", color: "text.primary", fontWeight: 800 }}>{initial}</Avatar>
            </Tooltip>
            <IconButton aria-label="ออกจากระบบ" color="inherit" onClick={onLogout}><LogoutIcon /></IconButton>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          mt: { xs: 7, md: 8 },
          ml: { md: `${SIDE_WIDTH}px` },
          background:
            "radial-gradient(1200px 500px at 0% -10%, #e6fff2 0%, rgba(255,255,255,0) 60%), linear-gradient(135deg, #f7fafc 0%, #eef7ff 60%, #f7fff9 100%)",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}