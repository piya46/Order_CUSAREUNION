// src/pages/Orders/OrdersDetail.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box, Paper, Typography, Stack, Chip, Divider, Button, TextField, MenuItem,
  Alert, Grid, Skeleton, IconButton
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VerifiedIcon from "@mui/icons-material/Verified";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SaveIcon from "@mui/icons-material/Save";
import { getOrder, updateOrder, verifySlip } from "../../api/admin";

export default function OrdersDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrder(id!).then(d => { setOrder(d); setEdit(d); }).finally(() => setLoading(false));
  }, [id]);

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await updateOrder(id!, { orderStatus: edit.orderStatus, trackingNumber: edit.trackingNumber });
      setOrder(res); alert("บันทึกสำเร็จ");
    } catch(e) { alert("Error saving"); } finally { setSaving(false); }
  };

  const onVerifySlip = async () => {
    try {
      const res = await verifySlip(id!);
      setOrder(res.order); alert(`ตรวจสอบแล้ว: ${res.slipOkResult?.success ? "ผ่าน" : "ไม่ผ่าน"}`);
    } catch { alert("ตรวจสอบผิดพลาด"); }
  };

  if (loading || !order) return <Box p={4}><Skeleton variant="rectangular" height={200} /></Box>;

  // Deadline Calculation (Assume 24h)
  const deadline = new Date(new Date(order.createdAt).getTime() + 24 * 60 * 60 * 1000);
  const isExpired = new Date() > deadline && order.paymentStatus === "WAITING";

  return (
    <Box p={{ xs: 2, md: 4 }} maxWidth={1200} mx="auto">
      <Button startIcon={<ArrowBackIcon />} component={Link} to="/orders" sx={{ mb: 2 }}>กลับ</Button>

      {/* Top Banner Status */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>{order.orderNo}</Typography>
          <Typography color="text.secondary">สั่งเมื่อ: {new Date(order.createdAt).toLocaleString("th-TH")}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip label={order.paymentStatus} color={order.paymentStatus==="PAYMENT_CONFIRMED"?"success":"warning"} />
          <Chip label={order.orderStatus} color="primary" variant="outlined" />
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        {/* Left Column: Order Info */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>รายการสินค้า</Typography>
            <Divider sx={{ mb: 2 }} />
            {(order.items || []).map((it: any, i: number) => (
              <Stack key={i} direction="row" justifyContent="space-between" mb={1}>
                <Typography>{it.productName} <Typography component="span" color="text.secondary" variant="body2">({it.size} {it.color})</Typography></Typography>
                <Typography>x{it.quantity} = {(it.price * it.quantity).toLocaleString()} ฿</Typography>
              </Stack>
            ))}
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6">ยอดรวมสุทธิ</Typography>
              <Typography variant="h6" color="primary.dark">{order.totalAmount.toLocaleString()} ฿</Typography>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>การจัดส่ง</Typography>
            <Typography variant="body1" fontWeight={600} mt={1}>{order.shippingType}</Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: "pre-line", mt: 1 }}>
              {order.customerName} (Tel: {order.customerPhone}){"\n"}
              {order.customerAddress || "ไม่มีที่อยู่"}
            </Typography>
            <Box mt={2} display="flex" gap={2}>
               <TextField 
                 size="small" label="Tracking Number" value={edit.trackingNumber||""} 
                 onChange={e=>setEdit({...edit, trackingNumber:e.target.value})} fullWidth 
               />
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Actions & Payment */}
        <Grid item xs={12} md={4}>
          {/* Payment Info Card */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: '#FFF8E1', border: '1px solid #FFECB3' }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <AccessTimeIcon color={isExpired ? "error" : "action"} />
              <Typography variant="subtitle2" color="text.secondary">Payment Deadline</Typography>
            </Stack>
            <Typography variant="h5" fontWeight={600} color={isExpired ? "error" : "text.primary"}>
              {deadline.toLocaleString("th-TH")}
            </Typography>
            {isExpired && <Chip label="หมดเวลาชำระเงินแล้ว" color="error" size="small" sx={{ mt: 1 }} />}
          </Paper>

          {/* Slip Action Card */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>หลักฐานการโอน</Typography>
            {order.paymentSlipFilename ? (
              <Box>
                <img src={`${import.meta.env.VITE_API_URL}/files/${order.paymentSlipFilename}`} alt="slip" style={{ width: "100%", borderRadius: 8, marginBottom: 16 }} />
                <Button fullWidth variant="outlined" startIcon={<VerifiedIcon />} onClick={onVerifySlip}>
                  ตรวจสอบสลิป (SlipOK)
                </Button>
                {order.slipReviewCount > 0 && <Alert severity="warning" sx={{ mt: 1 }}>ตรวจสอบแล้ว {order.slipReviewCount} ครั้ง</Alert>}
              </Box>
            ) : (
              <Alert severity="info">ยังไม่มีสลิป</Alert>
            )}
          </Paper>

          {/* Admin Actions */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>จัดการสถานะ</Typography>
            <TextField 
              select fullWidth label="Order Status" value={edit.orderStatus||""} 
              onChange={e=>setEdit({...edit, orderStatus:e.target.value})} sx={{ mb: 2 }}
            >
              {["RECEIVED","PREPARING_ORDER","SHIPPING","COMPLETED","CANCELLED"].map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <Button fullWidth variant="contained" size="large" startIcon={<SaveIcon />} onClick={onSave} disabled={saving}>
              บันทึกการเปลี่ยนแปลง
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}