// frontend/adminweb/src/pages/Dashboard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Grid, Paper, Stack, Typography, Chip, Skeleton, Button,
  Alert, Tooltip, IconButton, LinearProgress, List, ListItem, ListItemText, ListItemButton, Fade,
  Backdrop, CircularProgress, ButtonBase, alpha, useTheme
} from "@mui/material";

// Icons
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import CategoryIcon from "@mui/icons-material/Category";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SecurityIcon from "@mui/icons-material/Security";
import BugReportIcon from "@mui/icons-material/BugReport";
import ArticleIcon from "@mui/icons-material/Article";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import StoreIcon from "@mui/icons-material/Store";

import { Link } from "react-router-dom";
import { getToken, getUser } from "../lib/session"; // [แก้ไข] ใช้ getUser เพื่อดึงชื่อ
import { parseJwt, type AdminClaims } from "../lib/jwt";
import { showLoading, showError, swal } from "../lib/sweetalert"; 

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { motion } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "/api";

// --- Types ---
type Order = {
  _id: string;
  orderNo: string;
  customerName: string;
  totalAmount: number;
  paymentStatus: "WAITING" | "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "REJECTED" | "EXPIRED";
  orderStatus: "RECEIVED" | "PREPARING_ORDER" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  trackingNumber?: string;
  slipReviewCount?: number;
  expiredAt?: string;
  createdAt: string;
};

// --- Helpers ---
function hasPerm(p: string) {
  try {
    const u = getUser(); 
    return Array.isArray(u.permissions) && u.permissions.includes(p);
  } catch { return false; }
}

function getExpMsFromToken(): number | null {
  const claims = parseJwt<AdminClaims>(getToken());
  return claims?.exp ? claims.exp * 1000 : null;
}

// --- Components ---
const Greeting = ({ user }: { user: any }) => {
  const hour = new Date().getHours();
  let text = "สวัสดีครับ";
  let icon = "🐯"; 
  if (hour < 12) { text = "อรุณสวัสดิ์"; icon = "🌤️"; }
  else if (hour < 18) { text = "สวัสดีตอนบ่าย"; icon = "☀️"; }
  else { text = "สวัสดีตอนเย็น"; icon = "🌙"; }

  // [แก้ไข] การดึงชื่อแสดงผล: ชื่อจริง -> ชื่อผู้ใช้ -> 'Admin'
  const displayName = user?.name || user?.username || "Admin";

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
             <Typography variant="h4" fontWeight={900} sx={{ color: '#212121' }}>
                {icon} {text}, คุณ{displayName}!
            </Typography>
        </Stack>
        <Typography color="text.secondary" fontWeight={500}>
            วันนี้มีอะไรให้พี่เสือช่วยดูแลไหมครับ? 🐅
        </Typography>
    </motion.div>
  );
};

export default function Dashboard() {
  const theme = useTheme();
  
  // [1] Data State เริ่มต้นเป็น null (เพื่อบอกว่ายังไม่โหลด)
  const [orders, setOrders] = useState<Order[] | null>(null); 
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  // Timer State
  const [leftMs, setLeftMs] = useState<number | null>(() => {
    const expMs = getExpMsFromToken();
    return expMs ? expMs - Date.now() : null;
  });

  const abortRef = useRef<AbortController | null>(null);

  const load = async (isManual = false) => {
    setErr(null);
    setLoading(true); // Always set loading to true at start
    
    // ถ้าเป็นการกดปุ่มรีเฟรชเอง ให้โชว์ Popup
    // if (isManual) showLoading("กำลังโหลดข้อมูลล่าสุด..."); // Remove manual popup since backdrop covers it

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Simulate delay to show loading state
      await new Promise(r => setTimeout(r, 500));

      const res = await fetch(`${API}/orders`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        signal: ac.signal
      });

      if (!res.ok) throw new Error((await res.json())?.error || "โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      
      setOrders(Array.isArray(data) ? data : []);
      
      if (isManual) swal.close();

    } catch (e: any) {
      if (e?.name !== "AbortError") {
        const msg = e?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล";
        setErr(msg);
        
        // ถ้าโหลดไม่ผ่านแต่เป็นครั้งแรก ให้เซ็ตเป็น array ว่างเพื่อให้หน้าเว็บแสดงผลได้
        if(orders === null) setOrders([]); 
        
        if (isManual) showError("โหลดข้อมูลไม่สำเร็จ", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false); 
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(false); }, 30000);
    const onVis = () => { if (document.visibilityState === "visible") load(false); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); abortRef.current?.abort(); };
  }, []);

  // Shortcut Key: R to Refresh
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        load(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Session Timer
  useEffect(() => {
    const t = setInterval(() => {
      const expMs = getExpMsFromToken();
      if (!expMs) return setLeftMs(null);
      setLeftMs(Math.max(0, expMs - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // --- Statistics Logic ---
  const kpi = useMemo(() => {
    const list = orders || [];
    const total = list.length;
    const pending = list.filter(o => ["WAITING","PENDING_PAYMENT","REJECTED"].includes(o.paymentStatus)).length;
    const shipping = list.filter(o => o.orderStatus === "SHIPPING").length;
    const done = list.filter(o => o.orderStatus === "COMPLETED").length;
    const revenue = list
      .filter(o => o.paymentStatus === "PAYMENT_CONFIRMED")
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const latest = [...list].sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);
    return { total, pending, shipping, done, revenue, latest };
  }, [orders]);

  const attention = useMemo(() => {
    const list = orders || [];
    const now = Date.now();
    const expSoon = list.filter((o:any) => {
      if (o.paymentStatus !== "WAITING") return false;
      const d = o.expiredAt ? new Date(o.expiredAt).getTime() : null;
      return d ? (d - now) < 10 * 60 * 1000 && (d - now) > 0 : false;
    });
    const slipWarn = list.filter((o:any) => (o.slipReviewCount || 0) >= 2 && o.paymentStatus !== 'PAYMENT_CONFIRMED');
    const shipNoTn = list.filter(o => o.orderStatus === 'SHIPPING' && !o.trackingNumber);
    return { expSoon, slipWarn, shipNoTn };
  }, [orders]);

  const series = useMemo(() => {
    const byDay: Record<string, number> = {};
    const ok = (orders || []).filter(o => o.paymentStatus === "PAYMENT_CONFIRMED");
    ok.forEach(o => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
      byDay[key] = (byDay[key] || 0) + (o.totalAmount || 0);
    });
    const arr: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
      arr.push({ label: key, value: byDay[key] || 0 });
    }
    return arr;
  }, [orders]);

  const mode = import.meta.env.MODE?.toUpperCase() || "DEV";
  const leftSec = leftMs != null ? Math.ceil(leftMs / 1000) : null;
  const mm = leftSec != null ? Math.floor(leftSec / 60) : null;
  const ss = leftSec != null ? (leftSec % 60).toString().padStart(2, "0") : null;

  // เมนูด่วนพร้อมสีและพื้นหลัง
  const menuShortcuts = [
    hasPerm("order:manage") && { to: "/orders", icon: <ReceiptLongIcon />, label: "จัดการออเดอร์", color: theme.palette.primary.main, bg: alpha(theme.palette.primary.main, 0.1) },
    hasPerm("product:manage") && { to: "/products", icon: <CategoryIcon />, label: "จัดการสินค้า", color: theme.palette.secondary.main, bg: alpha(theme.palette.secondary.main, 0.1) },
    hasPerm("po:manage") && { to: "/po", icon: <ArticleIcon />, label: "ใบสั่งซื้อ (PO)", color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.1) },
    hasPerm("po:manage") && { to: "/suppliers", icon: <StoreIcon />, label: "ข้อมูลผู้ขาย", color: theme.palette.info.main, bg: alpha(theme.palette.info.main, 0.1) },
    hasPerm("receiving:manage") && { to: "/receiving", icon: <WarehouseIcon />, label: "รับสินค้าเข้า", color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.1) },
    hasPerm("user:manage") && { to: "/users", icon: <PeopleAltIcon />, label: "ผู้ใช้งานระบบ", color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.1) },
    hasPerm("role:manage") && { to: "/roles", icon: <SecurityIcon />, label: "สิทธิ์การใช้งาน", color: theme.palette.text.secondary, bg: alpha(theme.palette.text.secondary, 0.1) },
    hasPerm("issue:manage") && { to: "/issues", icon: <BugReportIcon />, label: "แจ้งปัญหา", color: theme.palette.error.dark, bg: alpha(theme.palette.error.dark, 0.1) },
  ].filter(Boolean) as any[];

  return (
    <Box p={{ xs: 2, md: 3 }} sx={{ borderRadius: 3 }}>
      
      {/* [2] Backdrop สำหรับการโหลดทุกครั้ง */}
      <Backdrop
        sx={{ 
            color: '#fff', 
            zIndex: (theme) => theme.zIndex.drawer + 1,
            flexDirection: 'column',
            gap: 2,
            bgcolor: 'rgba(255, 255, 255, 0.9)', // พื้นหลังขาวจางๆ
            backdropFilter: 'blur(4px)'
        }}
        open={loading} // แสดงเมื่อ loading = true ทุกครั้ง
      >
        <CircularProgress color="primary" size={60} thickness={4} />
        <Typography variant="h6" color="text.primary" fontWeight={700}>
            กำลังเตรียมข้อมูล Dashboard...
        </Typography>
        <Typography variant="body2" color="text.secondary">
            กรุณารอสักครู่ พี่เสือกำลังรวบรวมข้อมูลให้อยู่ครับ 🐅
        </Typography>
      </Backdrop>

      {/* [3] LinearProgress สำหรับการโหลดเบื้องหลัง (Background Refresh) */}
      <Fade in={loading && orders !== null} unmountOnExit>
        <LinearProgress 
            sx={{ 
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000, 
                height: 3, bgcolor: alpha(theme.palette.primary.main, 0.2), 
                '& .MuiLinearProgress-bar': { bgcolor: theme.palette.primary.main } 
            }} 
        />
      </Fade>

      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h5" fontWeight={900} color="primary.dark">Dashboard</Typography>
          <Chip size="small" label={mode} color={mode === "PROD" ? "success" : "warning"} />
          <Tooltip title="รีเฟรชข้อมูล">
            <IconButton onClick={() => load(true)} size="small" sx={{ bgcolor: 'white', boxShadow: 1 }}>
                <RefreshIcon color={loading ? "disabled" : "action"} sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Stack>
        {leftSec != null && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">เซสชันหมดอายุใน</Typography>
            <Chip size="small" color="error" label={`${mm}:${ss}`} variant="outlined" />
          </Stack>
        )}
      </Stack>

      {/* [4] เรียกใช้งาน Greeting โดยส่ง getUser() เพื่อให้ได้ชื่อจริง */}
      <Greeting user={getUser()} />

      {err && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{err}</Alert>}

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {/* KPI Cards */}
            {[
                { label: "ออเดอร์ทั้งหมด", icon: <ReceiptLongIcon />, val: kpi.total, color: "text.primary" },
                { label: "รอตรวจ/แก้ไข", icon: <WarningAmberIcon sx={{color: '#FF8F00'}} />, val: kpi.pending, color: "#FF8F00" },
                { label: "กำลังจัดส่ง", icon: <LocalShippingIcon color="info" />, val: kpi.shipping, color: "info.main" },
                { label: "สำเร็จแล้ว", icon: <TaskAltIcon color="success" />, val: kpi.done, color: "success.main" }
            ].map((k, i) => (
                <Grid item xs={6} md={3} key={i}>
                    <Paper 
                        elevation={0}
                        sx={{ 
                            p: 2.5, height: '100%', bgcolor: 'white', border: '1px solid', borderColor: 'divider',
                            transition: 'all 0.2s', 
                            '&:hover': { 
                                transform: 'translateY(-4px)', 
                                borderColor: theme.palette.primary.main, 
                                boxShadow: '0 8px 24px rgba(0,0,0,0.08)' 
                            }
                        }}
                    >
                        <Stack spacing={1.5}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>{k.label}</Typography>
                                {k.icon}
                            </Stack>
                            <Typography variant="h4" fontWeight={800} sx={{ color: k.color }}>
                                {(loading && orders === null) ? <Skeleton width="60%" /> : k.val.toLocaleString()}
                            </Typography>
                        </Stack>
                    </Paper>
                </Grid>
            ))}

            {/* Chart */}
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 4, height: 380, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" mb={3}>
                    <Typography variant="h6" fontWeight={800}>📈 ยอดขาย 7 วันล่าสุด</Typography>
                    <Chip label={`รวม ฿${kpi.revenue.toLocaleString()}`} color="primary" sx={{ fontWeight: 800 }} />
                </Stack>
                <Box height={280}>
                  {(loading && orders === null) ? (
                    <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 2 }} />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="label" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                            formatter={(value: any) => [`฿${(value || 0).toLocaleString()}`, 'ยอดขาย']}
                        />
                        <Area type="monotone" dataKey="value" stroke={theme.palette.primary.main} strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Action Required */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                    <WarningAmberIcon sx={{ color: '#FF8F00' }} />
                    <Typography fontWeight={800} color="#FF8F00">ต้องดูแลด่วน</Typography>
                </Stack>
                {(loading && orders === null) ? <Skeleton height={100} sx={{ borderRadius: 2 }}/> : (
                    <Stack spacing={1}>
                        <Chip size="small" label={`รอชำระใกล้หมดเวลา: ${attention.expSoon.length}`} sx={{ bgcolor: 'white', fontWeight: 600, justifyContent: 'flex-start' }} icon={attention.expSoon.length > 0 ? <WarningAmberIcon fontSize="small"/> : undefined} />
                        <Chip size="small" label={`สลิปมีปัญหา: ${attention.slipWarn.length}`} sx={{ bgcolor: 'white', fontWeight: 600, justifyContent: 'flex-start' }} />
                        <Chip size="small" label={`ไม่มีเลขพัสดุ: ${attention.shipNoTn.length}`} sx={{ bgcolor: 'white', fontWeight: 600, justifyContent: 'flex-start' }} />
                    </Stack>
                )}
            </Paper>

            {/* Quick Menu */}
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Typography fontWeight={800} mb={2}>🚀 เมนูด่วน</Typography>
                <Grid container spacing={1.5}>
                {menuShortcuts.map((m) => (
                    <Grid item xs={6} key={m.to}>
                        <ButtonBase
                            component={Link}
                            to={m.to}
                            sx={{
                                width: '100%',
                                p: 1.5,
                                borderRadius: 3,
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                    bgcolor: alpha(m.color, 0.05),
                                    borderColor: m.color,
                                    transform: 'translateY(-2px)',
                                    boxShadow: `0 4px 12px ${alpha(m.color, 0.2)}`
                                }
                            }}
                        >
                            <Box 
                                sx={{ 
                                    p: 1, 
                                    borderRadius: '50%', 
                                    bgcolor: m.bg, 
                                    color: m.color,
                                    display: 'flex'
                                }}
                            >
                                {m.icon}
                            </Box>
                            <Typography variant="caption" fontWeight={700} color="text.primary">
                                {m.label}
                            </Typography>
                        </ButtonBase>
                    </Grid>
                ))}
                </Grid>
            </Paper>

            {/* Recent Orders List */}
            <Paper elevation={0} sx={{ p: 0, border: '1px solid', borderColor: 'divider', overflow: 'hidden', borderRadius: 3 }}>
                <Box p={2} bgcolor="#FAFAFA" borderBottom="1px solid #EEE">
                    <Typography fontWeight={800}>🛒 ออเดอร์ล่าสุด</Typography>
                </Box>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                   {(loading && orders === null) ? (
                    <Box p={2}>
                      <Skeleton height={40} /><Skeleton height={40} /><Skeleton height={40} />
                    </Box>
                    ) : kpi.latest.map(o => (
                        <ListItem key={o._id} disablePadding divider>
                            <ListItemButton component={Link} to={`/orders/${o._id}`}>
                              <ListItemText
                                  primary={<Stack direction="row" spacing={1} alignItems="center">
                                      <Typography fontWeight={700} fontSize="0.9rem">{o.orderNo}</Typography>
                                      <Chip size="small" label={o.orderStatus} sx={{ height: 20, fontSize: '0.65rem' }} />
                                  </Stack>}
                                  secondary={`${o.customerName} • ฿${o.totalAmount.toLocaleString()}`}
                              />
                              <ArrowForwardIcon fontSize="small" color="action" />
                            </ListItemButton>
                        </ListItem>
                    ))}
                    {(!loading || orders !== null) && kpi.latest.length === 0 && <Box p={2} textAlign="center" color="text.secondary">ไม่มีข้อมูล</Box>}
                </List>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}