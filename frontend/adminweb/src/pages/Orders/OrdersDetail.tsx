// src/pages/Orders/OrdersDetail.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Stack, Chip, Divider, Button, TextField, MenuItem,
  Alert, Grid, Skeleton, Stepper, Step, StepLabel, Card, CardContent,
  Dialog, DialogContent, useTheme, alpha
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
import BrokenImageIcon from "@mui/icons-material/BrokenImage";

// Import API
import { getOrder, updateOrder, verifySlip, getSlipSignedUrl, retrySlip, Order } from "../../api/admin";

// ✅ CONFIG: กำหนด Domain API ที่ถูกต้อง (Hardcode เพื่อความชัวร์ใน Production)
const TARGET_API_ORIGIN = "https://api.cusa.sellers.pstpyst.com";
const API_BASE_URL = `${TARGET_API_ORIGIN}/api`;

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
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>({});
  const [saving, setSaving] = useState(false);
  
  // State สำหรับจัดการรูปสลิป
  const [slipZoom, setSlipZoom] = useState(false);
  const [slipUrl, setSlipUrl] = useState<string>("");
  const [slipError, setSlipError] = useState(false);

  // โหลดข้อมูลเมื่อเข้าหน้าเว็บ
  useEffect(() => {
    setLoading(true);
    fetchOrderData();
  }, [id]);

  const fetchOrderData = () => {
    getOrder(id!)
      .then(d => { 
        setOrder(d); 
        setEdit(d); 
        
        if (d.slipUrl) {
            setSlipUrl(d.slipUrl);
            setSlipError(false);
        } else if (d.paymentSlipFilename) {
            fetchSlipUrl(d._id);
        } else {
            setSlipUrl(""); 
        }
      })
      .catch((err) => {
        console.error(err);
        nav("/orders");
      })
      .finally(() => setLoading(false));
  };

  const fetchSlipUrl = async (orderId: string) => {
    setSlipError(false);
    try {
      const result = await getSlipSignedUrl(orderId);
      const rawUrl = typeof result === 'string' ? result : result?.url;
      
      if (rawUrl) {
        // ✅ FIX: ใช้ Logic เดียวกับฝั่ง LIFF เพื่อบังคับ Domain ที่ถูกต้อง
        
        // 1. สร้าง URL Object เพื่อแยก Path (ป้องกันปัญหา Relative/Absolute URL ผสมกัน)
        const urlObj = new URL(rawUrl, window.location.origin);
        
        // 2. ดึงเฉพาะ Path และ Query String (เช่น /api/files/xxx.jpg?sig=...)
        const pathAndQuery = urlObj.pathname + urlObj.search;

        // 3. นำมาต่อกับ Domain จริงที่ Hardcode ไว้
        // ผลลัพธ์จะเป็น https://api.cusa.../api/files/... เสมอ
        const finalUrl = `${TARGET_API_ORIGIN}${pathAndQuery}`;
        
        console.log("✅ Fixed Slip URL:", finalUrl);
        setSlipUrl(finalUrl);
      }
    } catch (error) {
      console.error("Error fetching slip URL:", error);
      setSlipError(true);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await updateOrder(id!, { orderStatus: edit.orderStatus, trackingNumber: edit.trackingNumber });
      setOrder(res); 
      alert("✅ บันทึกสถานะเรียบร้อย");
    } catch(e) { 
        alert("Error saving"); 
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
        alert("เกิดข้อผิดพลาดในการตรวจสอบ"); 
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!confirm("ยืนยันการอัปโหลดสลิปนี้แทนลูกค้า?")) {
        e.target.value = "";
        return;
    }

    try {
        const res = await retrySlip(id!, file);
        setOrder(res.order);
        alert("✅ อัปโหลดสลิปเรียบร้อย");
        
        if (res.order.paymentSlipFilename) {
            setSlipError(false);
            setSlipUrl(""); 
            fetchSlipUrl(res.order._id);
        }
    } catch (err) {
        alert("❌ อัปโหลดล้มเหลว");
    } finally {
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDelete = async () => {
      if(!confirm("⚠️ ยืนยันการลบออเดอร์นี้ถาวร?")) return;
      try {
          // ใช้ API_BASE_URL ที่ถูกต้อง
          await fetch(`${API_BASE_URL}/orders/${id}`, { 
             method: 'DELETE', 
             headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` } 
          });
          nav("/orders");
      } catch { alert("ลบไม่สำเร็จ"); }
  };

  const onPrintAddress = () => {
      if (!order) return;

      const w = window.open('', '_blank');
      if(w) {
          w.document.write(`
            <html>
                <head><title>Print Label</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center; border: 2px solid #000; max-width: 500px; margin: 20px auto;">
                    <h2 style="margin-bottom: 20px;">ผู้รับ (To)</h2>
                    <h1 style="font-size: 24px; margin-bottom: 10px;">${order.customerName}</h1>
                    <p style="font-size: 18px; line-height: 1.6;">${order.customerAddress}</p>
                    <h3 style="margin-top: 20px;">Tel: ${order.customerPhone}</h3>
                    <hr style="margin: 30px 0;" />
                    <p style="font-size: 14px; color: #666;">Order: ${order.orderNo}</p>
                    <script>window.print();</script>
                </body>
            </html>
          `);
          w.document.close();
      }
  };

  if (loading || !order) return <Box p={4}><Skeleton variant="rectangular" height={200} /></Box>;

  const activeStep = STEPS.indexOf(order.orderStatus);
  const canUploadSlip = order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'COMPLETED';

  return (
    <Box p={{ xs: 2, md: 4 }} maxWidth={1200} mx="auto">
      <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={onFileChange} />

      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Button startIcon={<ArrowBackIcon />} component={Link} to="/orders" sx={{ fontWeight: 700, color: 'text.secondary' }}>ย้อนกลับ</Button>
        <Button startIcon={<DeleteForeverIcon />} onClick={onDelete} color="error">ลบออเดอร์</Button>
      </Stack>

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
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <Box p={0.5} borderRadius={1} bgcolor="primary.main" color="white"><LocalShippingIcon fontSize="small"/></Box>
                <Typography variant="h6" fontWeight={700}>รายการสินค้า</Typography>
            </Stack>
            <Box sx={{ bgcolor: '#FAFAFA', borderRadius: 2, p: 2 }}>
                {(order.items || []).map((it: any, i: number) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" mb={1.5} pb={1.5} borderBottom={i < (order.items?.length || 0)-1 ? "1px dashed #ddd" : "none"}>
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
                  <Button variant="contained" fullWidth onClick={onSave} disabled={saving}>บันทึกเลขพัสดุ</Button>
               </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: order.paymentStatus==='PAYMENT_CONFIRMED'?'success.light':'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                 <Typography variant="h6" fontWeight={700}>หลักฐานการโอน</Typography>
                 <Chip 
                    label={order.paymentStatus} 
                    color={order.paymentStatus==="PAYMENT_CONFIRMED"?"success":order.paymentStatus==="REJECTED"?"error":"warning"} 
                    size="small"
                 />
            </Stack>

            <Box 
                sx={{ 
                    position: 'relative', 
                    borderRadius: 2, 
                    overflow: 'hidden',
                    border: '1px solid #eee',
                    minHeight: 250,
                    bgcolor: '#f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2
                }}
            >
                {order.paymentSlipFilename && slipUrl && !slipError ? (
                    <Box 
                        sx={{ 
                            position: 'relative', width: '100%', height: '100%', cursor: 'pointer', 
                            '&:hover .overlay': { opacity: 1 } 
                        }} 
                        onClick={()=>setSlipZoom(true)}
                    >
                        <img 
                            src={slipUrl} 
                            alt="slip" 
                            style={{ width: "100%", display: 'block', minHeight: 250, objectFit: 'contain', background: '#fff' }} 
                            onError={()=>setSlipError(true)} 
                        />
                        <Box className="overlay" sx={{ 
                            position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.2s' 
                        }}>
                            <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                        </Box>
                    </Box>
                ) : (
                    <Box textAlign="center" p={3} sx={{ opacity: 0.6 }}>
                        {order.paymentSlipFilename && slipError ? (
                            <>
                                <BrokenImageIcon sx={{ fontSize: 60, mb: 1, color: 'error.main' }} />
                                <Typography fontWeight="bold" color="error">โหลดรูปไม่สำเร็จ</Typography>
                                <Typography variant="caption">ลิงก์อาจหมดอายุหรือไฟล์เสียหาย</Typography>
                            </>
                        ) : (
                            <>
                                <AccessTimeIcon sx={{ fontSize: 60, mb: 1 }} />
                                <Typography fontWeight="bold">ยังไม่ได้อัปโหลดสลิป</Typography>
                            </>
                        )}
                    </Box>
                )}
            </Box>

            <Stack spacing={1.5}>
                {order.paymentSlipFilename && !slipError && (
                    <Button fullWidth variant="outlined" startIcon={<VerifiedIcon />} onClick={onVerifySlip} color={order.slipOkResult?.success ? "success" : "primary"}>
                      {order.slipOkResult?.success ? "ตรวจสอบแล้ว (ผ่าน)" : "ตรวจสอบสลิป (SlipOK)"}
                    </Button>
                )}

                {canUploadSlip && (
                    <Button 
                        fullWidth 
                        variant="contained" 
                        color="warning" 
                        startIcon={<CloudUploadIcon />}
                        onClick={onUploadClick}
                    >
                        {order.paymentSlipFilename ? "เปลี่ยนรูปสลิป" : "อัปโหลดสลิปให้ลูกค้า"}
                    </Button>
                )}
            </Stack>
          </Paper>

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

      <Dialog open={slipZoom} onClose={()=>setSlipZoom(false)} maxWidth="sm">
          <DialogContent sx={{ p: 0 }}>
              {slipUrl && (
                  <img src={slipUrl} alt="slip full" style={{ width: "100%" }} />
              )}
          </DialogContent>
      </Dialog>
    </Box>
  );
}