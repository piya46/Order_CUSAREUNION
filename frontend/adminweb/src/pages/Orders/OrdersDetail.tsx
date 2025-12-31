// frontend/adminweb/src/pages/Orders/OrdersDetail.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Stack, Chip, Divider, Button, TextField, MenuItem,
  Alert, Grid, Skeleton, Stepper, Step, StepLabel, Card, CardContent,
  Dialog, DialogContent, useTheme, alpha, IconButton, DialogTitle, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow, Autocomplete, InputAdornment,
  Avatar
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
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import PaymentIcon from "@mui/icons-material/Payment";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag"; // New Icon

// Import API
import { getOrder, updateOrder, verifySlip, getSlipSignedUrl, retrySlip, Order } from "../../api/admin";
// Assuming getProducts exists based on your previous request context, though not explicitly in the uploaded files for this turn.
// If it's not there, you'd need to implement it or use a direct fetch. I will use direct fetch for safety as per your previous pattern.
import { showSuccess, showError, showConfirm, showLoading, swal } from "../../lib/sweetalert";

const TARGET_API_ORIGIN = "https://api.cusa.sellers.pstpyst.com";
const API_BASE_URL = `${TARGET_API_ORIGIN}/api`;

const STEPS = ["RECEIVED", "PREPARING_ORDER", "SHIPPING", "COMPLETED"];
const STEP_LABELS: Record<string, string> = { 
    RECEIVED: "รับออเดอร์", 
    PREPARING_ORDER: "กำลังเตรียม", 
    SHIPPING: "จัดส่งแล้ว", 
    COMPLETED: "สำเร็จ" 
};

const PAYMENT_STATUSES = [
    { value: "WAITING", label: "รอโอนเงิน", color: "warning" },
    { value: "PENDING_PAYMENT", label: "รอตรวจสอบสลิป", color: "info" },
    { value: "PAYMENT_CONFIRMED", label: "ชำระเงินแล้ว", color: "success" },
    { value: "REJECTED", label: "สลิปไม่ผ่าน", color: "error" },
    { value: "EXPIRED", label: "หมดอายุ", color: "default" }
];

export default function OrdersDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit States
  const [editStatus, setEditStatus] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [tracking, setTracking] = useState("");
  
  // Item Edit Dialog
  const [openItemEdit, setOpenItemEdit] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]); 

  // Slip States
  const [slipZoom, setSlipZoom] = useState(false);
  const [slipUrl, setSlipUrl] = useState<string>("");
  const [slipError, setSlipError] = useState(false);

  useEffect(() => {
    fetchOrderData();
    fetchAllProducts();
  }, [id]);

 const fetchOrderData = () => {
    setLoading(true);
    getOrder(id!)
      .then(d => { 
        setOrder(d); 
        setEditStatus(d.orderStatus);
        setEditPayment(d.paymentStatus);
        setTracking(d.trackingNumber || "");
        
        if (d.slipUrl) {
            const urlObj = new URL(d.slipUrl, window.location.origin);
            const pathAndQuery = urlObj.pathname + urlObj.search;
            const finalUrl = `${TARGET_API_ORIGIN}${pathAndQuery}`;
            setSlipUrl(finalUrl);
            setSlipError(false);
        } else if (d.paymentSlipFilename) {
            fetchSlipUrl(d._id);
        } else {
            setSlipUrl(""); 
        }
      })
      .catch((err) => {
        console.error(err);
        showError("โหลดข้อมูลไม่สำเร็จ");
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
        const urlObj = new URL(rawUrl, window.location.origin);
        const pathAndQuery = urlObj.pathname + urlObj.search;
        const finalUrl = `${TARGET_API_ORIGIN}${pathAndQuery}`;
        setSlipUrl(finalUrl);
      }
    } catch (error) {
      console.error("Error fetching slip URL:", error);
      setSlipError(true);
    }
  };

  const fetchAllProducts = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/products`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` }
          });
          const data = await res.json();
          if (Array.isArray(data)) setAllProducts(data);
      } catch (e) { console.error("Load products failed", e); }
  };

  // --- Update Functions ---

  const onSaveStatus = async () => {
    const confirm = await showConfirm("บันทึกการเปลี่ยนแปลง?", "คุณต้องการอัปเดตสถานะออเดอร์และเลขพัสดุใช่หรือไม่?");
    if(!confirm) return;

    showLoading("กำลังบันทึก...");
    try {
      const res = await updateOrder(id!, { 
          orderStatus: editStatus, 
          trackingNumber: tracking,
          paymentStatus: editPayment 
      });
      setOrder(res); 
      swal.close();
      showSuccess("บันทึกสำเร็จ");
    } catch(e) { 
        swal.close();
        showError("บันทึกไม่สำเร็จ"); 
    }
  };

  const onVerifySlip = async () => {
    showLoading("กำลังตรวจสอบกับ SlipOK...");
    try {
      const res = await verifySlip(id!);
      setOrder(res.order);
      setEditPayment(res.order.paymentStatus); 
      swal.close();
      if(res.slipOkResult?.success) showSuccess("สลิปถูกต้อง ✅");
      else showError("สลิปไม่ผ่าน ❌", "ตรวจสอบไม่พบยอดเงินหรือข้อมูลไม่ตรง");
    } catch { 
        swal.close();
        showError("เกิดข้อผิดพลาดในการตรวจสอบ"); 
    }
  };

  const onUploadClick = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const confirm = await showConfirm("ยืนยันการอัปโหลด?", "สลิปเดิมจะถูกแทนที่ด้วยรูปใหม่นี้");
    if (!confirm) { e.target.value = ""; return; }

    showLoading("กำลังอัปโหลด...");
    try {
        const res = await retrySlip(id!, file);
        setOrder(res.order);
        swal.close();
        showSuccess("อัปโหลดเรียบร้อย");
        
        if (res.order.paymentSlipFilename) {
            setSlipError(false);
            setSlipUrl(""); 
            fetchSlipUrl(res.order._id);
        }
    } catch (err) {
        swal.close();
        showError("อัปโหลดล้มเหลว");
    } finally {
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDelete = async () => {
      const confirm = await showConfirm("ยืนยันการลบ?", "ข้อมูลจะหายไปถาวรและกู้คืนไม่ได้", "ลบข้อมูล");
      if(!confirm) return;

      showLoading("กำลังลบ...");
      try {
          await fetch(`${API_BASE_URL}/orders/${id}`, { 
             method: 'DELETE', 
             headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` } 
          });
          swal.close();
          nav("/orders");
      } catch { 
          swal.close();
          showError("ลบไม่สำเร็จ"); 
      }
  };

  // --- Edit Items Logic ---
  const openEditItems = () => {
      if(!order) return;
      // Pre-process items to attach variants from allProducts if possible
      const mappedItems = (order.items || []).map(item => {
          const product = allProducts.find(p => p._id === item.product || p.name === item.productName);
          return {
              ...item,
              _variants: product?.variants || []
          };
      });
      setEditItems(JSON.parse(JSON.stringify(mappedItems)));
      setOpenItemEdit(true);
  };

  const handleProductChange = (index: number, newProduct: any) => {
      const newItems = [...editItems];
      if (newProduct) {
          const firstVariant = newProduct.variants?.[0] || {};
          newItems[index] = {
              ...newItems[index],
              product: newProduct._id,
              productName: newProduct.name,
              size: firstVariant.size || '',
              color: firstVariant.color || '',
              price: firstVariant.price || newProduct.price || 0,
              _variants: newProduct.variants || [] 
          };
      } else {
          // Reset if cleared
          newItems[index] = { 
              ...newItems[index], 
              productName: '', 
              size: '', 
              color: '', 
              price: 0,
              _variants: []
          };
      }
      setEditItems(newItems);
  };

  const handleVariantChange = (index: number, field: 'size'|'color', val: string) => {
      const newItems = [...editItems];
      const currentItem = newItems[index];
      
      let variants = currentItem._variants;
      // Fallback: try to find product again if _variants is empty
      if ((!variants || variants.length === 0) && currentItem.productName) {
          const p = allProducts.find(p => p.name === currentItem.productName);
          if(p) variants = p.variants;
      }

      currentItem[field] = val;

      if (variants) {
          // Find matching variant to update price
          // Only update price if both size and color match (or if one is missing/not applicable)
          const matched = variants.find((v:any) => {
              const sizeMatch = !v.size || v.size === (field === 'size' ? val : currentItem.size);
              const colorMatch = !v.color || v.color === (field === 'color' ? val : currentItem.color);
              return sizeMatch && colorMatch;
          });
          
          if (matched) currentItem.price = matched.price;
      }
      
      setEditItems(newItems);
  };

  const handleItemChange = (index: number, field: string, val: any) => {
      const newItems = [...editItems];
      newItems[index] = { ...newItems[index], [field]: val };
      setEditItems(newItems);
  };

  const deleteItem = (index: number) => {
      const newItems = [...editItems];
      newItems.splice(index, 1);
      setEditItems(newItems);
  };

  const saveItems = async () => {
      if(!editItems.length) return showError("ต้องมีสินค้าอย่างน้อย 1 ชิ้น");
      
      // Clean up temp field (_variants)
      const itemsToSend = editItems.map(({ _variants, ...rest }) => rest);
      
      const newTotal = itemsToSend.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);

      const confirm = await showConfirm("บันทึกรายการสินค้า?", `ยอดรวมใหม่จะเป็น ${newTotal.toLocaleString()} บาท`);
      if(!confirm) return;

      showLoading("กำลังอัปเดตสินค้า...");
      try {
          const res = await updateOrder(id!, { items: itemsToSend, totalAmount: newTotal });
          setOrder(res);
          setOpenItemEdit(false);
          swal.close();
          showSuccess("แก้ไขสินค้าเรียบร้อย");
      } catch {
          swal.close();
          showError("แก้ไขไม่สำเร็จ");
      }
  };

  // --- Print ---
  const onPrintAddress = () => {
      if (!order) return;
      const w = window.open('', '_blank');
      if(w) {
          w.document.write(`
            <html><head><title>Label</title></head>
            <body style="font-family:sans-serif; padding:40px; text-align:center; border:2px solid #000; width:400px; margin:20px auto;">
                <h2>ผู้รับ (To)</h2>
                <h1 style="margin:10px 0;">${order.customerName}</h1>
                <p style="font-size:18px;">${order.customerAddress || "-"}</p>
                <h3>Tel: ${order.customerPhone}</h3>
                <hr style="margin:20px 0"/>
                <p>Order: ${order.orderNo}</p>
                <script>window.onload=function(){window.print();}</script>
            </body></html>
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

      {/* Header & Actions */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Stack direction="row" spacing={2}>
            <Button startIcon={<ArrowBackIcon />} component={Link} to="/orders" sx={{ fontWeight: 700, color: 'text.secondary' }}>ย้อนกลับ</Button>
            <Button startIcon={<RefreshIcon />} onClick={()=>fetchOrderData()} variant="outlined">รีโหลดข้อมูล</Button>
        </Stack>
        <Button startIcon={<DeleteForeverIcon />} onClick={onDelete} color="error" variant="text">ลบออเดอร์นี้</Button>
      </Stack>

      {/* Status Card */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, boxShadow: theme.shadows[2], position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', bgcolor: order.paymentStatus === 'PAYMENT_CONFIRMED' ? 'success.main' : 'warning.main' }} />
          
          <Stack direction={{ xs:'column', md:'row' }} justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
                    <Typography variant="h4" fontWeight={900} color="primary">{order.orderNo}</Typography>
                    <Chip 
                        label={order.paymentStatus === 'PAYMENT_CONFIRMED' ? "ชำระเงินแล้ว" : "รอชำระเงิน/ตรวจสอบ"} 
                        color={order.paymentStatus === 'PAYMENT_CONFIRMED' ? "success" : "warning"} 
                        sx={{ fontWeight: 700 }}
                    />
                </Stack>
                <Typography color="text.secondary" variant="body2">สั่งเมื่อ: {new Date(order.createdAt).toLocaleString("th-TH")}</Typography>
            </Box>
            <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={onPrintAddress} sx={{ borderRadius: 2 }}>พิมพ์ใบปะหน้า</Button>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Box px={{ xs:0, md:4 }}>
              <Stepper activeStep={activeStep >= 0 ? activeStep : 0} alternativeLabel>
                  {STEPS.map((label) => (
                    <Step key={label}>
                        <StepLabel StepIconProps={{ sx: { '&.Mui-active, &.Mui-completed': { color: 'success.main' } } }}>
                            {STEP_LABELS[label] || label}
                        </StepLabel>
                    </Step>
                  ))}
              </Stepper>
          </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Left Column: Items & Customer Info */}
        <Grid item xs={12} md={8}>
          
          {/* Items Section */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box p={0.5} borderRadius={1} bgcolor="primary.main" color="white"><LocalShippingIcon fontSize="small"/></Box>
                    <Typography variant="h6" fontWeight={700}>รายการสินค้า</Typography>
                </Stack>
                <Button size="small" startIcon={<EditIcon />} onClick={openEditItems}>แก้ไขสินค้า</Button>
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

          {/* Customer Info */}
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>ข้อมูลจัดส่ง ({order.shippingType})</Typography>
            <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                <CardContent>
                    <Typography variant="subtitle1" fontWeight={700}>{order.customerName}</Typography>
                    <Typography variant="body2" color="text.secondary" mb={1}>{order.customerPhone}</Typography>
                    <Typography variant="body1">{order.customerAddress || "-(รับสินค้าเอง)-"}</Typography>
                </CardContent>
            </Card>
            
            <Typography variant="h6" fontWeight={700} gutterBottom>อัปเดตสถานะจัดส่ง</Typography>
            <Grid container spacing={2} alignItems="flex-end">
               <Grid item xs={12} sm={8}>
                  <TextField 
                    size="small" label="Tracking Number (เลขพัสดุ)" value={tracking} 
                    onChange={e=>setTracking(e.target.value)} fullWidth 
                    placeholder="เช่น TH12345678"
                  />
               </Grid>
               <Grid item xs={12} sm={4}>
                  <TextField 
                    select fullWidth size="small" label="สถานะออเดอร์" value={editStatus} 
                    onChange={e=>setEditStatus(e.target.value)}
                  >
                    {Object.keys(STEP_LABELS).concat(["CANCELLED"]).map(s=>(
                        <MenuItem key={s} value={s}>{STEP_LABELS[s] || s}</MenuItem>
                    ))}
                  </TextField>
               </Grid>
               <Grid item xs={12}>
                  <Button variant="contained" fullWidth onClick={onSaveStatus} startIcon={<SaveIcon />} sx={{ borderRadius: 2 }}>บันทึกสถานะจัดส่ง</Button>
               </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Right Column: Payment & Slip */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: order.paymentStatus==='PAYMENT_CONFIRMED'?'success.light':'divider' }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                 <PaymentIcon color="action" />
                 <Typography variant="h6" fontWeight={700}>การชำระเงิน</Typography>
            </Stack>

            {/* Change Payment Status Manually */}
            <Box mb={3}>
                <Typography variant="caption" color="text.secondary" gutterBottom>สถานะการเงิน (แก้ไขได้)</Typography>
                <TextField 
                    select fullWidth size="small" value={editPayment} 
                    onChange={e=>setEditPayment(e.target.value)}
                    sx={{ mb: 1 }}
                >
                    {PAYMENT_STATUSES.map(p => (
                        <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                </TextField>
                <Button size="small" variant="outlined" onClick={onSaveStatus} fullWidth>อัปเดตสถานะการเงิน</Button>
            </Box>

            <Divider sx={{ mb: 3 }}>หลักฐานโอนเงิน</Divider>

            <Box 
                sx={{ 
                    position: 'relative', borderRadius: 2, overflow: 'hidden',
                    border: '1px solid #eee', minHeight: 250, bgcolor: '#f5f5f5',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mb: 2
                }}
            >
                {order.paymentSlipFilename && slipUrl && !slipError ? (
                    <Box sx={{ position: 'relative', width: '100%', height: '100%', cursor: 'pointer', '&:hover .overlay': { opacity: 1 } }} onClick={()=>setSlipZoom(true)}>
                        <img src={slipUrl} alt="slip" style={{ width: "100%", display: 'block', minHeight: 250, objectFit: 'contain', background: '#fff' }} onError={()=>setSlipError(true)} />
                        <Box className="overlay" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                            <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                        </Box>
                    </Box>
                ) : (
                    <Box textAlign="center" p={3} sx={{ opacity: 0.6 }}>
                        {order.paymentSlipFilename && slipError ? (
                            <>
                                <BrokenImageIcon sx={{ fontSize: 60, mb: 1, color: 'error.main' }} />
                                <Typography fontWeight="bold" color="error">รูปเสีย / ลิงก์หมดอายุ</Typography>
                            </>
                        ) : (
                            <>
                                <AccessTimeIcon sx={{ fontSize: 60, mb: 1 }} />
                                <Typography fontWeight="bold">ยังไม่มีสลิป</Typography>
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
                    <Button fullWidth variant="contained" color="warning" startIcon={<CloudUploadIcon />} onClick={onUploadClick}>
                        {order.paymentSlipFilename ? "เปลี่ยนรูปสลิป" : "อัปโหลดสลิปแทนลูกค้า"}
                    </Button>
                )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* --- Dialogs --- */}
      
      {/* 1. Slip Zoom Dialog */}
      <Dialog open={slipZoom} onClose={()=>setSlipZoom(false)} maxWidth="sm">
          <DialogContent sx={{ p: 0 }}>{slipUrl && <img src={slipUrl} alt="slip full" style={{ width: "100%" }} />}</DialogContent>
      </Dialog>

      {/* 2. Edit Items Dialog (Redesigned) */}
      <Dialog open={openItemEdit} onClose={()=>setOpenItemEdit(false)} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ fontWeight: 800, bgcolor: '#fafafa', borderBottom: '1px solid #eee' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                  <ShoppingBagIcon color="primary" />
                  <Typography variant="h6" fontWeight={800}>แก้ไขรายการสินค้า</Typography>
              </Stack>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
              <Table size="medium">
                  <TableHead>
                      <TableRow>
                          <TableCell width="35%" sx={{ fontWeight: 700, color: 'text.secondary' }}>สินค้า</TableCell>
                          <TableCell width="20%" sx={{ fontWeight: 700, color: 'text.secondary' }}>ตัวเลือก (Size/Color)</TableCell>
                          <TableCell width="15%" align="center" sx={{ fontWeight: 700, color: 'text.secondary' }}>จำนวน</TableCell>
                          <TableCell width="20%" align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>ราคา/ชิ้น</TableCell>
                          <TableCell width="10%"></TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {editItems.map((it, idx) => {
                          const selectedProduct = allProducts.find(p => p._id === it.product || p.name === it.productName);
                          const variants = selectedProduct?.variants || it._variants || [];
                          
                          // Distinct sizes
                          const availableSizes = [...new Set(variants.map((v:any) => v.size))].filter(Boolean);
                          // Filter colors based on selected size (if any)
                          const availableColors = variants
                              .filter((v:any) => !it.size || v.size === it.size)
                              .map((v:any) => v.color)
                              .filter(Boolean);

                          // Check if variant selection is needed
                          const hasSizes = availableSizes.length > 0;
                          const hasColors = availableColors.length > 0;

                          return (
                          <TableRow key={idx} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                              <TableCell>
                                  <Autocomplete
                                      size="small"
                                      options={allProducts}
                                      getOptionLabel={(option) => option.name || ""}
                                      value={allProducts.find(p => p.name === it.productName) || null}
                                      onChange={(_, val) => handleProductChange(idx, val)}
                                      renderInput={(params) => (
                                          <TextField 
                                            {...params} 
                                            variant="outlined" 
                                            placeholder="ค้นหาหรือเลือกสินค้า..."
                                            fullWidth
                                          />
                                      )}
                                      renderOption={(props, option) => (
                                          <li {...props}>
                                              <Stack direction="row" spacing={1} alignItems="center">
                                                  <Avatar src={option.images?.[0]} variant="rounded" sx={{ width: 24, height: 24 }} />
                                                  <Typography variant="body2">{option.name}</Typography>
                                              </Stack>
                                          </li>
                                      )}
                                      freeSolo
                                      onInputChange={(_, val) => {
                                          // Handle manual input or clear
                                          if(!val) {
                                               // Optionally handle clear
                                          } else if (!allProducts.some(p => p.name === val)) {
                                              handleItemChange(idx, 'productName', val);
                                          }
                                      }}
                                  />
                              </TableCell>
                              <TableCell>
                                  <Stack spacing={1}>
                                      {hasSizes ? (
                                          <TextField 
                                            select fullWidth size="small" label="Size"
                                            value={it.size || ''} 
                                            onChange={e=>handleVariantChange(idx, 'size', e.target.value)}
                                          >
                                              {availableSizes.map((s:any) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                          </TextField>
                                      ) : (
                                          <TextField 
                                            fullWidth size="small" label="Size" placeholder="-" 
                                            value={it.size} onChange={e=>handleItemChange(idx, 'size', e.target.value)} 
                                            disabled={!it.productName} // Disable if no product name
                                          />
                                      )}

                                      {hasColors ? (
                                          <TextField 
                                            select fullWidth size="small" label="Color"
                                            value={it.color || ''} 
                                            onChange={e=>handleVariantChange(idx, 'color', e.target.value)}
                                          >
                                              {availableColors.map((c:any) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                          </TextField>
                                      ) : (
                                          <TextField 
                                            fullWidth size="small" label="Color" placeholder="-"
                                            value={it.color} onChange={e=>handleItemChange(idx, 'color', e.target.value)} 
                                            disabled={!it.productName}
                                          />
                                      )}
                                  </Stack>
                              </TableCell>
                              <TableCell align="center">
                                  <TextField 
                                    size="small" type="number"
                                    value={it.quantity} 
                                    onChange={e=>handleItemChange(idx, 'quantity', Number(e.target.value))}
                                    inputProps={{ min: 1, style: { textAlign: 'center' } }}
                                    sx={{ width: 80 }}
                                  />
                              </TableCell>
                              <TableCell align="right">
                                  <TextField 
                                    size="small" type="number"
                                    value={it.price} 
                                    onChange={e=>handleItemChange(idx, 'price', Number(e.target.value))}
                                    InputProps={{ 
                                        endAdornment: <InputAdornment position="end">฿</InputAdornment>
                                    }}
                                    inputProps={{ style: { textAlign: 'right' } }}
                                    sx={{ width: 120 }}
                                  />
                              </TableCell>
                              <TableCell align="center">
                                  <IconButton color="error" onClick={()=>deleteItem(idx)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}>
                                      <DeleteIcon />
                                  </IconButton>
                              </TableCell>
                          </TableRow>
                      )})}
                      
                      {editItems.length === 0 && (
                          <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                  <Typography variant="body2">ยังไม่มีรายการสินค้า</Typography>
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
              
              <Button 
                startIcon={<AddIcon />} 
                variant="dashed" // If your theme supports it, otherwise use outlined with dashed border style
                sx={{ mt: 2, borderStyle: 'dashed', borderWidth: 2, '&:hover': { borderStyle: 'dashed', borderWidth: 2 } }}
                fullWidth 
                onClick={() => setEditItems([...editItems, { productName: '', price: 0, quantity: 1 }])}
              >
                  เพิ่มรายการสินค้าใหม่
              </Button>

              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>ยอดรวมโดยประมาณ:</Typography>
                  <Typography variant="h5" fontWeight={800} color="primary.main">
                      {editItems.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0).toLocaleString()} ฿
                  </Typography>
              </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: '#fafafa', borderTop: '1px solid #eee' }}>
              <Button onClick={()=>setOpenItemEdit(false)} color="inherit" size="large" sx={{ borderRadius: 2 }}>ยกเลิก</Button>
              <Button onClick={saveItems} variant="contained" color="primary" size="large" sx={{ borderRadius: 2, px: 4, boxShadow: theme.shadows[4] }}>บันทึกการแก้ไข</Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}