// src/pages/OrderList.jsx
import { useContext, useEffect, useState, useMemo } from 'react';
import { LiffContext } from '../context/LiffContext';
import { getOrders } from '../api/orderApi';
import api from '../api/axios';

import {
  Box, Typography, Card, CardContent, Button, Grid, Chip, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Alert, Tooltip, LinearProgress
} from '@mui/material';

import { Link } from 'react-router-dom';

import CancelIcon from '@mui/icons-material/Cancel';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront'; // ✅ แสดง “สินค้าพร้อมรับ”

/* ---------- mapping พื้นฐาน ---------- */
const paymentStatusMap = {
  WAITING: 'รอชำระเงิน',
  PENDING_PAYMENT: 'รอตรวจสอบ',
  PAYMENT_CONFIRMED: 'ชำระเงินสำเร็จ',
  REJECTED: 'สลิปไม่ผ่าน',
  EXPIRED: 'หมดอายุ',
};

const baseOrderStatusMap = {
  RECEIVED: 'รับออเดอร์แล้ว',
  PREPARING_ORDER: 'กำลังจัดเตรียม',
  SHIPPING: 'อยู่ระหว่างการจัดส่ง', // จะถูกแปลงเป็น “สินค้าพร้อมรับ” เมื่อเป็นรับเอง
  COMPLETED: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
};

const baseStatusIcon = {
  RECEIVED: <ShoppingBagIcon fontSize="small" />,
  PREPARING_ORDER: <PendingActionsIcon fontSize="small" />,
  SHIPPING: <LocalShippingIcon fontSize="small" />, // จะสลับเป็น Storefront เมื่อเป็นรับเอง
  COMPLETED: <DoneAllIcon fontSize="small" />,
  CANCELLED: <CancelIcon fontSize="small" />,
  WAITING: <HourglassBottomIcon fontSize="small" />,
  PENDING_PAYMENT: <PendingActionsIcon fontSize="small" />,
  PAYMENT_CONFIRMED: <AssignmentTurnedInIcon fontSize="small" />,
  REJECTED: <ErrorOutlineIcon fontSize="small" />,
  EXPIRED: <ErrorOutlineIcon fontSize="small" />,
};

/* ✅ สร้าง label+icon ตามชนิดรับสินค้า */
function statusInfoByShipping(status, shippingType) {
  const isPickup = shippingType && shippingType !== 'DELIVERY';
  if (status === 'SHIPPING' && isPickup) {
    return { label: 'สินค้าพร้อมรับ', icon: <StorefrontIcon fontSize="small" /> };
  }
  return { label: baseOrderStatusMap[status] || status, icon: baseStatusIcon[status] };
}

const tabConfig = [
  { key: 'ALL', label: 'ทั้งหมด', statuses: [] },
  { key: 'WAITING', label: 'รอชำระ/ตรวจสอบ', statuses: ['WAITING', 'PENDING_PAYMENT', 'REJECTED'] },
  { key: 'PROCESSING', label: 'กำลังดำเนินการ', statuses: ['RECEIVED', 'PREPARING_ORDER', 'SHIPPING'] },
  { key: 'COMPLETED', label: 'สำเร็จ', statuses: ['COMPLETED'] },
  { key: 'CANCELLED', label: 'ยกเลิก/หมดอายุ', statuses: ['CANCELLED', 'EXPIRED'] },
];

/* ---------- utils ---------- */
const money = (n) => Number(n || 0).toLocaleString('th-TH');
const getExpireAt = (order) =>
  new Date(order.expiredAt || (new Date(order.createdAt).getTime() + 30 * 60 * 1000));
const shouldCountdown = (o) =>
  ['WAITING', 'PENDING_PAYMENT', 'REJECTED'].includes(o.paymentStatus) &&
  !['CANCELLED', 'COMPLETED', 'SHIPPING'].includes(o.orderStatus);

/* ---------- นาฬิกานับถอยหลัง ---------- */
function Countdown({ end }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(end).getTime() - Date.now()));
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft(Math.max(0, new Date(end).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [end, left]);

  if (left <= 0) {
    return <Chip size="small" color="error" icon={<ErrorOutlineIcon />} label="หมดเวลา" sx={{ fontWeight: 700 }} />;
  }
  const s = Math.floor(left / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
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

/* ---------- Progress ขั้นตอน (แปรผันตามชนิดรับสินค้า) ---------- */
const ORDER_STEPS = ['RECEIVED', 'PREPARING_ORDER', 'SHIPPING', 'COMPLETED'];
const stepIndex = (status) => Math.max(0, ORDER_STEPS.indexOf(status));

function OrderProgress({ status, shippingType }) {
  const idx = stepIndex(status);
  const percent = (idx / (ORDER_STEPS.length - 1)) * 100;
  return (
    <Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { borderRadius: 3 }, mb: 0.8 }}
      />
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {ORDER_STEPS.map((st, i) => {
          const info = statusInfoByShipping(st, shippingType);
          return (
            <Chip
              key={st}
              size="small"
              icon={info.icon}
              label={info.label}
              color={i <= idx ? 'primary' : 'default'}
              variant={i <= idx ? 'filled' : 'outlined'}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

/* =================== Component =================== */
export default function OrderList() {
  const { ready, profile, reauthorize, error: liffError } = useContext(LiffContext);
  const [orders, setOrders] = useState([]);
  const [fetchErr, setFetchErr] = useState(null);

  const [trackingCache, setTrackingCache] = useState({});
  const [trackingData, setTrackingData] = useState([]);
  const [openTracking, setOpenTracking] = useState(false);

  const [currentTab, setCurrentTab] = useState('ALL');
  const [openLegend, setOpenLegend] = useState(false); // dialog คำอธิบายสถานะ

  useEffect(() => {
    if (!ready || !profile?.userId) return;
    (async () => {
      try {
        setFetchErr(null);
        const data = await getOrders(profile.userId);
        setOrders(Array.isArray(data) ? data : (data?.data || []));
      } catch (e) {
        setFetchErr(e);
      }
    })();
  }, [ready, profile?.userId]);

  const openTrackingModal = async (trackingNo) => {
    if (!trackingNo) { setTrackingData([]); setOpenTracking(true); return; }
    if (trackingCache[trackingNo]) { setTrackingData(trackingCache[trackingNo]); setOpenTracking(true); return; }
    try {
      const res = await api.get(`/api/tracking/${encodeURIComponent(trackingNo)}`);
      const history = res.data?.history || [];
      setTrackingCache(prev => ({ ...prev, [trackingNo]: history }));
      setTrackingData(history);
    } catch { setTrackingData([]); } finally { setOpenTracking(true); }
  };

  const getTabCount = (key) => {
    if (key === 'ALL') return orders.length;
    const statuses = tabConfig.find(t => t.key === key).statuses;
    return orders.filter(o => statuses.includes(o.orderStatus) || statuses.includes(o.paymentStatus)).length;
  };

  const filteredOrders = useMemo(() => {
    if (currentTab === 'ALL') return orders;
    const statuses = tabConfig.find(t => t.key === currentTab).statuses;
    return orders.filter(o => statuses.includes(o.orderStatus) || statuses.includes(o.paymentStatus));
  }, [orders, currentTab]);

  if (!ready) return <Box p={3} textAlign="center"><Typography>กำลังตรวจสอบสิทธิ์ผ่าน LINE…</Typography></Box>;

  if (!profile?.userId) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" gutterBottom>ต้องเข้าสู่ระบบด้วย LINE ก่อน</Typography>
        <Button variant="contained" onClick={() => reauthorize?.()}>เข้าสู่ระบบใหม่</Button>
        {liffError && <Typography sx={{ mt: 1 }} color="error">{String(liffError?.friendlyMessage || liffError?.message || liffError)}</Typography>}
      </Box>
    );
  }

  const is401 = fetchErr && (fetchErr.response?.status === 401 || fetchErr.code === 'ERR_BAD_REQUEST');

  return (
    <Box
      p={{ xs: 1.5, sm: 2.5 }}
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(62,142,247,0.08), transparent 50%),' +
          'radial-gradient(1200px 600px at 90% 110%, rgba(76,175,80,0.08), transparent 50%), #f7f9fc',
      }}
    >
      <Typography variant="h5" mb={1.5} fontWeight={800} textAlign="center" letterSpacing={0.3}>
        รายการสั่งซื้อของคุณ
      </Typography>

      {/* ปุ่มช่วยเหลือ — แสดงเฉพาะตอนกด */}
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }} flexWrap="wrap">
        <Button size="small" variant="outlined" startIcon={<HelpOutlineRoundedIcon />} onClick={() => setOpenLegend(true)}>
          คำอธิบายสถานะ
        </Button>
        <Chip size="small" icon={<InfoOutlinedIcon />} label="ใบที่รอชำระ/รอตรวจสอบจะแสดงเวลานับถอยหลังให้" sx={{ bgcolor: 'white' }} />
      </Stack>

      {is401 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          เซสชันหมดอายุหรือสิทธิ์ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่
          <Box mt={1}><Button variant="contained" size="small" onClick={() => reauthorize?.()}>เข้าสู่ระบบใหม่</Button></Box>
        </Alert>
      )}

      <Tabs
        value={currentTab}
        onChange={(e, val) => setCurrentTab(val)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, bgcolor: 'white', borderRadius: 2, boxShadow: '0 6px 18px rgba(17, 42, 134, 0.08)' }}
      >
        {tabConfig.map(tab => (
          <Tab key={tab.key} value={tab.key} label={`${tab.label} (${getTabCount(tab.key)})`} sx={{ fontWeight: 700 }} />
        ))}
      </Tabs>

      <Grid container spacing={2}>
        {filteredOrders.map(order => {
          const expireAt = getExpireAt(order);
          const now = Date.now();
          const expired = shouldCountdown(order) && now > expireAt.getTime();
          const cancelled = order.orderStatus === 'CANCELLED';
          const trackingNo = order.trackingNumber;

          const isAttention = expired || cancelled || order.paymentStatus === 'REJECTED';
          const frameColor = isAttention ? '#f55' : '#d2e9ff';
          const bg = isAttention
            ? 'linear-gradient(120deg, #fdf3f4 90%, #f6f6f7 100%)'
            : 'linear-gradient(180deg, #ffffff, #f8fbff)';

          // ✅ เลือก label/icon สำหรับ chip ตามชนิดรับสินค้า
          const { label: orderLabel, icon: orderIcon } = statusInfoByShipping(order.orderStatus, order.shippingType);

          return (
            <Grid item key={order._id} xs={12} md={6} lg={4} sx={{ width: '100%' }}>
              <Box position="relative">
                {/* Ribbon payment */}
                <Box
                  sx={{
                    position: 'absolute', top: 12, right: -42, zIndex: 2, transform: 'rotate(45deg)',
                    px: 6, py: .5,
                    bgcolor:
                      order.paymentStatus === 'PAYMENT_CONFIRMED' ? 'success.main' :
                      order.paymentStatus === 'REJECTED' ? 'error.main' :
                      order.paymentStatus === 'PENDING_PAYMENT' ? 'info.main' :
                      order.paymentStatus === 'WAITING' ? 'warning.main' : 'text.disabled',
                    color: '#fff', fontSize: 12, boxShadow: '0 6px 14px rgba(0,0,0,.2)',
                  }}
                >
                  {baseStatusIcon[order.paymentStatus]} {paymentStatusMap[order.paymentStatus] || order.paymentStatus}
                </Box>

                <Card
                  elevation={0}
                  sx={{
                    mb: 2,
                    border: `2px solid ${frameColor}`,
                    borderRadius: 3,
                    background: bg,
                    boxShadow: '0 10px 22px rgba(23,71,187,0.08)',
                    overflow: 'hidden',
                    filter: cancelled ? 'grayscale(0.2)' : 'none'
                  }}
                >
                  <CardContent sx={{ opacity: expired || cancelled ? 0.9 : 1 }}>
                    {/* header */}
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={.5}>
                      <Typography variant="h6" fontWeight="800" sx={{ letterSpacing: .2 }}>{order.orderNo}</Typography>
                      <Tooltip title="สถานะคำสั่งซื้อ">
                        <Chip
                          size="small"
                          color={
                            order.orderStatus === 'CANCELLED' ? 'error' :
                            order.orderStatus === 'COMPLETED' ? 'success' :
                            order.orderStatus === 'SHIPPING' ? 'info' : 'primary'
                          }
                          icon={orderIcon}
                          label={orderLabel}
                          sx={{ fontWeight: 700 }}
                        />
                      </Tooltip>
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      วันที่สั่งซื้อ: {new Date(order.createdAt).toLocaleString('th-TH')}
                    </Typography>
                    <Divider sx={{ my: 1.2 }} />

                    {/* items */}
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>รายการสินค้า</Typography>
                    <Box sx={{ maxHeight: 120, overflow: 'auto', pr: .5 }}>
                      {order.items?.map((item, idx) => (
                        <Typography
                          key={item?._id || `${item?.productName || 'item'}-${item?.size || ''}-${item?.color || ''}-${idx}`}
                          variant="body2"
                          component="div"
                        >
                          • {item.productName} | ไซส์: {item.size} | สี: {item.color} | x{item.quantity} | {money(item.price)} บาท
                        </Typography>
                      ))}
                    </Box>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.2}>
                      <Typography fontWeight="bold">
                        รวมเงิน: <b style={{ color: '#1976d2' }}>{money(order.totalAmount)} บาท</b>
                      </Typography>
                      {shouldCountdown(order) && <Countdown end={expireAt} />}
                    </Stack>

                    {/* Progress แสดงข้อความถูกต้องตามชนิดรับสินค้า */}
                    <Box mt={1.5}>
                      <OrderProgress status={order.orderStatus} shippingType={order.shippingType} />
                    </Box>

                    {/* actions */}
                    <Stack direction="row" spacing={1} mt={2} alignItems="center" flexWrap="wrap">
                      <Button component={Link} to={`/orders/${order._id}`} size="small" variant="outlined">
                        ดูรายละเอียด
                      </Button>

                      {/* อัปโหลดสลิป (เฉพาะยังรอ/ไม่หมดอายุ/ไม่ยกเลิก) */}
                      {shouldCountdown(order) && !expired && order.orderStatus !== 'CANCELLED' && (
                        <Button
                          component={Link}
                          to={`/orders/${order._id}/upload-slip`}
                          size="small"
                          variant="contained"
                          color="warning"
                          startIcon={<AssignmentTurnedInIcon />}
                        >
                          อัปโหลดสลิป
                        </Button>
                      )}

                      {/* ติดตามพัสดุ: แสดงเฉพาะกรณีจัดส่งจริง */}
                      {order.shippingType === 'DELIVERY' && order.orderStatus === 'SHIPPING' && trackingNo && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<LocalShippingIcon />}
                          onClick={() => openTrackingModal(trackingNo)}
                        >
                          ติดตามพัสดุ
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {(expired || cancelled) && (
                  <Box
                    sx={{
                      pointerEvents: 'none',
                      position: 'absolute',
                      zIndex: 3,
                      left: '50%',
                      top: '44%',
                      transform: 'translate(-50%, -50%) rotate(-16deg)',
                      fontWeight: 'bold',
                      fontSize: { xs: 28, sm: 52 },
                      color: cancelled ? '#d32f2f' : '#ef5350',
                      opacity: 0.18,
                      userSelect: 'none',
                      textShadow: '0 2px 12px #fff',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cancelled ? (
                      <><CancelIcon sx={{ fontSize: { xs: 26, sm: 44 }, mr: 1 }} /> ออเดอร์ถูกยกเลิก</>
                    ) : (
                      <><ErrorOutlineIcon sx={{ fontSize: { xs: 26, sm: 44 }, mr: 1 }} /> ออเดอร์หมดอายุ</>
                    )}
                  </Box>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* Tracking modal */}
      <Dialog open={openTracking} onClose={() => setOpenTracking(false)} fullWidth maxWidth="sm">
        <DialogTitle>สถานะพัสดุ</DialogTitle>
        <DialogContent>
          {trackingData.length > 0 ? (
            trackingData.map((step, i) => (
              <Box key={`${step.status}-${step.timestamp}-${i}`} mb={1}>
                <Typography variant="body2" fontWeight="bold">{step.status}</Typography>
                <Typography variant="caption" color="text.secondary">{step.timestamp}</Typography>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">ไม่มีข้อมูลพัสดุ</Typography>
          )}
        </DialogContent>
      </Dialog>

      {/* Legend modal — แสดงเฉพาะเมื่อกดปุ่ม */}
      <Dialog open={openLegend} onClose={() => setOpenLegend(false)} fullWidth maxWidth="sm">
        <DialogTitle>คำอธิบายสถานะ</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip icon={<HourglassBottomIcon />} label="รอชำระเงิน" />
            <Chip icon={<PendingActionsIcon />} label="รอตรวจสอบ" />
            <Chip color="success" icon={<AssignmentTurnedInIcon />} label="ชำระเงินสำเร็จ" />
            <Chip color="error" icon={<ErrorOutlineIcon />} label="สลิปไม่ผ่าน" />
            <Chip color="default" icon={<ErrorOutlineIcon />} label="หมดอายุ" />
            <Chip color="primary" icon={<ShoppingBagIcon />} label="รับออเดอร์แล้ว" />
            <Chip color="primary" icon={<PendingActionsIcon />} label="กำลังจัดเตรียม" />
            <Chip color="info" icon={<LocalShippingIcon />} label="จัดส่งแล้ว" />
            <Chip color="success" icon={<StorefrontIcon />} label="สินค้าพร้อมรับ (รับเอง)" /> {/* ✅ เพิ่ม */}
            <Chip color="success" icon={<DoneAllIcon />} label="สำเร็จ" />
            <Chip color="error" icon={<CancelIcon />} label="ยกเลิก" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            หมายเหตุ: ถ้าใบสั่งซื้ออยู่ในสถานะ “รอชำระ/รอตรวจสอบ” จะมีตัวจับเวลาแสดงเวลาคงเหลือให้ชำระค่ะ
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLegend(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}