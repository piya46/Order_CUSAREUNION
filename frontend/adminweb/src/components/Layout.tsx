import { useState, useMemo } from "react";
import { Box, CssBaseline, AppBar, Toolbar, IconButton, Typography, Avatar, Stack, Tooltip, Chip, useTheme, alpha } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SideNav, { SIDE_WIDTH } from "./SideNav";
import { useNavigate } from "react-router-dom";
import { adminLogout } from "../api/admin";
import { getUser as readUser, clearSession } from "../lib/session";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();
  const theme = useTheme();
  const user = useMemo(() => readUser(), []);
  const name = user?.username || "admin";
  const initial = name?.[0]?.toUpperCase() || "A";

  const onLogout = async () => {
    try { await adminLogout(); } catch {}
    clearSession();
    nav("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f4f6f8" }}>
      <CssBaseline />
      
      {/* Sidebar Navigation */}
      <SideNav variant="permanent" />
      <SideNav variant="temporary" mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)} />

      {/* Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          ml: { md: `${SIDE_WIDTH}px` },
          width: { md: `calc(100% - ${SIDE_WIDTH}px)` },
          bgcolor: alpha("#ffffff", 0.9), // Glassmorphism effect
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid",
          borderColor: "divider",
          color: "text.primary"
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            sx={{ mr: 2, display: { md: "none" } }}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, letterSpacing: -0.5, bgclip: "text" }}>
            {import.meta.env.VITE_APP_NAME || "Admin Panel"}
          </Typography>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {import.meta.env.MODE !== "production" && (
               <Chip size="small" label="DEV" color="warning" sx={{ fontWeight: "bold", borderRadius: 1 }} />
            )}
            
            <IconButton size="small" sx={{color: 'text.secondary'}}>
               <NotificationsIcon />
            </IconButton>

            <Divider orientation="vertical" flexItem variant="middle" sx={{mx:1}} />

            <Stack direction="row" spacing={1} alignItems="center">
               <Avatar 
                  sx={{ 
                     width: 36, height: 36, 
                     bgcolor: theme.palette.primary.main, 
                     fontSize: '0.9rem',
                     fontWeight: 700,
                     boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
               >
                  {initial}
               </Avatar>
               <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>{name}</Typography>
                  <Typography variant="caption" color="text.secondary">Admin</Typography>
               </Box>
            </Stack>

            <Tooltip title="ออกจากระบบ">
              <IconButton color="error" onClick={onLogout} size="small" sx={{ ml: 1, bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                 <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          mt: { xs: 7, md: 8 },
          ml: { md: `${SIDE_WIDTH}px` },
          width: { md: `calc(100% - ${SIDE_WIDTH}px)` },
          transition: "margin 0.3s ease",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

import { Divider } from "@mui/material";