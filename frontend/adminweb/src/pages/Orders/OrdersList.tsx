import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Chip, TextField, MenuItem, Button, Tooltip, IconButton, 
  InputAdornment, Dialog, DialogTitle, Checkbox, Grid, TablePagination,
  Card, CardContent, alpha, useTheme, Fade
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ChatIcon from "@mui/icons-material/Chat";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";

import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }
const fmtBaht = (n: number) => (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 }) + " ฿";

type OrderItem = { productName: string; size?: string; color?: string; price: number; quantity: number };
type Order = {
  _id: string; orderNo: string; customerName: string; customerPhone?: string; customerAddress?: string;
  customerLineId?: string; items?: OrderItem[]; totalAmount: number;
  paymentStatus: "WAITING" | "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "REJECTED" | "EXPIRED";
  orderStatus: "RECEIVED" | "PREPARING_ORDER" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  shippingType?: "DELIVERY" | "PICKUP_EVENT" | "PICKUP_SMAKHOM"; 
  createdAt: string;
};

const PAY_THAI: Record<string, string> = {
  WAITING: "รอโอน", PENDING_PAYMENT: "รอตรวจ", PAYMENT_CONFIRMED: "ชำระแล้ว", REJECTED: "ไม่ผ่าน", EXPIRED: "หมดอายุ"
};
const ORDER_THAI: Record<string, string> = {
  RECEIVED: "รับออเดอร์", PREPARING_ORDER: "เตรียมของ", SHIPPING: "ส่งแล้ว", COMPLETED: "สำเร็จ", CANCELLED: "ยกเลิก"
};

// --- Stylized Components ---
const StatusChip = ({ label, type, status }: { label: string, type: 'pay'|'ord', status: string }) => {
   const theme = useTheme();
   let color = theme.palette.grey[500];
   let bg = theme.palette.grey[100];
   
   if (type === 'pay') {
      if (status === 'PAYMENT_CONFIRMED') { color = theme.palette.success.main; bg = alpha(color, 0.1); }
      else if (status === 'PENDING_PAYMENT') { color = theme.palette.warning.main; bg = alpha(color, 0.1); }
      else if (status === 'REJECTED') { color = theme.palette.error.main; bg = alpha(color, 0.1); }
      else if (status === 'WAITING') { color = theme.palette.info.main; bg = alpha(color, 0.1); }
   } else {
      if (status === 'COMPLETED') { color = theme.palette.success.main; bg = alpha(color, 0.1); }
      else if (status === 'SHIPPING') { color = theme.palette.primary.main; bg = alpha(color, 0.1); }
      else if (status === 'CANCELLED') { color = theme.palette.text.disabled; bg = theme.palette.action.hover; }
   }

   return (
      <Chip 
         label={label} 
         size="small" 
         sx={{ 
            color: color, 
            bgcolor: bg, 
            fontWeight: 600, 
            borderRadius: '6px',
            border: '1px solid',
            borderColor: alpha(color, 0.2)
         }} 
      />
   );
};

export default function OrdersList() {
  const theme = useTheme();
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<string>("ALL");
  const [ord, setOrd] = useState<string>("ALL");

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
      const matchPay = pay === "ALL" || r.paymentStatus === pay;
      const matchOrd = ord === "ALL" || r.orderStatus === ord;
      return matchQ && matchPay && matchOrd;
    });
  }, [rows, q, pay, ord]);

  const paginatedRows = useMemo(() => {
     return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const stats = useMemo(() => ({
    total: rows.length,
    paid: rows.filter(x => x.paymentStatus === "PAYMENT_CONFIRMED").length,
    shipping: rows.filter(x => x.orderStatus === "SHIPPING").length
  }), [rows]);

  const exportExcel = () => {
    const data = filtered.map(o => ({
       "Date": new Date(o.createdAt).toLocaleDateString("th-TH"),
       "Order No": o.orderNo,
       "Customer": o.customerName,
       "Phone": o.customerPhone,
       "Items": (o.items||[]).map(i=>`${i.productName} (${i.size||'-'}) x${i.quantity}`).join(", "),
       "Total": o.totalAmount,
       "Payment": PAY_THAI[o.paymentStatus],
       "Status": ORDER_THAI[o.orderStatus],
       "Address": o.customerAddress
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `Orders_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const copyText = (txt: string) => { 
     navigator.clipboard.writeText(txt); 
     // Could add a snackbar here
  };
  
  const sendMessage = async () => {
    if(!msgDlg.order) return;
    await fetch(`${API}/orders/${msgDlg.order._id}/push`, { 
       method:"POST", 
       headers:{"Content-Type":"application/json", Authorization:`Bearer ${getToken()}`}, 
       body:JSON.stringify({text:msgText})
    });
    alert("ส่งข้อความเรียบร้อย"); 
    setMsgDlg({open:false});
    setMsgText("");
  };

  return (
    <Box>
      {/* Header & Stats Cards */}
      <Stack direction={{ xs:"column", sm:"row" }} justifyContent="space-between" alignItems="flex-start" mb={4} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>คำสั่งซื้อ</Typography>
          <Typography variant="body2" color="text.secondary">จัดการออเดอร์และการจัดส่งของคุณได้ที่นี่</Typography>
        </Box>
        <Stack direction="row" spacing={2}>
           <Button variant="outlined" color="inherit" startIcon={<RefreshIcon/>} onClick={refreshOrders}>รีโหลด</Button>
           <Button variant="contained" color="success" startIcon={<FileDownloadIcon/>} onClick={exportExcel}>Export Excel</Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={4}>
         <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
               <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                  <ShoppingBagIcon sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2, opacity: 0.8 }} />
                  <Box>
                     <Typography variant="h4" fontWeight={700}>{stats.total}</Typography>
                     <Typography variant="body2" color="text.secondary">ออเดอร์ทั้งหมด</Typography>
                  </Box>
               </CardContent>
            </Card>
         </Grid>
         <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
               <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: theme.palette.success.main, mr: 2, opacity: 0.8 }} />
                  <Box>
                     <Typography variant="h4" fontWeight={700}>{stats.paid}</Typography>
                     <Typography variant="body2" color="text.secondary">ชำระเงินแล้ว</Typography>
                  </Box>
               </CardContent>
            </Card>
         </Grid>
         <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
               <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                  <LocalShippingIcon sx={{ fontSize: 40, color: theme.palette.info.main, mr: 2, opacity: 0.8 }} />
                  <Box>
                     <Typography variant="h4" fontWeight={700}>{stats.shipping}</Typography>
                     <Typography variant="body2" color="text.secondary">กำลังจัดส่ง</Typography>
                  </Box>
               </CardContent>
            </Card>
         </Grid>
      </Grid>

      {/* Filter Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField fullWidth size="small" placeholder="ค้นหา Order No, ชื่อลูกค้า" value={q} onChange={e=>{setPage(0); setQ(e.target.value);}}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action"/></InputAdornment> }} 
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" select label="สถานะการจ่าย" value={pay} onChange={e=>{setPage(0); setPay(e.target.value);}}>
               <MenuItem value="ALL">ทั้งหมด</MenuItem>
               {Object.keys(PAY_THAI).map(k=><MenuItem key={k} value={k}>{PAY_THAI[k]}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" select label="สถานะออเดอร์" value={ord} onChange={e=>{setPage(0); setOrd(e.target.value);}}>
               <MenuItem value="ALL">ทั้งหมด</MenuItem>
               {Object.keys(ORDER_THAI).map(k=><MenuItem key={k} value={k}>{ORDER_THAI[k]}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Table stickyHeader size="medium">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Order No.</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>ลูกค้า</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>สินค้า</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>ยอดรวม</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>สถานะจ่าย</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>สถานะของ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>กำลังโหลดข้อมูล...</TableCell></TableRow>
            ) : paginatedRows.length === 0 ? (
               <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่พบข้อมูล</TableCell></TableRow>
            ) : (
               paginatedRows.map((r, i) => (
                 <Fade in timeout={300 + (i*50)} key={r._id}>
                   <TableRow hover sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                     <TableCell>
                       <Typography variant="body2" fontWeight={700} color="primary">{r.orderNo}</Typography>
                       <Typography variant="caption" color="text.secondary">
                         {new Date(r.createdAt).toLocaleDateString("th-TH", {day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit'})}
                       </Typography>
                     </TableCell>
                     <TableCell>
                       <Typography variant="body2">{r.customerName}</Typography>
                       <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip label={r.shippingType || "DELIVERY"} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                       </Stack>
                     </TableCell>
                     <TableCell>
                       <Typography variant="body2" sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                         {(r.items||[]).map(i => i.productName).join(", ")}
                       </Typography>
                     </TableCell>
                     <TableCell align="right">
                        <Typography fontWeight={600}>{fmtBaht(r.totalAmount)}</Typography>
                     </TableCell>
                     <TableCell align="center">
                        <StatusChip label={PAY_THAI[r.paymentStatus]} type="pay" status={r.paymentStatus} />
                     </TableCell>
                     <TableCell align="center">
                        <StatusChip label={ORDER_THAI[r.orderStatus]} type="ord" status={r.orderStatus} />
                     </TableCell>
                     <TableCell align="right">
                       <Tooltip title="ดูรายละเอียด">
                          <IconButton size="small" component={Link} to={`/orders/${r._id}`} color="primary"><VisibilityIcon fontSize="small" /></IconButton>
                       </Tooltip>
                       <Tooltip title="ส่งข้อความ">
                          <IconButton size="small" onClick={()=>setMsgDlg({open:true, order:r})}><ChatIcon fontSize="small" /></IconButton>
                       </Tooltip>
                       <Tooltip title="คัดลอกที่อยู่">
                          <IconButton size="small" onClick={()=>copyText(r.customerAddress||"")}><ContentCopyIcon fontSize="small" /></IconButton>
                       </Tooltip>
                     </TableCell>
                   </TableRow>
                 </Fade>
               ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filtered.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        />
      </Paper>

      {/* Message Dialog */}
      <Dialog open={msgDlg.open} onClose={()=>setMsgDlg({open:false})} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>ส่งข้อความหาลูกค้า</DialogTitle>
        <Box px={3} pb={3}>
          <TextField 
             fullWidth multiline rows={4} 
             placeholder="พิมพ์ข้อความที่ต้องการแจ้งเตือน..." 
             value={msgText} onChange={e=>setMsgText(e.target.value)} 
             variant="outlined"
             sx={{ mb: 2 }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={()=>setMsgDlg({open:false})} color="inherit">ยกเลิก</Button>
            <Button variant="contained" onClick={sendMessage} disabled={!msgText.trim()}>ส่งข้อความ</Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
}