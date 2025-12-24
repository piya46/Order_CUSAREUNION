// src/pages/Orders/OrdersDetail.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Stack, Chip, Divider, Button, TextField, MenuItem,
  Alert, Grid, Skeleton, IconButton, Stepper, Step, StepLabel, Card, CardContent,
  Dialog, DialogContent, useTheme, alpha, CircularProgress
} from "@mui/material";

// Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VerifiedIcon from "@mui/icons-material/Verified";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

import { getOrder, updateOrder, verifySlip } from "../../api/admin";
const API = import.meta.env.VITE_API_URL || "/api";

const STEPS = ["RECEIVED", "PREPARING_ORDER", "SHIPPING", "COMPLETED"];
const STEP_LABELS: Record<string, string> = { 
    RECEIVED: "รับออเดอร์", 
    PREPARING_ORDER: "กำลังเตรียม", 
    SHIPPING: "จัดส่งแล้ว", 
    COMPLETED: "สำเร็จ" 
};

export default function OrdersDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slipZoom, setSlipZoom] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = () => {
    getOrder(id!).then(d => { 
      setOrder(d); 
      setEdit(d); 
    }).catch(()=>nav("/orders")).finally(() => setLoading(false));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await updateOrder(id!, { orderStatus: edit.orderStatus, trackingNumber: edit.trackingNumber });
      setOrder(res); 
      alert("✅ บันทึกสำเร็จ");
    } catch(e) { 
        alert("เกิดข้อผิดพลาดในการบันทึก"); 
    } finally { 
        setSaving(false); 
    }
  };

  const onVerifySlip = async () => {
    try {
      const res = await verifySlip(id!);
      setOrder(res.order); 
      alert(`ตรวจสอบแล้ว: ${res.slipOkResult?.success ? "✅ สลิปถูกต้อง" : "❌ สลิปไม่ผ่าน"}`);
    } catch { 
        alert("ตรวจสอบผิดพลาด"); 
    }
  };

  const handleAdminUploadSlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("slip", file);

    setUploading(true);
    try {
      const res = await fetch(`${API}/orders/${id}/upload-slip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setOrder(data.order);
        alert("✅ อัปโหลดสลิปสำเร็จ และระบบได้ตรวจสอบข้อมูลเบื้องต้นแล้ว");
      } else {
        alert("❌ " + (data.error || "อัปโหลดไม่สำเร็จ"));
      }
    } catch (err) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDelete = async () => {
      if(!confirm("⚠️ ยืนยันการลบออเดอร์นี้ถาวร?")) return;
      try {
          await fetch(`${API}/orders/${id}`, { 
             method: 'DELETE', 
             headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` } 
          });
          nav("/orders");
      } catch { alert("ลบไม่สำเร็จ"); }
  };

  const onPrintAddress = () => {
      const w = window.open('', '_blank');
      if(w) {
          w.document.write(`
            <html>
                <body style="font-family: sans-serif; padding: 40px; text-align: center; border: 2px solid #000; max-width: 500px; margin: 20px auto;">
                    <h2 style="margin-bottom: 20px;">ผู้รับ (To)</h2>
                    <h1 style="font-size: 24px; margin-bottom: 10px;">${order.customerName}</h1>
                    <p style="font-size: 18px; line-height: 1.6;">${order.customerAddress}</p>
                    <h3 style="margin-top: 20px;">Tel: ${order.customerPhone}</h3>
                    <hr style="margin: 30px 0;" />
                    <p style="font-size: 14px; color: #666;">Order: ${order.orderNo}</p>
                </body>
            </html>
          `);
          w.document.close();
          w.print();
      }
  };

  if (loading || !order) return <Box p={4}><Skeleton variant="rectangular" height={200} /></Box>;

  const deadline = new Date(new Date(order.createdAt).getTime() + 24 * 60 * 60 * 1000);
  const isExpired = new Date() > deadline && order.paymentStatus === "WAITING";
  const activeStep = STEPS.indexOf(order.orderStatus);

  return (
    <Box p={{ xs: 2, md: 4 }} maxWidth={1200} mx="auto">
      {/* Hidden File Input */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleAdminUploadSlip} 
      />

      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Button startIcon={<ArrowBackIcon />} component={Link} to="/orders" sx={{ fontWeight: 700, color: 'text.secondary' }}>ย้อนกลับ</Button>
        <Button startIcon={<DeleteForeverIcon />} onClick={onDelete} color="error">ลบออเดอร์</Button>
      </Stack>

      {/* Header Info */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, boxShadow: theme.shadows[2] }}>
          <Stack direction={{ xs:'column', md:'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                    <Typography variant="h4" fontWeight={900} color="primary">{order.orderNo}</Typography>
                    <Chip label={order.shippingType || "DELIVERY"} size="small" sx={{ fontWeight: 700 }} />
                </Stack>
                <Typography color="text.secondary">สั่งเมื่อ: {new Date(order.createdAt).toLocaleString("th-TH")}</Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={onPrintAddress}>พิมพ์ใบปะหน้า</Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Box px={{ xs:0, md:4 }}>
              <Stepper activeStep={activeStep >= 0 ? activeStep : 0} alternativeLabel>
                  {STEPS.map((label) => (
                    <Step key={label}>
                        <StepLabel StepIconProps={{ 
                            sx: { '&.Mui-active, &.Mui-completed': { color: 'success.main' } } 
                        }}>
                            {STEP_LABELS[label] || label}
                        </StepLabel>
                    </Step>
                  ))}
              </Stepper>
              {order.orderStatus === "CANCELLED" && (
                  <Alert severity="error" sx={{ mt: 2, justifyContent: 'center' }}>ออเดอร์ถูกยกเลิก</Alert>
              )}
          </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Left: Items & Shipping */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <Box p={0.5} borderRadius={1} bgcolor="primary.main" color="white"><LocalShippingIcon fontSize="small"/></Box>
                <Typography variant="h6" fontWeight={700}>รายการสินค้า</Typography>
            </Stack>
            <Box sx={{ bgcolor: '#FAFAFA', borderRadius: 2, p: 2 }}>
                {(order.items || []).map((it: any, i: number) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" mb={1.5} pb={1.5} borderBottom={i < order.items.length-1 ? "1px dashed #ddd" : "none"}>
                    <Box>
                        <Typography fontWeight={600}>{it.productName}</Typography>
                        <Typography variant="caption" color="text.secondary">ตัวเลือก: {it.size || "-"} {it.color || ""}</Typography>
                    </Box>
                    <Stack alignItems="flex-end">
                        <Typography fontWeight={700}>{(it.price * it.quantity).toLocaleString()} ฿</Typography>
                        <Typography variant="caption" color="text.secondary">x{it.quantity}</Typography>
                    </Stack>
                </Stack>
                ))}
            </Box>
            <Stack direction="row" justifyContent="space-between" mt={3} pt={2} borderTop="1px solid #eee">
              <Typography variant="h6" fontWeight={700}>ยอดรวมสุทธิ</Typography>
              <Typography variant="h5" fontWeight={900} color="primary.dark">{order.totalAmount.toLocaleString()} ฿</Typography>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>ข้อมูลจัดส่ง</Typography>
            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
                <CardContent>
                    <Typography variant="subtitle1" fontWeight={700}>{order.customerName}</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1}>{order.customerPhone}</Typography>
                    <Typography variant="body1">{order.customerAddress || "ไม่มีที่อยู่"}</Typography>
                </CardContent>
            </Card>
            
            <Grid container spacing={2} alignItems="flex-end">
               <Grid item xs={12} sm={8}>
                  <TextField 
                    size="small" label="Tracking Number (เลขพัสดุ)" value={edit.trackingNumber||""} 
                    onChange={e=>setEdit({...edit, trackingNumber:e.target.value})} fullWidth 
                    placeholder="เช่น TH12345678"
                  />
               </Grid>
               <Grid item xs={12} sm={4}>
                  <Button variant="contained" fullWidth onClick={onSave} disabled={saving} startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}>
                    {saving ? "กำลังบันทึก" : "บันทึกเลขพัสดุ"}
                  </Button>
               </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Right: Payment & Status */}
        <Grid item xs={12} md={4}>
          
          {/* Slip Card */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: order.paymentStatus==='PAYMENT_CONFIRMED'?'success.light':'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                 <Typography variant="h6" fontWeight={700}>หลักฐานการโอน</Typography>
                 <Chip 
                    label={order.paymentStatus} 
                    color={order.paymentStatus==="PAYMENT_CONFIRMED"?"success":order.paymentStatus==="REJECTED"?"error":"warning"} 
                    size="small"
                 />
            </Stack>

            {order.paymentSlipFilename ? (
              <Box>
                <Box 
                    sx={{ 
                        position: 'relative', 
                        cursor: 'pointer', 
                        borderRadius: 2, 
                        overflow: 'hidden',
                        border: '1px solid #eee',
                        '&:hover .overlay': { opacity: 1 }
                    }}
                    onClick={()=>setSlipZoom(true)}
                >
                    <img src={`${import.meta.env.VITE_API_URL}/files/${order.paymentSlipFilename}`} alt="slip" style={{ width: "100%", display: 'block' }} />
                    <Box className="overlay" sx={{ 
                        position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.2s' 
                    }}>
                        <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                    </Box>
                </Box>

                <Stack spacing={1} mt={2}>
                    <Button 
                        fullWidth 
                        variant="contained" 
                        startIcon={<VerifiedIcon />} 
                        onClick={onVerifySlip} 
                        color={order.slipOkResult?.success ? "success" : "primary"}
                    >
                      {order.slipOkResult?.success ? "ตรวจสอบแล้ว (ผ่าน)" : "ตรวจสอบสลิป (SlipOK)"}
                    </Button>
                    <Button 
                        fullWidth 
                        variant="outlined" 
                        startIcon={<PhotoCameraIcon />} 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูปสลิปใหม่"}
                    </Button>
                </Stack>
              </Box>
            ) : (
               <Box textAlign="center" py={4} bgcolor="#F5F5F5" borderRadius={2} border="2px dashed #ccc">
                   <AccessTimeIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                   <Typography color="text.secondary">ยังไม่มีการแนบสลิป</Typography>
                   <Button 
                        variant="contained" 
                        startIcon={<CloudUploadIcon />} 
                        sx={{ mt: 1 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                   >
                        {uploading ? "กำลังอัปโหลด..." : "อัปโหลดสลิปแทนลูกค้า"}
                   </Button>
                   {isExpired && <Typography color="error" variant="caption" display="block" mt={1}>หมดเวลาชำระเงินแล้ว</Typography>}
               </Box>
            )}
          </Paper>

          {/* Status Actions */}
          <Paper sx={{ p: 3, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>เปลี่ยนสถานะ</Typography>
            <TextField 
              select fullWidth label="Order Status" value={edit.orderStatus||""} 
              onChange={e=>setEdit({...edit, orderStatus:e.target.value})} sx={{ mb: 2, bgcolor: 'white' }}
            >
              {Object.keys(STEP_LABELS).concat(["CANCELLED"]).map(s=>(
                  <MenuItem key={s} value={s}>{STEP_LABELS[s] || s}</MenuItem>
              ))}
            </TextField>
            <Button fullWidth variant="contained" size="large" startIcon={<SaveIcon />} onClick={onSave} disabled={saving} sx={{ borderRadius: 2, fontWeight: 700 }}>
              บันทึกสถานะ
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Slip Zoom Dialog */}
      <Dialog open={slipZoom} onClose={()=>setSlipZoom(false)} maxWidth="sm">
          <DialogContent sx={{ p: 0 }}>
              {order.paymentSlipFilename && (
                  <img src={`${import.meta.env.VITE_API_URL}/files/${order.paymentSlipFilename}`} alt="slip full" style={{ width: "100%" }} />
              )}
          </DialogContent>
      </Dialog>
    </Box>
  );
}