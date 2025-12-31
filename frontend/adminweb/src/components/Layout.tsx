// frontend/adminweb/src/components/Layout.tsx
import { useState, useMemo, useEffect } from "react";
import { 
  Box, CssBaseline, AppBar, Toolbar, IconButton, Typography, Avatar, 
  Stack, Tooltip, Chip, useTheme, alpha, Divider, Badge, Menu, MenuItem, 
  ListItemIcon, ListItemText, Fade
} from "@mui/material";
import { useNavigate } from "react-router-dom";

// Icons
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsIcon from "@mui/icons-material/Notifications";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PaymentIcon from "@mui/icons-material/Payment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InventoryIcon from "@mui/icons-material/Inventory";

import SideNav, { SIDE_WIDTH } from "./SideNav";
import { adminLogout } from "../api/admin";
import { getUser as readUser, clearSession } from "../lib/session";
import { showConfirm, showSuccess } from "../lib/sweetalert"; 

const API = import.meta.env.VITE_API_URL || "/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();
  const theme = useTheme();
  const user = useMemo(() => readUser(), []);
  const name = user?.username || "admin";
  const initial = name?.[0]?.toUpperCase() || "A";

  // --- Notification Logic ---
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notis, setNotis] = useState<{type: 'slip'|'order'|'stock', count: number, label: string, path: string}[]>([]);
  const openNoti = Boolean(anchorEl);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("aw_token");
      if(!token) return;

      const resOrder = await fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      const orders = resOrder.ok ? await resOrder.json() : [];
      
      const pendingSlip = Array.isArray(orders) ? orders.filter((o:any) => o.paymentStatus === 'PENDING_PAYMENT').length : 0;
      const waitingPay = Array.isArray(orders) ? orders.filter((o:any) => o.paymentStatus === 'WAITING').length : 0;

      const resProd = await fetch(`${API}/products/inventory`, { headers: { Authorization: `Bearer ${token}` } });
      const products = resProd.ok ? await resProd.json() : [];
      let lowStockCount = 0;
      if (Array.isArray(products)) {
         products.forEach((p:any) => {
             if(!p.preorder) {
                 p.variants.forEach((v:any) => { if((v.stock || 0) <= 5) lowStockCount++; });
             }
         });
      }

      const newNotis: any[] = [];
      if (pendingSlip > 0) newNotis.push({ type: 'slip', count: pendingSlip, label: 'สลิปโอนเงินรอตรวจสอบ', path: '/orders?tab=PENDING_CHECK' });
      if (waitingPay > 0) newNotis.push({ type: 'order', count: waitingPay, label: 'ออเดอร์ใหม่ / รอโอน', path: '/orders?tab=WAITING_PAY' });
      if (lowStockCount > 0) newNotis.push({ type: 'stock', count: lowStockCount, label: 'สินค้าใกล้หมด / หมด', path: '/inventory?status=LOW' });

      setNotis(newNotis);

    } catch (e) { console.error("Noti fetch error", e); }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNotiClick = (path: string) => {
    setAnchorEl(null);
    nav(path);
  };

  const onLogout = async () => {
    const confirm = await showConfirm('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', 'ใช่, ออกจากระบบ');
    if (confirm) {
        try { await adminLogout(); } catch {}
        clearSession();
        nav("/login", { replace: true });
        showSuccess('ออกจากระบบสำเร็จ', 'ไว้พบกันใหม่ครับ 👋');
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: theme.palette.background.default }}>
      <CssBaseline />
      <SideNav variant="permanent" />
      <SideNav variant="temporary" mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)} />

      {/* Top Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          ml: { md: `${SIDE_WIDTH}px` },
          width: { md: `calc(100% - ${SIDE_WIDTH}px)` },
          bgcolor: alpha("#FFFFFF", 0.8),
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid",
          borderColor: "rgba(0,0,0,0.05)",
          color: "text.primary"
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" sx={{ mr: 2, display: { md: "none" } }} onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flex: 1, fontWeight: 800, color: 'primary.main', letterSpacing: 0.5 }}>
            ระบบจัดการจัดสั่งซื้อเสื้อ (Admin)
          </Typography>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {import.meta.env.MODE !== "production" && (
               <Chip size="small" label="DEV" color="warning" sx={{ fontWeight: "bold", borderRadius: 1 }} />
            )}
            
            <Tooltip title="การแจ้งเตือน">
              <IconButton 
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ 
                    color: notis.length > 0 ? 'warning.main' : 'text.secondary',
                    animation: notis.length > 0 ? 'pulse 2s infinite' : 'none'
                }}
              >
                 <Badge badgeContent={notis.reduce((a,b)=>a+b.count, 0)} color="error">
                    <NotificationsIcon />
                 </Badge>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={openNoti}
              onClose={() => setAnchorEl(null)}
              TransitionComponent={Fade}
              PaperProps={{
                elevation: 0,
                sx: { 
                  mt: 1.5, width: 320, overflow: 'visible', 
                  filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.1))',
                  '&:before': { content: '""', display: 'block', position: 'absolute', top: 0, right: 14, width: 10, height: 10, bgcolor: 'background.paper', transform: 'translateY(-50%) rotate(45deg)', zIndex: 0 },
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box px={2} py={1.5} borderBottom="1px solid #eee">
                  <Typography fontWeight={800}>รายการแจ้งเตือน</Typography>
              </Box>
              {notis.length === 0 ? (
                  <Box p={3} textAlign="center">
                      <CheckCircleIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">ไม่มีการแจ้งเตือนใหม่</Typography>
                  </Box>
              ) : (
                  notis.map((n, i) => (
                      <MenuItem key={i} onClick={() => handleNotiClick(n.path)} sx={{ py: 1.5 }}>
                          <ListItemIcon>
                              {n.type === 'slip' && <PaymentIcon color="warning" />}
                              {n.type === 'order' && <WarningAmberIcon color="info" />}
                              {n.type === 'stock' && <InventoryIcon color="error" />}
                          </ListItemIcon>
                          <ListItemText 
                              primary={n.label} 
                              secondary={`${n.count} รายการ`} 
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                          />
                          <Chip size="small" label={n.count} color="error" sx={{ height: 20, minWidth: 20, fontWeight: 700 }} />
                      </MenuItem>
                  ))
              )}
            </Menu>

            <Divider orientation="vertical" flexItem variant="middle" sx={{ mx: 1, height: 24, my: 'auto' }} />

            <Stack direction="row" spacing={1.5} alignItems="center">
               <Avatar sx={{ width: 40, height: 40, bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText, fontWeight: 800 }}>
                  {initial}
               </Avatar>
               <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>{user?.name || name}</Typography>
                  <Typography variant="caption" color="text.secondary">{user?.roles?.[0] || "Admin"}</Typography>
               </Box>
            </Stack>

            <Tooltip title="ออกจากระบบ">
              <IconButton onClick={onLogout} size="small" sx={{ ml: 1, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1) } }}>
                 <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, mt: { xs: 7, md: 8 }, ml: { md: `${SIDE_WIDTH}px` }, width: { md: `calc(100% - ${SIDE_WIDTH}px)` }, transition: "margin 0.3s ease" }}>
        {children}
      </Box>
      <style>{`@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`}</style>
    </Box>
  );
}