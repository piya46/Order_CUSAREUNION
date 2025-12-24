// src/pages/Orders/OrdersList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Chip, TextField, MenuItem, Button, Divider, Tooltip,
  IconButton, Skeleton, Collapse, InputAdornment, Dialog, DialogTitle, Checkbox, Grid
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ChatIcon from "@mui/icons-material/Chat";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import DescriptionIcon from "@mui/icons-material/Description";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Link, useLocation } from "react-router-dom";
import * as XLSX from "xlsx";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }
const fmtBaht = (n: number) => (n || 0).toLocaleString("th-TH") + " ฿";

type OrderItem = { productName: string; size?: string; color?: string; price: number; quantity: number };
type Order = {
  _id: string; orderNo: string; customerName: string; customerPhone?: string; customerAddress?: string;
  customerLineId?: string; items?: OrderItem[]; totalAmount: number;
  paymentStatus: "WAITING" | "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "REJECTED" | "EXPIRED";
  orderStatus: "RECEIVED" | "PREPARING_ORDER" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  shippingType?: "DELIVERY" | "PICKUP_EVENT" | "PICKUP_SMAKHOM"; trackingNumber?: string;
  slipReviewCount?: number; createdAt: string;
};

const payOpts = ["ALL","WAITING","PENDING_PAYMENT","PAYMENT_CONFIRMED","REJECTED","EXPIRED"] as const;
const ordOpts = ["ALL","RECEIVED","PREPARING_ORDER","SHIPPING","COMPLETED","CANCELLED"] as const;
const shipOpts = ["ALL","DELIVERY","PICKUP_SMAKHOM","PICKUP_EVENT"] as const;

const PAY_THAI: Record<string, string> = {
  WAITING: "รอโอน", PENDING_PAYMENT: "รอตรวจ", PAYMENT_CONFIRMED: "ชำระแล้ว", REJECTED: "ไม่ผ่าน", EXPIRED: "หมดอายุ"
};
const ORDER_THAI: Record<string, string> = {
  RECEIVED: "รับออเดอร์", PREPARING_ORDER: "เตรียมของ", SHIPPING: "ส่งแล้ว", COMPLETED: "สำเร็จ", CANCELLED: "ยกเลิก"
};

// Minimal Status Colors
const getPayColor = (s: string) => {
  if (s === "PAYMENT_CONFIRMED") return "success";
  if (s === "REJECTED") return "error";
  if (s === "EXPIRED") return "default";
  return "warning"; // รอโอน/รอตรวจ = สีเหลือง
};
const getOrdColor = (s: string) => {
  if (s === "COMPLETED") return "success";
  if (s === "CANCELLED") return "default";
  if (s === "SHIPPING") return "info";
  return "primary"; // ปกติใช้สีธีม (เหลือง/ดำ)
};

function downloadCSV(filename: string, rows: any[]) {
  if (!rows.length) rows = [{}];
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const csv = ["\uFEFF" + headers.join(","), ...rows.map(r => headers.map(h => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename.replace(/\.xlsx$/i, ".csv"); a.click();
}

export default function OrdersList() {
  const location = useLocation();
  const [rows, setRows] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<string>("ALL");
  const [ord, setOrd] = useState<string>("ALL");
  const [advOpen, setAdvOpen] = useState(false);
  const [ship, setShip] = useState<string>("ALL");

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [msgDlg, setMsgDlg] = useState<{ open: boolean; order?: Order }>({ open: false });
  const [msgText, setMsgText] = useState("");
  const fileInputRef = useRef<HTMLInputElement|null>(null);

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
    return (rows || []).filter(r => {
      const matchQ = !q || r.orderNo.toLowerCase().includes(q.toLowerCase()) || r.customerName.toLowerCase().includes(q.toLowerCase());
      const matchPay = pay === "ALL" || r.paymentStatus === pay;
      const matchOrd = ord === "ALL" || r.orderStatus === ord;
      const matchShip = ship === "ALL" || (r.shippingType || "DELIVERY") === ship;
      return matchQ && matchPay && matchOrd && matchShip;
    }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rows, q, pay, ord, ship]);

  const stats = useMemo(() => ({
    total: filtered.length,
    paid: filtered.filter(x => x.paymentStatus === "PAYMENT_CONFIRMED").length,
    shipping: filtered.filter(x => x.orderStatus === "SHIPPING").length
  }), [filtered]);

  // Export Logic
  const exportAddressesThreeSheets = () => {
    const ok = (o: Order) => o.paymentStatus === "PAYMENT_CONFIRMED" && o.orderStatus !== "CANCELLED";
    const wb = XLSX.utils.book_new();
    
    const mapAddr = (o: Order) => ({ "Order": o.orderNo, "Name": o.customerName, "Phone": o.customerPhone, "Address": o.customerAddress, "Items": (o.items||[]).map(i=>`${i.productName} x${i.quantity}`).join(", ") });
    const mapSimple = (o: Order) => ({ "Order": o.orderNo, "Name": o.customerName, "Phone": o.customerPhone, "Items": (o.items||[]).map(i=>`${i.productName} x${i.quantity}`).join(", ") });

    const deliv = filtered.filter(o => ok(o) && (o.shippingType||"DELIVERY")==="DELIVERY").map(mapAddr);
    const sma = filtered.filter(o => ok(o) && o.shippingType==="PICKUP_SMAKHOM").map(mapSimple);
    const evt = filtered.filter(o => ok(o) && o.shippingType==="PICKUP_EVENT").map(mapSimple);

    if(deliv.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deliv), "Delivery");
    if(sma.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sma), "Samakhom");
    if(evt.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evt), "Event");
    
    XLSX.writeFile(wb, `orders_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const copyText = (txt: string) => { navigator.clipboard.writeText(txt); alert("Copied!"); };
  const sendMessage = async () => {
    if(!msgDlg.order) return;
    await fetch(`${API}/orders/${msgDlg.order._id}/push`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${getToken()}`}, body:JSON.stringify({text:msgText})});
    alert("ส่งข้อความแล้ว"); setMsgDlg({open:false});
  };

  return (
    <Box p={{ xs: 2, md: 4 }}>
      {/* Header & Stats */}
      <Stack direction={{ xs:"column", md:"row" }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Stack>
          <Typography variant="h4" gutterBottom>รายการคำสั่งซื้อ</Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={`ทั้งหมด ${stats.total}`} />
            <Chip label={`ชำระแล้ว ${stats.paid}`} color="success" variant="outlined" />
            <Chip label={`ขนส่ง ${stats.shipping}`} color="info" variant="outlined" />
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={()=>alert('Template Downloaded')}>เทมเพลต</Button>
          <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={()=>fileInputRef.current?.click()}>นำเข้าพัสดุ</Button>
          <Button variant="contained" color="primary" startIcon={<FileDownloadIcon />} onClick={exportAddressesThreeSheets}>ส่งออก (3 ชีต)</Button>
          <input type="file" hidden ref={fileInputRef} onChange={()=>{alert("Import function called")}} />
        </Stack>
      </Stack>

      {/* Filters Card */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField fullWidth size="small" placeholder="ค้นหาออเดอร์, ชื่อลูกค้า..." value={q} onChange={e=>setQ(e.target.value)} 
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action"/></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" select label="สถานะจ่าย" value={pay} onChange={e=>setPay(e.target.value)}>{payOpts.map(x=><MenuItem key={x} value={x}>{x==="ALL"?"ทั้งหมด":PAY_THAI[x]}</MenuItem>)}</TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" select label="สถานะของ" value={ord} onChange={e=>setOrd(e.target.value)}>{ordOpts.map(x=><MenuItem key={x} value={x}>{x==="ALL"?"ทั้งหมด":ORDER_THAI[x]}</MenuItem>)}</TextField>
          </Grid>
          <Grid item xs={12} md={4} display="flex" justifyContent="flex-end">
            <Button onClick={()=>setAdvOpen(!advOpen)} startIcon={<FilterListIcon />} color="inherit">ตัวกรองเพิ่มเติม</Button>
          </Grid>
        </Grid>
        <Collapse in={advOpen}>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={2}>
            <TextField size="small" select label="การจัดส่ง" value={ship} onChange={e=>setShip(e.target.value)} sx={{ width: 200 }}>{shipOpts.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
            {/* Add Date Range here if needed */}
          </Stack>
        </Collapse>
      </Paper>

      {/* Table */}
      <Paper sx={{ overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
              <TableCell>Order No.</TableCell>
              <TableCell>ลูกค้า</TableCell>
              <TableCell>สินค้า</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
              <TableCell align="center">ชำระเงิน</TableCell>
              <TableCell align="center">สถานะ</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={8} align="center">Loading...</TableCell></TableRow> : filtered.map(r => (
              <TableRow key={r._id} hover>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={selectedIds.includes(r._id)} onChange={()=>{
                    setSelectedIds(prev => prev.includes(r._id) ? prev.filter(i=>i!==r._id) : [...prev, r._id])
                  }}/>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" fontWeight={700}>{r.orderNo}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(r.createdAt).toLocaleDateString("th-TH")}</Typography>
                </TableCell>
                <TableCell>
                  <Stack>
                    <Typography variant="body2">{r.customerName}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.shippingType || "DELIVERY"}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {(r.items||[]).map(i => i.productName).join(", ")}
                  </Typography>
                </TableCell>
                <TableCell align="right">{fmtBaht(r.totalAmount)}</TableCell>
                <TableCell align="center"><Chip size="small" label={PAY_THAI[r.paymentStatus]} color={getPayColor(r.paymentStatus) as any} variant={r.paymentStatus==="WAITING"?"outlined":"filled"} /></TableCell>
                <TableCell align="center"><Chip size="small" label={ORDER_THAI[r.orderStatus]} color={getOrdColor(r.orderStatus) as any} /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" component={Link} to={`/orders/${r._id}`}><VisibilityIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={()=>setMsgDlg({open:true, order:r})}><ChatIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={()=>copyText(r.customerAddress||"")}><ContentCopyIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3 }}>ไม่พบข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={msgDlg.open} onClose={()=>setMsgDlg({open:false})} fullWidth maxWidth="xs">
        <DialogTitle>ส่งข้อความหาลูกค้า</DialogTitle>
        <Box px={3} pb={3}>
          <TextField fullWidth multiline rows={4} label="ข้อความ" value={msgText} onChange={e=>setMsgText(e.target.value)} />
          <Stack direction="row" justifyContent="flex-end" mt={2} spacing={1}>
            <Button onClick={()=>setMsgDlg({open:false})}>ยกเลิก</Button>
            <Button variant="contained" onClick={sendMessage}>ส่ง</Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
}