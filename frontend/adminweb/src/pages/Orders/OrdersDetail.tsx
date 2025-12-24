// src/pages/Orders/OrdersDetail.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box, Paper, Typography, Stack, Chip, Divider, Button, TextField, MenuItem,
  Dialog, DialogContent, DialogTitle, DialogActions, Alert, Tooltip, IconButton
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VerifiedIcon from "@mui/icons-material/Verified";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PlaceIcon from "@mui/icons-material/Place";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import KeyIcon from "@mui/icons-material/Key";

import {
  getOrder as apiGetOrder,
  updateOrder as apiUpdateOrder,
  verifySlip as apiVerifySlip,
  getSlipSignedUrl as apiGetSlipSignedUrl,
  retrySlip as apiRetrySlip,
  type Order
} from "../../api/admin";

import api from "../../lib/axios";

// ====== CONFIG/API ======
const API = import.meta.env.VITE_API_URL || "/api";
// ใช้สำหรับ fallback เรียกดูข้อมูลผู้ใช้ปัจจุบัน
const WHOAMI_ENDPOINTS = [`${API}/me`, `${API}/auth/me`, `${API}/users/me`, `${API}/admins/me`];

// ====== headers/helper ======
const getAuthHeader = (): Record<string, string> => {
  try {
    const h = (api as any)?.defaults?.headers?.common?.Authorization;
    if (h) return { Authorization: h as string };
  } catch {}
  const keys = ["admin_token", "token", "auth_token", "jwt"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return { Authorization: v.startsWith("Bearer ") ? v : `Bearer ${v}` };
  }
  return {};
};

const fmtBaht = (n: number) => (n || 0).toLocaleString("th-TH") + " บาท";
const normalizeTN = (s: string) => (s || "").toUpperCase().replace(/\s/g, "");
const isThaiPostTracking = (s?: string) => !!s && /^[A-Z]{2}\d{9}TH$/.test(normalizeTN(s));

const ORDER_THAI: Record<Order["orderStatus"], string> = {
  RECEIVED: "รับออเดอร์",
  PREPARING_ORDER: "กำลังเตรียมสินค้า",
  SHIPPING: "กำลังจัดส่ง",
  COMPLETED: "เสร็จสมบูรณ์",
  CANCELLED: "ยกเลิก",
};
const PAY_THAI: Record<Order["paymentStatus"], string> = {
  WAITING: "รอโอน/รอตรวจ",
  PENDING_PAYMENT: "รอตรวจสอบ",
  PAYMENT_CONFIRMED: "ชำระแล้ว",
  REJECTED: "สลิปไม่ผ่าน",
  EXPIRED: "หมดอายุ",
};
const SHIP_THAI: Record<NonNullable<Order["shippingType"]>, string> = {
  DELIVERY: "จัดส่ง",
  PICKUP_EVENT: "รับหน้างาน",
  PICKUP_SMAKHOM: "รับที่สมาคมนิสิตเก่าวิทยาศาสตร์",
};

const orderStatusOpts: Order["orderStatus"][] = ["RECEIVED","PREPARING_ORDER","SHIPPING","COMPLETED","CANCELLED"];
const paymentStatusOpts: Order["paymentStatus"][] = ["WAITING","PENDING_PAYMENT","PAYMENT_CONFIRMED","REJECTED","EXPIRED"];

const payColor = (s: Order["paymentStatus"]) =>
  s === "PAYMENT_CONFIRMED" ? "success" :
  s === "REJECTED" ? "error" :
  s === "EXPIRED" ? "default" :
  "warning";

const orderColor = (s: Order["orderStatus"]) =>
  s === "COMPLETED" ? "success" :
  s === "CANCELLED" ? "default" :
  s === "SHIPPING" ? "info" :
  s === "PREPARING_ORDER" ? "primary" : "secondary";

// 🔒 ผู้ให้บริการขนส่ง (ล็อกตาย)
const FIXED_PROVIDER = "ไปรษณีย์ไทย";

/* ===== Local user helpers ===== */
function readJSON<T=any>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; }
}
function usernameFromJwtClaim(): string | null {
  try {
    const auth = getAuthHeader().Authorization;
    if (!auth) return null;
    const token = auth.replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload?.username ? String(payload.username) : null;
  } catch { return null; }
}
function pickLocalUsernames(): string[] {
  const out: string[] = [];
  const aw = readJSON<{ username?: string }>('aw_user'); if (aw?.username) out.push(aw.username);
  const adminUser = readJSON<{ username?: string }>('admin_user_json'); if (adminUser?.username) out.push(adminUser.username);
  const adminUsername = localStorage.getItem('admin_username'); if (adminUsername) out.push(adminUsername);
  const jwtU = usernameFromJwtClaim(); if (jwtU) out.push(jwtU);
  const embed = (window as any).__ADMIN_USER__?.username; if (embed) out.push(String(embed));
  return out.map(s => String(s).toLowerCase()).filter(Boolean);
}

// ====== verify username (ไม่แตะ server ถ้าไม่จำเป็น) ======
async function verifyUsername(username: string): Promise<boolean> {
  const want = (username || "").trim().toLowerCase();
  if (!want) return false;
  if (pickLocalUsernames().includes(want)) return true;

  const headers = { ...getAuthHeader() };
  if (!headers.Authorization) return false;

  for (const url of WHOAMI_ENDPOINTS) {
    try {
      const res = await fetch(url, { method: "GET", credentials: "include", headers });
      if (!res.ok) continue;
      const data = await res.json().catch(()=> ({}));
      const got = (data?.username ?? data?.user?.username ?? "").toString().toLowerCase();
      if (got && got === want) return true;
    } catch { /* try next endpoint */ }
  }
  return false;
}

export default function OrdersDetail() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 🔒 Lock/Unlock
  const [locked, setLocked] = useState(true);
  const [unlockDlg, setUnlockDlg] = useState(false);
  const [uname, setUname] = useState("");
  const [verifyingUser, setVerifyingUser] = useState(false);

  // cache me + auto-relock
  const [meUser, setMeUser] = useState<string | null>(null);
  const relockTimer = useRef<number | null>(null);

  // ฟอร์มแก้ไข
  const [edit, setEdit] = useState<{
    orderStatus?: Order["orderStatus"];
    paymentStatus?: Order["paymentStatus"];
    shippingProvider?: string;
    trackingNumber?: string;
  }>({});

  // สลิป
  const [openSlip, setOpenSlip] = useState(false);
  const [slipUrl, setSlipUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Prefetch me (local -> /me fallback)
  useEffect(() => {
    (async () => {
      const locals = pickLocalUsernames();
      if (locals.length) { setMeUser(locals[0]); return; }
      const headers = { ...getAuthHeader() };
      if (!headers.Authorization) return;
      for (const url of WHOAMI_ENDPOINTS) {
        try {
          const r = await fetch(url, { credentials: "include", headers });
          if (!r.ok) continue;
          const d = await r.json().catch(() => ({}));
          const got = (d?.username ?? d?.user?.username ?? "").toString();
          if (got) { setMeUser(got); break; }
        } catch {}
      }
    })();
    return () => { if (relockTimer.current) window.clearTimeout(relockTimer.current); };
  }, []);

  // โหลดออเดอร์
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiGetOrder(id);
        setOrder(data);
        setEdit({
          orderStatus: data.orderStatus,
          paymentStatus: data.paymentStatus,
          shippingProvider: FIXED_PROVIDER,
          trackingNumber: normalizeTN(data.trackingNumber || ""),
        });
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const itemsList = useMemo(() => (order?.items || []).map((it, i) => (
    <li key={i}>
      {it.productName} • {it.size}/{it.color} • {fmtBaht(it.price)} × {it.quantity} = <b>{fmtBaht(it.price*it.quantity)}</b>
    </li>
  )), [order?.items]);

  const paid        = order?.paymentStatus === "PAYMENT_CONFIRMED";

  // เลขพัสดุ
  const tn = normalizeTN(edit.trackingNumber || "");
  const requireTN = edit.orderStatus === "SHIPPING" && !tn;
  const badFormatTN = !!tn && !isThaiPostTracking(tn);
  const warnCompleteEarly = edit.orderStatus === "COMPLETED" && order?.orderStatus !== "SHIPPING";

  // ====== Save ======
  const onSave = async () => {
    if (!order) return;
    if (locked) { setMsg("กรุณาปลดล็อกก่อนทำการบันทึก"); return; }
    if (requireTN) { setMsg("กรุณากรอกเลขพัสดุเมื่อเปลี่ยนเป็นสถานะจัดส่ง"); return; }
    if (badFormatTN) { setMsg("เลขพัสดุไม่ถูกต้อง — รูปแบบที่ถูกต้องเช่น EX123456789TH"); return; }

    setSaving(true); setMsg(null);
    try {
      const payload: any = {
        orderStatus: edit.orderStatus,
        shippingProvider: FIXED_PROVIDER,
        trackingNumber: tn || undefined,
      };
      // ❗ห้ามแก้ paymentStatus ถ้าชำระสมบูรณ์แล้ว
      if (!paid && edit.paymentStatus) payload.paymentStatus = edit.paymentStatus;

      const data = await apiUpdateOrder(order._id, payload);
      setOrder(data);
      setEdit({
        orderStatus: data.orderStatus,
        paymentStatus: data.paymentStatus,
        shippingProvider: FIXED_PROVIDER,
        trackingNumber: normalizeTN(data.trackingNumber || ""),
      });
      setMsg("บันทึกเรียบร้อย");
    } catch (e: any) {
      setMsg(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // ====== Slip actions ======
  const verifySlip = async () => {
    if (!order) return;
    setSaving(true); setMsg(null);
    try {
      const data = await apiVerifySlip(order._id);
      setOrder(data.order);
      setEdit(s => ({ ...s, paymentStatus: data.order.paymentStatus }));
      const ok = data.slipOkResult?.success;
      setMsg(ok ? "ตรวจสลิป: ผ่าน ✅" : `ตรวจสลิป: ไม่ผ่าน ❌ ${data.slipOkResult?.message || ""}`);
    } catch (e: any) {
      setMsg(e?.message || "ตรวจสลิปไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openSlipDialog = async () => {
    setOpenSlip(true);
    setSlipUrl("");
    try {
      const url = await apiGetSlipSignedUrl(id);
      setSlipUrl(url || "ERROR");
    } catch {
      setSlipUrl("ERROR");
    }
  };

  const onChooseFile = () => !locked && fileRef.current?.click();
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (!order) return;
    const f = e.target.files?.[0];
    if (!f) return;
    if (locked) { setMsg("กรุณาปลดล็อกก่อนอัปโหลดสลิป"); return; }

    setSaving(true); setMsg(null);
    try {
      const data = await apiRetrySlip(order._id, f);
      setOrder(data.order);
      setEdit(s => ({ ...s, paymentStatus: data.order.paymentStatus }));
      const ok = data.slipOkResult?.success;
      setMsg(ok ? "อัปโหลดสลิปแทนลูกค้าและตรวจผ่านแล้ว ✅" : `อัปโหลดสลิปแล้ว แต่ไม่ผ่าน ❌ ${data.slipOkResult?.message || ""}`);
    } catch (e: any) {
      setMsg(e?.message || "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyTN = async () => {
    if (!tn) return;
    try { await navigator.clipboard.writeText(tn); setMsg("คัดลอกเลขพัสดุแล้ว"); }
    catch { setMsg("คัดลอกเลขพัสดุไม่สำเร็จ"); }
  };

  // ====== Unlock ======
  const doUnlock = async () => {
    setVerifyingUser(true);
    try {
      const want = uname.trim().toLowerCase();
      const cached = (meUser || "").toLowerCase();
      const ok = cached ? (cached === want) : await verifyUsername(uname);
      if (!ok) { setMsg("ชื่อผู้ใช้ไม่ถูกต้อง หรือไม่ตรงกับบัญชีที่ล็อกอินอยู่"); return; }

      setLocked(false);
      setUnlockDlg(false);
      setUname("");
      setMsg("ปลดล็อกแล้ว — สามารถแก้ไขข้อมูลได้");

      if (relockTimer.current) window.clearTimeout(relockTimer.current);
      relockTimer.current = window.setTimeout(() => setLocked(true), 15 * 60 * 1000);
    } finally {
      setVerifyingUser(false);
    }
  };

  if (loading) return <Box p={3}><Typography>กำลังโหลด…</Typography></Box>;
  if (!order) return <Box p={3}><Typography>ไม่พบออเดอร์</Typography></Box>;

  const ShippingBlock = () => {
    const { shippingType, customerAddress, customerPhone, trackingNumber } = order!;
    const typeLabel = shippingType ? SHIP_THAI[shippingType] : "—";

    let heading = "", address = "", hint = "";
    if (shippingType === "DELIVERY") {
      heading = "ที่อยู่จัดส่ง"; address = customerAddress || "— ไม่ได้ระบุที่อยู่จัดส่ง —";
      hint = customerPhone ? `โทรศัพท์ผู้รับ: ${customerPhone}` : "";
    } else if (shippingType === "PICKUP_EVENT") {
      heading = "สถานที่รับหน้างาน"; address = customerAddress || "จะมีการแจ้งสถานที่/เวลาอีกครั้ง";
      hint = "โปรดตรวจสอบประกาศหรือข้อความแจ้งจากแอดมิน";
    } else if (shippingType === "PICKUP_SMAKHOM") {
      heading = "จุดรับ: สมาคมนิสิตเก่าวิทยาศาสตร์"; address = "รับสินค้าที่สมาคมนิสิตเก่าวิทยาศาสตร์ (โปรดติดต่อเจ้าหน้าที่เพื่อยืนยันวัน/เวลา)";
      hint = "กรุณานำเลขออเดอร์และบัตรประชาชนมาแสดง";
    }

    return (
      <Paper elevation={1} sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1} flexWrap="wrap">
          {shippingType === "DELIVERY" ? <LocalShippingIcon fontSize="small" /> : <StorefrontIcon fontSize="small" />}
          <Typography fontWeight={900}>{typeLabel}</Typography>
          <Chip size="small" variant="outlined" label={`ขนส่ง: ${FIXED_PROVIDER}`} />
          {trackingNumber && <Chip size="small" variant="outlined" label={`เลขพัสดุ: ${normalizeTN(trackingNumber)}`} />}
        </Stack>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "grey.50", border: "1px dashed", borderColor: "divider" }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <PlaceIcon fontSize="small" />
            <Typography fontWeight={800}>{heading || "ข้อมูลการรับ/จัดส่ง"}</Typography>
          </Stack>
          {address && <Typography sx={{ whiteSpace: "pre-wrap" }}>{address}</Typography>}
          {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
        </Box>

        {trackingNumber && (
          <Stack direction="row" spacing={1} mt={1}>
            <Button onClick={copyTN} startIcon={<ContentCopyIcon />}>คัดลอกเลขพัสดุ</Button>
            <Button
              startIcon={<OpenInNewIcon />}
              href={`https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(normalizeTN(trackingNumber))}`}
              target="_blank" rel="noopener"
            >
              เปิดติดตามพัสดุ (ไปรษณีย์ไทย)
            </Button>
          </Stack>
        )}
      </Paper>
    );
  };

  // อัปโหลดแทนลูกค้าได้ถ้า "ยังไม่ชำระสำเร็จ"
  const canUploadOnBehalf = !paid;

  return (
    <Box p={{ xs: 2, md: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Button component={Link} to="/orders">← กลับรายการ</Button>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            color={locked ? "warning" : "success"}
            icon={locked ? <LockIcon /> : <LockOpenIcon />}
            label={locked ? "แก้ไขถูกล็อก" : "ปลดล็อกแล้ว (หมดอายุอัตโนมัติ 15 นาที)"}
            variant={locked ? "filled" : "outlined"}
          />
          {locked
            ? <Button startIcon={<KeyIcon />} variant="contained" size="small" onClick={()=>setUnlockDlg(true)}>ปลดล็อกเพื่อแก้ไข</Button>
            : <Button startIcon={<LockIcon />} size="small" onClick={()=>{
                setLocked(true);
                setMsg("ล็อกการแก้ไขแล้ว");
                if (relockTimer.current) { window.clearTimeout(relockTimer.current); relockTimer.current = null; }
              }}>ล็อกตอนนี้</Button>
          }
        </Stack>
      </Stack>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" fontWeight={900}>{order.orderNo}</Typography>
          <Chip size="small" color={orderColor(order.orderStatus)} label={ORDER_THAI[order.orderStatus]} />
          <Chip size="small" color={payColor(order.paymentStatus)} label={PAY_THAI[order.paymentStatus]} />
          {(order.slipReviewCount ?? 0) > 0 && (
            <Chip
              size="small"
              variant="outlined"
              color={(order.slipReviewCount ?? 0) >= 3 && order.paymentStatus !== "PAYMENT_CONFIRMED" ? "error" : "default"}
              label={`ตรวจสลิปไม่ผ่าน ${order.slipReviewCount} ครั้ง`}
            />
          )}
          {order.trackingNumber && (
            <Chip size="small" icon={<LocalShippingIcon />} label={`เลขพัสดุ: ${normalizeTN(order.trackingNumber)}`} variant="outlined" />
          )}
        </Stack>
        <Typography color="text.secondary">ลูกค้า: {order.customerName}</Typography>
        <Typography color="text.secondary" mt={0.2}>
          วันที่สั่งซื้อ: {new Date(order.createdAt).toLocaleString("th-TH")}
        </Typography>
      </Paper>

      <ShippingBlock />

      <Paper elevation={1} sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <ReceiptLongIcon fontSize="small" />
          <Typography fontWeight={800}>รายการสินค้า</Typography>
        </Stack>
        <Box component="ul" sx={{ pl: 3, mb: 1 }}>{itemsList}</Box>
        <Divider sx={{ my: 1.25 }} />
        <Typography variant="h6" color="success.main" fontWeight={900}>
          รวมทั้งสิ้น: {fmtBaht(order.totalAmount)}
        </Typography>
      </Paper>

      <Paper elevation={3} sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Typography fontWeight={900} mb={1}>จัดการสถานะ</Typography>

        {warnCompleteEarly && (
          <Alert severity="info" sx={{ mb: 1 }}>
            คุณกำลังปิดงาน (เสร็จสมบูรณ์) ทั้งที่ยังไม่ได้อยู่สถานะ “กำลังจัดส่ง” — โปรดตรวจสอบความถูกต้อง
          </Alert>
        )}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} flexWrap="wrap">
          {/* ✅ แก้ได้เมื่อปลดล็อก */}
          <TextField
            label="สถานะออเดอร์"
            select size="small" value={edit.orderStatus || ""}
            onChange={e=>setEdit(s=>({ ...s, orderStatus: e.target.value as Order["orderStatus"] }))}
            sx={{ minWidth: 220 }}
            disabled={locked}
          >
            {orderStatusOpts.map(o => <MenuItem key={o} value={o}>{ORDER_THAI[o]}</MenuItem>)}
          </TextField>

          {/* ✅ ยกเว้น Payment Status ถ้า paid แล้ว — disabled */}
          <TextField
            label="สถานะการชำระเงิน"
            select size="small" value={edit.paymentStatus || ""}
            onChange={e=>setEdit(s=>({ ...s, paymentStatus: e.target.value as Order["paymentStatus"] }))}
            sx={{ minWidth: 220 }}
            disabled={locked || paid}
            helperText={
              locked ? "ปลดล็อกเพื่อแก้ไข"
              : paid ? "ชำระสมบูรณ์แล้ว — แก้ไขไม่ได้"
              : ""
            }
          >
            {paymentStatusOpts.map(o => <MenuItem key={o} value={o}>{PAY_THAI[o]}</MenuItem>)}
          </TextField>

          {/* 🔒 ผู้ให้บริการขนส่ง — ล็อกเป็นไปรษณีย์ไทย */}
          <TextField
            label="ผู้ให้บริการขนส่ง" size="small"
            select value={FIXED_PROVIDER} sx={{ minWidth: 220 }}
            disabled
            helperText="ล็อกเป็นไปรษณีย์ไทย"
          >
            <MenuItem value={FIXED_PROVIDER}>{FIXED_PROVIDER}</MenuItem>
          </TextField>

          {/* ✅ Tracking — แก้ได้เมื่อปลดล็อก */}
          <TextField
            label="เลขพัสดุ (ไปรษณีย์ไทย)"
            size="small"
            value={edit.trackingNumber || ""}
            onChange={e=>setEdit(s=>({ ...s, trackingNumber: normalizeTN(e.target.value) }))}
            disabled={locked}
            error={(!locked && requireTN) || (!locked && badFormatTN)}
            helperText={
              locked ? "ปลดล็อกเพื่อแก้ไข"
              : requireTN ? "จำเป็นต้องกรอกเมื่อเปลี่ยนเป็นสถานะจัดส่ง"
              : badFormatTN ? "รูปแบบไม่ถูกต้อง (เช่น EX123456789TH)"
              : " "
            }
            placeholder="EX123456789TH"
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={copyTN} disabled={!tn} size="small"><ContentCopyIcon fontSize="small" /></IconButton>
            <Tooltip title="ติดตามพัสดุ">
              <span>
                <IconButton
                  size="small"
                  disabled={!tn}
                  component="a"
                  href={tn ? `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(tn)}` : undefined}
                  target="_blank" rel="noopener"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1.2} mt={2} flexWrap="wrap">
          <Button
            onClick={onSave}
            variant="contained"
            disabled={saving || locked || requireTN || badFormatTN}
          >
            บันทึก
          </Button>

          {order.paymentSlipFilename && (
            <Button variant="outlined" onClick={openSlipDialog} startIcon={<VisibilityIcon />}>
              ดูสลิป
            </Button>
          )}

          <Tooltip title="ตรวจสลิปจากไฟล์เดิม (SlipOK)">
            <span>
              <Button variant="outlined" color="success" onClick={verifySlip} disabled={saving} startIcon={<VerifiedIcon />}>
                ตรวจสลิป
              </Button>
            </span>
          </Tooltip>

          {/* ✅ อัปโหลดแทนลูกค้าได้เมื่อยังไม่ชำระสำเร็จ */}
          {!paid && (
            <>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} />
              <Tooltip title={locked ? "ปลดล็อกก่อนจึงจะอัปโหลดได้" : "อัปโหลดสลิปแทนลูกค้า (เฉพาะยังไม่ชำระสำเร็จ)"}>
                <span>
                  <Button variant="outlined" color="warning" startIcon={<CloudUploadIcon />} onClick={onChooseFile} disabled={locked || saving}>
                    อัปโหลดสลิปแทนลูกค้า
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Stack>

        {msg && <Alert sx={{ mt: 1.5 }} severity="info">{msg}</Alert>}
      </Paper>

      {/* ===== Dialog ดูสลิป ===== */}
      <Dialog open={openSlip} onClose={()=>setOpenSlip(false)} maxWidth="sm" fullWidth>
        <DialogTitle>สลิปชำระเงิน</DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          {!slipUrl && <Typography>กำลังโหลด…</Typography>}
          {slipUrl === "ERROR" && <Alert severity="error">โหลดสลิปไม่สำเร็จ</Alert>}
          {slipUrl && slipUrl !== "ERROR" && (
            <img src={slipUrl} alt="payment slip" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenSlip(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Dialog ปลดล็อกด้วยชื่อผู้ใช้ ===== */}
      <Dialog open={unlockDlg} onClose={()=>setUnlockDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle>ปลดล็อกเพื่อแก้ไขข้อมูล</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            ใส่ <b>ชื่อผู้ใช้ (username)</b> ของบัญชีที่คุณล็อกอินอยู่ เพื่อยืนยันและปลดล็อกการแก้ไขออร์เดอร์นี้
          </Typography>
          <TextField
            fullWidth type="text" label="ชื่อผู้ใช้ (username)" value={uname}
            onChange={e=>setUname(e.target.value)} autoFocus
            onKeyDown={(e)=>{ if (e.key === "Enter") doUnlock(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setUnlockDlg(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={doUnlock} disabled={!uname.trim() || verifyingUser}>
            {verifyingUser ? "กำลังตรวจสอบ…" : "ยืนยันและปลดล็อก"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}