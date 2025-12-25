// src/pages/Orders/OrdersList.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Chip, TextField, Button, Tooltip, IconButton, 
  InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, 
  TablePagination, Card, CardContent, alpha, useTheme, Fade, Tab, Tabs, Alert
} from "@mui/material";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

// Icons
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ChatIcon from "@mui/icons-material/Chat";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import StorefrontIcon from "@mui/icons-material/Storefront";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }
const fmtBaht = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 }) + " ฿";

// Types
type Order = {
  _id: string; orderNo: string; customerName: string; customerPhone?: string; customerAddress?: string;
  customerLineId?: string; items?: any[]; totalAmount: number;
  paymentStatus: "WAITING" | "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "REJECTED" | "EXPIRED";
  orderStatus: "RECEIVED" | "PREPARING_ORDER" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  shippingType?: "DELIVERY" | "PICKUP_EVENT" | "PICKUP_SMAKHOM"; 
  trackingNumber?: string;
  createdAt: string;
};

// Mapping ภาษาไทย
const PAY_THAI: Record<string, string> = {
  WAITING: "รอโอน", PENDING_PAYMENT: "รอตรวจสลิป", PAYMENT_CONFIRMED: "ชำระแล้ว", REJECTED: "สลิปไม่ผ่าน", EXPIRED: "หมดอายุ"
};
const ORDER_THAI: Record<string, string> = {
  RECEIVED: "รับออเดอร์", PREPARING_ORDER: "กำลังเตรียม", SHIPPING: "ส่งแล้ว", COMPLETED: "สำเร็จ", CANCELLED: "ยกเลิก"
};
const SHIP_THAI: Record<string, string> = {
  DELIVERY: "จัดส่งพัสดุ", PICKUP_EVENT: "รับหน้างาน", PICKUP_SMAKHOM: "รับที่สมาคม"
};

export default function OrdersList() {
  const theme = useTheme();
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [q, setQ] = useState("");
  const [tabValue, setTabValue] = useState("ALL");

  // Actions
  const [msgDlg, setMsgDlg] = useState<{ open: boolean; order?: Order }>({ open: false });
  const [msgText, setMsgText] = useState("");

  const refreshOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { refreshOrders(); }, []);

  // Filter Logic
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchQ = !q || r.orderNo.toLowerCase().includes(q.toLowerCase()) || r.customerName.toLowerCase().includes(q.toLowerCase());
      let matchTab = true;
      if (tabValue === "WAITING_PAY") matchTab = r.paymentStatus === "WAITING";
      else if (tabValue === "PENDING_CHECK") matchTab = r.paymentStatus === "PENDING_PAYMENT";
      else if (tabValue === "TO_SHIP") matchTab = r.paymentStatus === "PAYMENT_CONFIRMED" && r.orderStatus !== "SHIPPING" && r.orderStatus !== "COMPLETED" && r.orderStatus !== "CANCELLED";
      else if (tabValue === "SHIPPING") matchTab = r.orderStatus === "SHIPPING";
      else if (tabValue === "COMPLETED") matchTab = r.orderStatus === "COMPLETED";
      else if (tabValue === "CANCELLED") matchTab = r.orderStatus === "CANCELLED" || r.paymentStatus === "REJECTED";
      return matchQ && matchTab;
    });
  }, [rows, q, tabValue]);

  const paginatedRows = useMemo(() => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [filtered, page, rowsPerPage]);

  const stats = useMemo(() => ({
    total: rows.length,
    pendingCheck: rows.filter(x => x.paymentStatus === "PENDING_PAYMENT").length,
    toShip: rows.filter(x => x.paymentStatus === "PAYMENT_CONFIRMED" && !["SHIPPING","COMPLETED","CANCELLED"].includes(x.orderStatus)).length,
    revenue: rows.filter(x => x.paymentStatus === "PAYMENT_CONFIRMED").reduce((sum, x) => sum + (x.totalAmount || 0), 0)
  }), [rows]);

  // --- 📊 EXPORT EXCEL FUNCTION (FILTERED REAL SALES) ---
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const now = new Date().toLocaleString("th-TH");

    // 1. กรองเฉพาะออเดอร์ที่ "ขายได้จริง" หรือ "รอขาย" (ตัด Cancelled, Rejected, Expired ทิ้ง)
    const validOrders = rows.filter(r => 
        r.orderStatus !== 'CANCELLED' && 
        r.paymentStatus !== 'REJECTED' && 
        r.paymentStatus !== 'EXPIRED'
    );

    // คำนวณยอดขายเฉพาะกลุ่ม Valid
    const validRevenue = validOrders
        .filter(r => r.paymentStatus === "PAYMENT_CONFIRMED")
        .reduce((sum, x) => sum + (x.totalAmount || 0), 0);

    // สร้างหน้า Summary (สรุปภาพรวม)
    const summaryData = [
        ["รายงานสรุปยอดขาย (Real Sales Report)"],
        ["วันที่ออกรายงาน", now],
        ["หมายเหตุ", "รายงานนี้ไม่รวมออเดอร์ที่ ยกเลิก / ไม่ผ่าน / หมดอายุ"],
        [""],
        ["----------------------------------------"],
        ["📊 สรุปการเงิน (Financials)"],
        ["ยอดขายรวมที่ชำระแล้ว (Confirmed Revenue)", validRevenue],
        ["จำนวนออเดอร์ที่มีคุณภาพ (Valid Orders)", validOrders.length],
        [""],
        ["----------------------------------------"],
        ["💳 แยกตามสถานะการจ่ายเงิน (Payment Status)"],
        ["สถานะ", "จำนวนออเดอร์", "ยอดเงินรวม"],
        // เอาเฉพาะสถานะที่ valid (รอโอน, รอตรวจ, ชำระแล้ว)
        ...["WAITING", "PENDING_PAYMENT", "PAYMENT_CONFIRMED"].map(k => {
            const group = validOrders.filter(r => r.paymentStatus === k);
            const sum = group.reduce((a,b) => a + (b.totalAmount||0), 0);
            return [PAY_THAI[k], group.length, sum];
        }),
        [""],
        ["----------------------------------------"],
        ["📦 แยกตามประเภทการจัดส่ง (Shipping Type)"],
        ["ประเภท", "จำนวนออเดอร์"],
        ...Object.keys(SHIP_THAI).map(k => [SHIP_THAI[k], validOrders.filter(r => r.shippingType === k).length]),
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary (สรุป)");

    // Helper Format
    const formatRow = (o: Order) => ({
       "Date": new Date(o.createdAt).toLocaleDateString("th-TH"),
       "Time": new Date(o.createdAt).toLocaleTimeString("th-TH"),
       "Order No": o.orderNo,
       "Customer Name": o.customerName,
       "Phone": o.customerPhone || "-",
       "Shipping Type": SHIP_THAI[o.shippingType || "DELIVERY"] || o.shippingType,
       "Address": o.customerAddress || "-",
       "Tracking No": o.trackingNumber || "-",
       "Items": (o.items||[]).map(i=>`${i.productName} (${i.size||'-'}) x${i.quantity}`).join(", "),
       "Total Amount": o.totalAmount,
       "Payment Status": PAY_THAI[o.paymentStatus] || o.paymentStatus,
       "Order Status": ORDER_THAI[o.orderStatus] || o.orderStatus,
    });

    // 2. หน้า Sales List (รายชื่อออเดอร์ที่ขายได้จริง)
    const allData = validOrders.map(formatRow);
    const wsAll = XLSX.utils.json_to_sheet(allData);
    wsAll['!cols'] = [{wch:10}, {wch:8}, {wch:15}, {wch:20}, {wch:12}, {wch:12}, {wch:40}, {wch:15}, {wch:40}, {wch:10}, {wch:15}, {wch:15}];
    XLSX.utils.book_append_sheet(wb, wsAll, "Sales List (รายการขาย)");

    // 3. Delivery
    const deliveryRows = validOrders.filter(r => !r.shippingType || r.shippingType === 'DELIVERY').map(formatRow);
    if(deliveryRows.length > 0){
        const wsDelivery = XLSX.utils.json_to_sheet(deliveryRows);
        wsDelivery['!cols'] = wsAll['!cols'];
        XLSX.utils.book_append_sheet(wb, wsDelivery, "Delivery (จัดส่ง)");
    }

    // 4. Pickup
    const pickupRows = validOrders.filter(r => r.shippingType && r.shippingType.includes('PICKUP')).map(formatRow);
    if(pickupRows.length > 0){
        const wsPickup = XLSX.utils.json_to_sheet(pickupRows);
        wsPickup['!cols'] = wsAll['!cols'];
        XLSX.utils.book_append_sheet(wb, wsPickup, "Pickup (รับเอง)");
    }

    // Save File
    XLSX.writeFile(wb, `RealSales_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("⚠️ ยืนยันการลบออเดอร์นี้? \nข้อมูลจะหายไปจากระบบทันที")) return;
    try {
        const res = await fetch(`${API}/orders/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        if(res.ok) refreshOrders();
        else alert("ลบไม่สำเร็จ");
    } catch { alert("เกิดข้อผิดพลาด"); }
  };

  const sendMessage = async () => {
    if(!msgDlg.order) return;
    try {
        await fetch(`${API}/orders/${msgDlg.order._id}/push`, { 
           method:"POST", 
           headers:{"Content-Type":"application/json", Authorization:`Bearer ${getToken()}`}, 
           body:JSON.stringify({text:msgText})
        });
        alert("✅ ส่งข้อความเรียบร้อย"); 
        setMsgDlg({open:false}); setMsgText("");
    } catch { alert("❌ ส่งข้อความไม่สำเร็จ"); }
  };

  return (
    <Box>
      <Stack direction={{ xs:"column", md:"row" }} justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
            <Box p={1.5} borderRadius={3} bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main">
                <ShoppingBagIcon fontSize="large" />
            </Box>
            <Box>
                <Typography variant="h4" fontWeight={900}>รายการคำสั่งซื้อ</Typography>
                <Typography variant="body2" color="text.secondary">จัดการและติดตามสถานะออเดอร์</Typography>
            </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
           <Button variant="outlined" color="inherit" startIcon={<RefreshIcon/>} onClick={refreshOrders} sx={{ borderRadius: 2 }}>รีโหลด</Button>
           <Button variant="contained" color="success" startIcon={<FileDownloadIcon/>} onClick={exportExcel} sx={{ borderRadius: 2, fontWeight: 700 }}>Export Report</Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
         <Card sx={{ flex: 1, borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
               <ShoppingBagIcon sx={{ fontSize: 32, color: 'text.secondary', mr: 2 }} />
               <Box>
                  <Typography variant="h5" fontWeight={800}>{stats.total}</Typography>
                  <Typography variant="caption" color="text.secondary">ออเดอร์ทั้งหมด (รวมยกเลิก)</Typography>
               </Box>
            </CardContent>
         </Card>
         <Card sx={{ flex: 1, borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'warning.main', bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
               <WarningAmberIcon sx={{ fontSize: 32, color: 'warning.main', mr: 2 }} />
               <Box>
                  <Typography variant="h5" fontWeight={800} color="warning.dark">{stats.pendingCheck}</Typography>
                  <Typography variant="caption" color="warning.dark">รอตรวจสลิป</Typography>
               </Box>
            </CardContent>
         </Card>
         <Card sx={{ flex: 1, borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'info.main', bgcolor: alpha(theme.palette.info.main, 0.05) }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
               <LocalShippingIcon sx={{ fontSize: 32, color: 'info.main', mr: 2 }} />
               <Box>
                  <Typography variant="h5" fontWeight={800} color="info.dark">{stats.toShip}</Typography>
                  <Typography variant="caption" color="info.dark">รอจัดส่ง</Typography>
               </Box>
            </CardContent>
         </Card>
      </Stack>

      {/* Tabs & Search */}
      <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Tabs 
                value={tabValue} onChange={(_, v) => { setPage(0); setTabValue(v); }} 
                variant="scrollable" scrollButtons="auto"
                sx={{ '& .MuiTab-root': { fontWeight: 700, minHeight: 60 } }}
            >
                <Tab label="ทั้งหมด" value="ALL" />
                <Tab label={`รอตรวจสลิป (${stats.pendingCheck})`} value="PENDING_CHECK" icon={<WarningAmberIcon fontSize="small"/>} iconPosition="start" />
                <Tab label="รอโอน" value="WAITING_PAY" />
                <Tab label={`ต้องจัดส่ง (${stats.toShip})`} value="TO_SHIP" icon={<LocalShippingIcon fontSize="small"/>} iconPosition="start" />
                <Tab label="กำลังส่ง" value="SHIPPING" />
                <Tab label="สำเร็จแล้ว" value="COMPLETED" />
                <Tab label="ยกเลิก/มีปัญหา" value="CANCELLED" />
            </Tabs>
        </Box>
        <Box p={2}>
            <TextField 
                fullWidth size="small" placeholder="ค้นหา Order No, ชื่อลูกค้า..." 
                value={q} onChange={e=>{setPage(0); setQ(e.target.value);}}
                InputProps={{ 
                    startAdornment: <InputAdornment position="start"><SearchIcon color="action"/></InputAdornment>,
                    sx: { borderRadius: 2 }
                }} 
            />
        </Box>
      </Paper>

      {/* Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#FAFAFA' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Order No.</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>ลูกค้า</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>ยอดรวม</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>สถานะจ่าย</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>สถานะของ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> กำลังโหลด...</TableCell></TableRow>
            ) : paginatedRows.length === 0 ? (
               <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่พบข้อมูลตามเงื่อนไข</TableCell></TableRow>
            ) : (
               paginatedRows.map((r, i) => (
                 <Fade in timeout={300 + (i*50)} key={r._id}>
                   <TableRow hover sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                     <TableCell>
                       <Stack direction="row" spacing={1} alignItems="center">
                           <Typography variant="body2" fontWeight={700} color="primary" component={Link} to={`/orders/${r._id}`} sx={{ textDecoration: 'none' }}>
                               {r.orderNo}
                           </Typography>
                           {r.shippingType && r.shippingType !== "DELIVERY" && (
                               <Chip icon={<StorefrontIcon sx={{fontSize: '14px !important'}}/>} label="รับเอง" size="small" color="secondary" sx={{ height: 20, fontSize: '0.65rem', borderRadius: 1 }} />
                           )}
                       </Stack>
                       <Typography variant="caption" color="text.secondary">
                         {new Date(r.createdAt).toLocaleDateString("th-TH", {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}
                       </Typography>
                     </TableCell>
                     <TableCell>
                       <Typography variant="body2" fontWeight={600}>{r.customerName}</Typography>
                       <Typography
    variant="caption"
    color="text.secondary"
    noWrap // <--- ย้ายมาตรงนี้
    sx={{ display: 'block', maxWidth: 150, textOverflow: 'ellipsis', overflow: 'hidden' }} // <--- ลบ noWrap: true ในนี้ออก
>
                           {(r.items||[]).length} รายการ
                       </Typography>
                     </TableCell>
                     <TableCell>
                        <Typography fontWeight={700} color="success.main">{fmtBaht(r.totalAmount)}</Typography>
                     </TableCell>
                     <TableCell align="center">
                        <Chip 
                            label={PAY_THAI[r.paymentStatus]} size="small" 
                            color={r.paymentStatus === "PAYMENT_CONFIRMED" ? "success" : r.paymentStatus === "PENDING_PAYMENT" ? "warning" : r.paymentStatus === "REJECTED" ? "error" : "default"}
                            variant={r.paymentStatus === "WAITING" ? "outlined" : "filled"}
                            sx={{ fontWeight: 600, minWidth: 80 }}
                        />
                     </TableCell>
                     <TableCell align="center">
                        <Chip 
                            label={ORDER_THAI[r.orderStatus]} size="small" 
                            color={r.orderStatus === "COMPLETED" ? "success" : r.orderStatus === "SHIPPING" ? "info" : "default"}
                            variant="outlined"
                            sx={{ fontWeight: 600, minWidth: 80 }}
                        />
                     </TableCell>
                     <TableCell align="right">
                       <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                            <Tooltip title="ส่งข้อความ">
                                <IconButton size="small" onClick={()=>setMsgDlg({open:true, order:r})} disabled={!r.customerLineId}>
                                    <ChatIcon fontSize="small" color={r.customerLineId ? "primary" : "disabled"} />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="ดูรายละเอียด">
                                <IconButton size="small" component={Link} to={`/orders/${r._id}`}>
                                    <VisibilityIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="ลบออเดอร์">
                                <IconButton size="small" onClick={()=>deleteOrder(r._id)} color="error">
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                       </Stack>
                     </TableCell>
                   </TableRow>
                 </Fade>
               ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]} component="div"
          count={filtered.length} rowsPerPage={rowsPerPage} page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        />
      </Paper>

      {/* Message Dialog */}
      <Dialog open={msgDlg.open} onClose={()=>setMsgDlg({open:false})} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>💬 ส่งข้อความหาลูกค้า</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>ข้อความจะส่งไปทาง LINE ของลูกค้า</Alert>
          <TextField 
             fullWidth multiline rows={4} placeholder="พิมพ์ข้อความ..." 
             value={msgText} onChange={e=>setMsgText(e.target.value)} 
             variant="outlined" autoFocus
             sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button onClick={()=>setMsgDlg({open:false})} color="inherit">ยกเลิก</Button>
            <Button variant="contained" onClick={sendMessage} disabled={!msgText.trim()} sx={{ borderRadius: 2 }}>ส่งข้อความ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}