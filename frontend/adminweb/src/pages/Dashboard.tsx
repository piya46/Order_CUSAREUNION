import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Grid, Paper, Stack, Typography, Chip, Divider, Skeleton, Button,
  Alert, Tooltip, IconButton, LinearProgress, List, ListItem, ListItemText, ListItemIcon
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddBoxIcon from "@mui/icons-material/AddBox";
import MoveDownIcon from "@mui/icons-material/MoveDown";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CategoryIcon from "@mui/icons-material/Category";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import SecurityIcon from "@mui/icons-material/Security";
import BugReportIcon from "@mui/icons-material/BugReport";
import ArticleIcon from "@mui/icons-material/Article";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link } from "react-router-dom";
import { getToken } from "../lib/session";
import { parseJwt, type AdminClaims } from "../lib/jwt";
import { alpha } from "@mui/material/styles";

// ✅ Import Recharts & Framer Motion
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { motion } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "/api";

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

type UserPayload = {
  username?: string;
  roles?: string[];
  permissions?: string[];
  name?: string; // เพิ่ม name เพื่อใช้ใน Greeting
};

function hasPerm(p: string) {
  try {
    const u: UserPayload = JSON.parse(localStorage.getItem("aw_user") || "{}");
    return Array.isArray(u.permissions) && u.permissions.includes(p);
  } catch { return false; }
}
function getExpMsFromToken(): number | null {
  const claims = parseJwt<AdminClaims>(getToken());
  return claims?.exp ? claims.exp * 1000 : null;
}

// ✅ Greeting Component
const Greeting = ({ user }: { user: any }) => {
  const hour = new Date().getHours();
  let text = "สวัสดีครับ";
  let icon = "👋";
  if (hour < 12) { text = "อรุณสวัสดิ์"; icon = "☕"; }
  else if (hour < 18) { text = "สวัสดีตอนบ่าย"; icon = "☀️"; }
  else { text = "สวัสดีตอนเย็น"; icon = "🌙"; }

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <Typography variant="h4" fontWeight={900} gutterBottom>
            {icon} {text}, {user?.name || "Admin"}!
        </Typography>
        <Typography color="text.secondary">
            ภาพรวมระบบและการขายของคุณวันนี้
        </Typography>
    </motion.div>
  );
};

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // session countdown
  const [leftMs, setLeftMs] = useState<number | null>(() => {
    const expMs = getExpMsFromToken();
    return expMs ? expMs - Date.now() : null;
  });

  const abortRef = useRef<AbortController | null>(null);

  const load = async () => {
    setErr(null);
    setLoading(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`${API}/orders`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        signal: ac.signal
      });
      if (!res.ok) throw new Error((await res.json())?.error || "โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setErr(e?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        load();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const expMs = getExpMsFromToken();
      if (!expMs) return setLeftMs(null);
      setLeftMs(Math.max(0, expMs - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, []);

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
    const rejected = list.filter(o => o.paymentStatus === 'REJECTED');
    return { expSoon, slipWarn, shipNoTn, rejected };
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

  const menuShortcuts = [
    hasPerm("order:manage") && { to: "/orders", icon: <ShoppingCartIcon />, label: "ออเดอร์", color: "primary" as const },
    hasPerm("product:manage") && { to: "/products", icon: <CategoryIcon />, label: "สินค้า", color: "secondary" as const },
    hasPerm("po:manage") && { to: "/po", icon: <ReceiptLongIcon />, label: "ใบสั่งซื้อ", color: "success" as const },
    hasPerm("receiving:manage") && { to: "/receiving", icon: <WarehouseIcon />, label: "รับสินค้าเข้า", color: "info" as const },
    hasPerm("user:manage") && { to: "/users", icon: <PeopleAltIcon />, label: "ผู้ใช้", color: "warning" as const },
    hasPerm("role:manage") && { to: "/roles", icon: <SecurityIcon />, label: "บทบาท/สิทธิ์", color: "default" as const },
    hasPerm("issue:manage") && { to: "/issues", icon: <BugReportIcon />, label: "รายการปัญหา", color: "error" as const },
    hasPerm("audit:manage") && { to: "/audit", icon: <ArticleIcon />, label: "Audit Logs", color: "primary" as const },
  ].filter(Boolean) as {to: string; icon: JSX.Element; label: string; color: any}[];

  return (
    <Box
      p={{ xs: 2, md: 3 }}
      sx={{
        background:
          "radial-gradient(1200px 500px at -10% -10%, rgba(2,132,199,.08), transparent 60%), radial-gradient(900px 380px at 110% 10%, rgba(7,193,96,.08), transparent 60%)",
        borderRadius: 3
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="h5" fontWeight={900}>Dashboard</Typography>
          <Chip size="small" label={mode} />
          <Tooltip title="รีเฟรช (กดปุ่ม R ที่คีย์บอร์ดก็ได้)">
            <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
        {leftSec != null && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">เซสชันจะหมดอายุใน</Typography>
            <Chip size="small" color="warning" label={`${mm}:${ss}`} />
          </Stack>
        )}
      </Stack>

      {/* ✅ ใส่ Greeting */}
      <Greeting user={JSON.parse(localStorage.getItem("aw_user") || "{}")} />

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {/* 4 Cards บน */}
            <Grid item xs={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">ออเดอร์ทั้งหมด</Typography>
                    <ReceiptLongIcon />
                  </Stack>
                  <Typography variant="h5" fontWeight={900}>{loading ? <Skeleton width={80}/> : kpi.total.toLocaleString()}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">รอตรวจ/แก้ไข</Typography>
                    <WarningAmberIcon color="warning" />
                  </Stack>
                  <Typography variant="h5" fontWeight={900}>{loading ? <Skeleton width={80}/> : kpi.pending.toLocaleString()}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">กำลังจัดส่ง</Typography>
                    <LocalShippingIcon color="info" />
                  </Stack>
                  <Typography variant="h5" fontWeight={900}>{loading ? <Skeleton width={80}/> : kpi.shipping.toLocaleString()}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">เสร็จสมบูรณ์</Typography>
                    <TaskAltIcon color="success" />
                  </Stack>
                  <Typography variant="h5" fontWeight={900}>{loading ? <Skeleton width={80}/> : kpi.done.toLocaleString()}</Typography>
                </Stack>
              </Paper>
            </Grid>

            {/* ✅ Chart รายได้ (AreaChart) */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: 350 }}>
                <Typography variant="h6" fontWeight={800} mb={2}>📈 แนวโน้มรายได้ (7 วันล่าสุด)</Typography>
                <Box height={260}>
                  {loading ? (
                    <Skeleton variant="rectangular" height="100%" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#07c160" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#07c160" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <RechartsTooltip 
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value:number) => [`฿${value.toLocaleString()}`, 'รายได้']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#07c160" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Right Side: Quick Links & Attention */}
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <WarningAmberIcon color="warning" />
              <Typography fontWeight={800}>รายการที่ต้องสนใจ</Typography>
            </Stack>
            {loading ? (
              <Stack spacing={1}><Skeleton height={24}/><Skeleton height={24}/><Skeleton height={24}/></Stack>
            ) : (
              <Stack spacing={1}>
                <Chip size="small" variant="outlined" color="warning" label={`รอชำระจะหมดเวลา (≤10 นาที): ${attention.expSoon.length}`} />
                <Chip size="small" variant="outlined" color="error" label={`สลิปผิดปกติ (≥2 ครั้ง): ${attention.slipWarn.length}`} />
                <Chip size="small" variant="outlined" color="info" label={`กำลังส่งแต่ไม่มีเลขพัสดุ: ${attention.shipNoTn.length}`} />
                <Chip size="small" variant="outlined" label={`สลิปไม่ผ่าน: ${attention.rejected.length}`} />
              </Stack>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <StackedLineChartIcon />
              <Typography fontWeight={800}>ควิกเมนู</Typography>
            </Stack>
            <Grid container spacing={1}>
              {menuShortcuts.map(m => (
                <Grid item xs={6} key={m.to}>
                  <Button
                    component={Link}
                    to={m.to}
                    fullWidth
                    variant="outlined"
                    sx={{
                      justifyContent: "flex-start",
                      borderColor: (t)=>alpha(t.palette[m.color]?.main || t.palette.divider, .4)
                    }}
                    startIcon={m.icon}
                  >
                    {m.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Recent orders */}
        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" mb={1}>
              <ReceiptLongIcon />
              <Typography fontWeight={800}>ออเดอร์ล่าสุด</Typography>
            </Stack>
            {loading ? (
              <Stack spacing={1}><Skeleton height={46}/><Skeleton height={46}/><Skeleton height={46}/></Stack>
            ) : (
              <List dense>
                {kpi.latest.map(o => (
                  <ListItem
                    key={o._id}
                    secondaryAction={
                      <Button component={Link} to={`/orders?tab=all`} size="small" endIcon={<ArrowForwardIcon />}>รายละเอียด</Button>
                    }
                  >
                    <ListItemIcon><ShoppingCartIcon /></ListItemIcon>
                    <ListItemText
                      primary={<Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={800}>{o.orderNo}</Typography>
                        <Chip size="small" label={o.paymentStatus} />
                        <Chip size="small" label={o.orderStatus} />
                      </Stack>}
                      secondary={<Typography variant="caption" color="text.secondary">
                        {o.customerName} • {new Date(o.createdAt).toLocaleString("th-TH")} • ยอด {o.totalAmount.toLocaleString("th-TH")} บาท
                      </Typography>}
                    />
                  </ListItem>
                ))}
                {!kpi.latest.length && <Typography color="text.secondary">ไม่มีข้อมูล</Typography>}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Inventory / quick links */}
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
            <Stack direction="row" spacing={1.25} alignItems="center" mb={1}>
              <Inventory2Icon />
              <Typography fontWeight={800}>สต็อก / จัดซื้อ</Typography>
            </Stack>
            <Stack spacing={1}>
              <Button component={Link} to="/products" fullWidth variant="outlined" startIcon={<CategoryIcon />}>จัดการสินค้า</Button>
              <Button component={Link} to="/po" fullWidth variant="outlined" startIcon={<AddBoxIcon />}>สร้างใบสั่งซื้อ</Button>
              <Button component={Link} to="/receiving" fullWidth variant="outlined" startIcon={<MoveDownIcon />}>รับสินค้าเข้า</Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {loading && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  );
}