// src/pages/OrderDetail.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrderDetail, getSlipSignedUrl } from "../api/orderApi";
import api, { toBackendURL } from "../api/axios";

import {
  Box, Typography, CircularProgress, Button, Chip, Divider, Stack, Dialog, Alert,
  Paper, Avatar, Tooltip, LinearProgress
} from "@mui/material";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import CloseIcon from "@mui/icons-material/Close";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import CancelIcon from "@mui/icons-material/Cancel";
import ReplayIcon from "@mui/icons-material/Replay";
import PermIdentityIcon from "@mui/icons-material/PermIdentity";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import PlaceIcon from "@mui/icons-material/Place";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import StorefrontIcon from "@mui/icons-material/Storefront"; // ✅ ใหม่: ใช้กับ “สินค้าพร้อมรับ”

/* ------------ Mapping & Utils ------------ */
const money = (n) => Number(n || 0).toLocaleString("th-TH");
const formatDate = (d) => {
  try { return new Date(d).toLocaleString("th-TH"); } catch { return String(d || "-"); }
};
const isPayWaiting = (ps) => ["WAITING", "PENDING_PAYMENT", "REJECTED"].includes(ps);
const getExpireAt = (order) =>
  new Date(order?.expiredAt || (new Date(order?.createdAt).getTime() + 30 * 60 * 1000));

const orderStatusInfo = {
  RECEIVED:         { label: "รับออเดอร์แล้ว", icon: <ShoppingBagIcon /> },
  PREPARING_ORDER:  { label: "กำลังจัดเตรียม", icon: <PendingActionsIcon /> },
  SHIPPING:         { label: "อยู่ระหว่างการจัดส่ง", icon: <LocalShippingIcon /> },  // *ค่าพื้นฐาน* (จะถูกแทนที่ในเคสรับเอง)
  COMPLETED:        { label: "สำเร็จ", icon: <DoneAllIcon /> },
  CANCELLED:        { label: "ยกเลิก", icon: <CancelIcon /> },
};

const paymentStatusInfo = {
  WAITING:            { label: "รอชำระเงิน", icon: <AccessTimeIcon /> , color: "warning" },
  PENDING_PAYMENT:    { label: "รอตรวจสอบ", icon: <PendingActionsIcon /> , color: "info" },
  PAYMENT_CONFIRMED:  { label: "ชำระเงินสำเร็จ", icon: <AssignmentTurnedInIcon /> , color: "success" },
  REJECTED:           { label: "สลิปไม่ผ่าน", icon: <CloseIcon /> , color: "error" },
  EXPIRED:            { label: "หมดอายุ", icon: <ErrorOutlineIcon /> , color: "error" },
};

/* ✅ ใหม่: ให้ label/ไอคอนของ orderStatus เปลี่ยนตามชนิดรับสินค้า */
function getOrderStatusInfo(status, shippingType) {
  const isPickup = shippingType && shippingType !== "DELIVERY";
  if (status === "SHIPPING") {
    return isPickup
      ? { label: "สินค้าพร้อมรับ", icon: <StorefrontIcon /> }
      : { label: "อยู่ระหว่างการจัดส่ง", icon: <LocalShippingIcon /> };
  }
  return orderStatusInfo[status] || { label: status };
}

/* ------------ Order step progress (compact) ------------ */
const ORDER_STEPS = ["RECEIVED", "PREPARING_ORDER", "SHIPPING", "COMPLETED"];
const stepIndex = (status) => Math.max(0, ORDER_STEPS.indexOf(status));
function OrderProgress({ status, shippingType }) { // ✅ เปลี่ยน signature
  const idx = stepIndex(status);
  const percent = Math.max(0, (idx / (ORDER_STEPS.length - 1)) * 100);
  return (
    <Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ height: 6, borderRadius: 3, "& .MuiLinearProgress-bar": { borderRadius: 3 }, mb: 0.75 }}
      />
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {ORDER_STEPS.map((st, i) => {
          const info = getOrderStatusInfo(st, shippingType); // ✅ ใช้เวอร์ชันไดนามิก
          return (
            <Chip
              key={st}
              size="small"
              icon={info.icon}
              label={info.label}
              color={i <= idx ? "primary" : "default"}
              variant={i <= idx ? "filled" : "outlined"}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

/* ------------ ThaiPost stages from tracking history ------------ */
const TP_STAGES = [
  { key: "รับฝาก", includes: ["รับฝาก"] },
  { key: "ระหว่างส่ง", includes: ["ออกจากที่ทำการ", "ถึงที่ทำการไปรษณีย์"] },
  { key: "นำจ่าย", includes: ["อยู่ระหว่างการนำจ่าย"] },
  { key: "สำเร็จ", includes: ["นำจ่ายสำเร็จ"] },
];
function stageIndexFromHistory(list = []) {
  let idx = 0;
  for (const ev of list) {
    const s = String(ev.status || "");
    TP_STAGES.forEach((st, i) => {
      if (st.includes.some(txt => s.includes(txt))) idx = Math.max(idx, i);
    });
  }
  return idx;
}

/* ------------ Lightweight countdown chip ------------ */
function Countdown({ end }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(end).getTime() - Date.now()));
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => {
      setLeft(Math.max(0, new Date(end).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [end, left]);

  if (left <= 0) {
    return (
      <Chip
        size="small"
        color="error"
        icon={<ErrorOutlineIcon />}
        label="หมดเวลา"
        sx={{ fontWeight: 700 }}
      />
    );
  }
  const s = Math.floor(left / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <Chip
      size="small"
      variant="outlined"
      color="warning"
      icon={<AccessTimeIcon />}
      label={`เหลือเวลา ${h}:${m}:${ss}`}
      sx={{ fontWeight: 700 }}
    />
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // สลิป
  const [open, setOpen] = useState(false);
  const [slipUrl, setSlipUrl] = useState("");

  // Tracking
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [trackingHistory, setTrackingHistory] = useState([]);

  const thaiPostUrl = useMemo(() => {
    const t = order?.trackingNumber;
    return t ? `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(t)}` : "";
  }, [order?.trackingNumber]);

  const pollingRef = useRef(null);

  /* -------- Load order -------- */
  useEffect(() => {
    (async () => {
      try {
        const data = await getOrderDetail(id);
        setOrder(data);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id]);

  /* -------- Tracking source -------- */
  useEffect(() => {
    if (!order) return;

    if (Array.isArray(order.trackingHistory) && order.trackingHistory.length > 0) {
      const hist = [...order.trackingHistory].reverse();
      setTrackingHistory(hist);
      setTrackingLoading(false);
      setTrackingError("");
      return;
    }

    if (order.trackingNumber && order.orderStatus === "SHIPPING") {
      setTrackingLoading(true);
      setTrackingError("");
      setTrackingHistory([]);

      api.get(`/api/tracking/${encodeURIComponent(order.trackingNumber)}`)
        .then(res => {
          const hist = Array.isArray(res.data?.history) ? res.data.history : [];
          const display = [...hist].reverse();
          setTrackingHistory(display);
        })
        .catch(() => setTrackingError("ไม่พบข้อมูลพัสดุ หรือระบบติดขัด"))
        .finally(() => setTrackingLoading(false));
    } else {
      setTrackingHistory([]);
      setTrackingLoading(false);
      setTrackingError("");
    }
  }, [order]);

  /* -------- Auto-refresh while SHIPPING -------- */
  useEffect(() => {
    if (!order) return;
    if (order.orderStatus !== "SHIPPING") {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getOrderDetail(id);
        setOrder(data);
      } catch {}
    }, 30_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [order?.orderStatus, id]);

  /* -------- Open slip (signed URL) -------- */
  const handleOpenSlip = async () => {
    setSlipUrl("");
    setOpen(true);
    try {
      const signed = await getSlipSignedUrl(id); // string or {url}
      const abs = typeof signed === "string"
        ? toBackendURL(signed)
        : toBackendURL(signed?.url || '');
      if (!abs) throw new Error("no signed url");
      setSlipUrl(abs);
    } catch {
      setSlipUrl("ERROR");
    }
  };
  const handleClose = () => { setOpen(false); setSlipUrl(""); };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  if (!order) return <Typography>ไม่พบข้อมูลออเดอร์นี้</Typography>;

  const tpStageIdx = stageIndexFromHistory(trackingHistory);
  const tpStageChips = TP_STAGES.map((st, i) => (
    <Chip
      key={st.key}
      size="small"
      icon={i <= tpStageIdx ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
      label={st.key}
      color={i <= tpStageIdx ? "success" : "default"}
      variant={i <= tpStageIdx ? "filled" : "outlined"}
      sx={{ mr: 1, mb: 1 }}
    />
  ));

  const showUploadButton = isPayWaiting(order.paymentStatus) && order.orderStatus !== "CANCELLED";
  const expireAt = getExpireAt(order);
  const isExpired = isPayWaiting(order.paymentStatus) && Date.now() > expireAt.getTime();

  /* ------------ UI ------------ */
  return (
    <Box
      maxWidth={760}
      mx="auto"
      p={{ xs: 1.5, sm: 3 }}
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 10% -10%, rgba(62,142,247,0.08), transparent 50%)," +
          "radial-gradient(1200px 600px at 90% 110%, rgba(76,175,80,0.08), transparent 50%), #f7f9fc",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 4 },
          borderRadius: 4,
          background: "linear-gradient(180deg, #ffffff, #f8fbff)",
          border: "1px solid #e9eef9",
          boxShadow: "0 14px 34px rgba(23,71,187,0.10)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ribbon: payment status */}
        <Box
          sx={(t) => ({
            position: "absolute",
            top: 14,
            right: -46,
            transform: "rotate(45deg)",
            px: 7,
            py: 0.5,
            bgcolor: t.palette[paymentStatusInfo[order.paymentStatus]?.color || "grey"].main, // ✅ fallback ปลอดภัย
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.3,
            boxShadow: "0 6px 14px rgba(0,0,0,.2)",
            zIndex: 2,
          })}
        >
          <Stack direction="row" spacing={0.7} alignItems="center">
            {paymentStatusInfo[order.paymentStatus]?.icon}
            <span>{paymentStatusInfo[order.paymentStatus]?.label || order.paymentStatus}</span>
          </Stack>
        </Box>

        {/* Header */}
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
          <Typography variant="h5" fontWeight={800} color="primary" sx={{ letterSpacing: 0.3 }}>
            รายละเอียดออเดอร์
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {/* ✅ ใช้สถานะตามชนิดรับสินค้า */}
            {(() => {
              const info = getOrderStatusInfo(order.orderStatus, order.shippingType);
              return (
                <Chip
                  size="small"
                  color={
                    order.orderStatus === "CANCELLED" ? "error" :
                    order.orderStatus === "COMPLETED" ? "success" :
                    order.orderStatus === "SHIPPING" ? "info" : "primary"
                  }
                  icon={info.icon}
                  label={info.label}
                  sx={{ fontWeight: 700 }}
                />
              );
            })()}
            {isPayWaiting(order.paymentStatus) && (
              isExpired ? (
                <Chip size="small" color="error" icon={<ErrorOutlineIcon />} label="ออเดอร์หมดอายุ" sx={{ fontWeight: 700 }} />
              ) : (
                <Countdown end={expireAt} />
              )
            )}
          </Stack>
        </Stack>

        {/* Order meta */}
        <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
          <Typography fontWeight="bold">เลขออเดอร์:</Typography>
          <Typography color="secondary">{order.orderNo}</Typography>
        </Stack>
        <Typography color="text.secondary">วันที่สั่งซื้อ: {formatDate(order.createdAt)}</Typography>
        <Typography color="text.secondary" mb={2}>อัปเดตล่าสุด: {formatDate(order.updatedAt)}</Typography>

        {/* Amount card */}
        <Box
          sx={{
            my: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "#fffbe8",
            border: "1px dashed #ffe082",
            display: "inline-block",
          }}
        >
          <Typography fontWeight={800} color="warning.main">
            ยอดที่ต้องชำระ: {money(order.totalAmount)} บาท
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Customer brief */}
        <Stack direction="row" spacing={1} mb={1} alignItems="center">
          <PermIdentityIcon fontSize="small" color="info" />
          <Typography><b>ชื่อผู้สั่ง:</b> {order.customerName}</Typography>
        </Stack>
        {order.customerPhone && (
          <Stack direction="row" spacing={1} mb={1} alignItems="center">
            <LocalPhoneIcon fontSize="small" color="info" />
            <Typography><b>โทร:</b> {order.customerPhone}</Typography>
          </Stack>
        )}
        <Stack direction="row" spacing={1} mb={2} alignItems="center">
          <PermIdentityIcon fontSize="small" color="info" />
          <Typography><b>LINE ID:</b> {order.customerLineId}</Typography>
        </Stack>

        {/* Items */}
        <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
          รายการสินค้า
        </Typography>
        <Box sx={{ maxHeight: 200, overflow: "auto", pr: 0.5 }}>
          {order.items.map((item) => (
            <Box
              key={item._id || `${item.product}-${item.size}-${item.color}`}
              ml={1}
              mb={1}
              bgcolor="#f5f7fa"
              borderRadius={2}
              p={1}
              border="1px solid #eef2fb"
            >
              <Typography>
                <b>- {item.productName}</b> | ไซส์: {item.size} | สี: {item.color} | {money(item.price)} x {item.quantity} ={" "}
                <b style={{ color: "#1976d2" }}>{money(item.price * item.quantity)} บาท</b>
              </Typography>
            </Box>
          ))}
        </Box>

        <Typography variant="h6" mt={2} color="success.main">
          รวมเงินทั้งสิ้น: <b>{money(order.totalAmount)} บาท</b>
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Shipping */}
        <Typography>
          <b>การรับสินค้า:</b> {order.shippingType === "PICKUP" || order.shippingType?.startsWith("PICKUP_") ? "รับเอง" : "จัดส่ง"}
        </Typography>
        {order.customerAddress && (
          <Stack direction="row" spacing={1} alignItems="center" mt={1}>
            <PlaceIcon color="info" />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">ที่อยู่จัดส่ง:</Typography>
              <Typography color="text.secondary">{order.customerAddress}</Typography>
            </Box>
          </Stack>
        )}
        {order.shippingType === "DELIVERY" && (
          <Box ml={0} my={1}>
            <Typography>ขนส่ง: {order.shippingProvider || " - "}</Typography>
            <Typography>เลขพัสดุ: {order.trackingNumber || " - "}</Typography>
            {order.trackingNumber && (
              <Button
                variant="outlined"
                color="info"
                sx={{ my: 1 }}
                href={thaiPostUrl || undefined}
                target="_blank"
                startIcon={<LocalShippingIcon />}
              >
                เปิดดูในไปรษณีย์ไทย
              </Button>
            )}
          </Box>
        )}

        {/* Order progress (compact) */}
        <Box mt={2}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>ความคืบหน้าคำสั่งซื้อ</Typography>
          <OrderProgress status={order.orderStatus} shippingType={order.shippingType} /> {/* ✅ ส่ง shippingType */}
        </Box>

        {/* Tracking timeline (if any) */}
        {order.trackingNumber && (
          <Box mt={2}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>ไทม์ไลน์พัสดุ</Typography>

            {trackingLoading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={20} />
                <Typography>กำลังโหลดสถานะพัสดุ…</Typography>
              </Stack>
            )}

            {!trackingLoading && trackingError && (
              <Alert severity="warning">{trackingError}</Alert>
            )}

            {!trackingLoading && !trackingError && trackingHistory.length === 0 && (
              <Typography color="text.secondary">ยังไม่มีประวัติการขนส่ง</Typography>
            )}

            {!trackingLoading && trackingHistory.length > 0 && (
              <>
                <Box mb={1}>{TP_STAGES.length > 0 && tpStageChips}</Box>
                <Box sx={{ position: "relative", pl: 3 }}>
                  <Box sx={{ position: "absolute", left: 13, top: 4, bottom: 4, width: 2, bgcolor: "#e0e0e0", borderRadius: 1 }} />
                  <Stack spacing={1.2}>
                    {trackingHistory.map((h, i) => {
                      const isDone = String(h.status || "").includes("นำจ่ายสำเร็จ");
                      return (
                        <Stack key={`${h.status}-${h.timestamp}-${i}`} direction="row" spacing={1.5} alignItems="flex-start">
                          <Avatar sx={{ width: 28, height: 28, bgcolor: isDone ? "success.main" : "grey.300", fontSize: 14 }}>
                            {isDone ? "✓" : i + 1}
                          </Avatar>
                          <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography fontWeight="bold">{h.status || "-"}</Typography>
                            </Stack>
                            {h.location && (
                              <Typography variant="body2" color="text.secondary" mt={0.3}>
                                พิกัด/สาขา: {h.location}
                              </Typography>
                            )}
                            <Chip size="small" label={h.timestamp || "-"} variant="outlined" sx={{ mt: 0.6 }} />
                          </Paper>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              </>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Stack direction="row" spacing={1.2} justifyContent="center" flexWrap="wrap">
          <Button component={Link} to="/orders" variant="outlined">กลับไปหน้ารายการ</Button>

          {/* อัปโหลดสลิป (เฉพาะยังรอ/ไม่หมดอายุ/ไม่ยกเลิก) */}
          {showUploadButton && !isExpired ? (
            order.slipReviewCount >= 3 ? (
              <Alert
                severity="error"
                variant="filled"
                sx={{ fontWeight: "bold", display: "inline-flex", alignItems: "center" }}
              >
                อัปโหลดสลิปเกิน 3 ครั้ง กรุณาติดต่อเจ้าหน้าที่
              </Alert>
            ) : (
              <Button
                variant="contained"
                color="warning"
                component={Link}
                to={`/orders/${order._id}/upload-slip`}
                startIcon={<ReplayIcon />}
              >
                อัปโหลดสลิปใหม่
              </Button>
            )
          ) : null}

          {/* ดูสลิป (ถ้ามีไฟล์) */}
          {order.paymentSlipFilename && (
            <Button
              variant="outlined"
              color="info"
              onClick={handleOpenSlip}
              startIcon={<AssignmentTurnedInIcon />}
            >
              ดูรูปสลิป
            </Button>
          )}
        </Stack>

        {/* Big watermark when cancelled */}
        {order.orderStatus === "CANCELLED" && (
          <Box sx={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%) rotate(-16deg)",
            zIndex: 1, pointerEvents: "none", opacity: 0.16,
            fontSize: { xs: 32, sm: 68 }, color: "#d32f2f", fontWeight: "bold",
            letterSpacing: 2, userSelect: "none", whiteSpace: "nowrap"
          }}>
            <CancelIcon sx={{ fontSize:{ xs:30, sm:60 }, verticalAlign:"middle", mr:1 }} />
            ออเดอร์ถูกยกเลิก
          </Box>
        )}
      </Paper>

      {/* Slip viewer */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm">
        <Box p={2} textAlign="center" position="relative">
          {order.paymentStatus === "PAYMENT_CONFIRMED" && slipUrl !== "ERROR" && (
            <Box sx={{
              position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%,-50%) rotate(-16deg)",
              zIndex: 10, fontSize: { xs: 28, sm: 52 },
              color: "#24c27c", opacity: 0.25, fontWeight: "bold",
              pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap"
            }}>
              <AssignmentTurnedInIcon sx={{ fontSize: { xs: 22, sm: 44 }, mr: 1, verticalAlign: "middle" }} />
              ผ่านการตรวจสอบ
            </Box>
          )}
          {slipUrl === "ERROR" && <Typography color="error">โหลดสลิปไม่สำเร็จ</Typography>}
          {slipUrl && slipUrl !== "ERROR" && (
            <img
              src={slipUrl}
              alt="สลิป"
              style={{ maxWidth: 460, maxHeight: "75vh", border: "1px solid #eee", borderRadius: 8, background: "#fff" }}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          )}
          <Box mt={2}>
            <Button onClick={handleClose} variant="contained" color="primary">ปิด</Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}