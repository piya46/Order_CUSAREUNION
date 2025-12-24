// src/pages/Inventory.tsx
import { useEffect, useState, useMemo } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, TextField, Stack, InputAdornment, Grid, Card, CardContent, Button,
  MenuItem, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, alpha, useTheme, LinearProgress
} from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }

type InventoryItem = {
  productId: string;
  variantId: string;
  productCode?: string;
  productName: string;
  category?: string;
  image?: string;
  size: string;
  color?: string;
  price: number;
  total: number;     // available + reserved
  reserved: number;  // locked
  available: number; // stock
  sold: number;      // paidQty from backend
  status: "OK" | "LOW" | "OUT";
  preorder: boolean;
};

export default function Inventory() {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters (อ่านจาก URL query ถ้ามี)
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const [stockStatus, setStockStatus] = useState(searchParams.get('status') || "ALL");

  // Adjust Dialog
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [newStock, setNewStock] = useState<number | string>("");
  const [saving, setSaving] = useState(false);

  // Load Data
  const load = async () => {
    setLoading(true);
    try {
      // ดึงข้อมูลสินค้า + ยอดขาย (Inventory Endpoint)
      const res = await fetch(`${API}/products/inventory`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      
      const flat: InventoryItem[] = [];
      if (Array.isArray(data)) {
        data.forEach((p: any) => {
          p.variants.forEach((v: any) => {
             // Logic คำนวณสถานะสต็อก
             const available = v.stock || 0;
             let status: "OK"|"LOW"|"OUT" = "OK";
             if (available === 0) status = "OUT";
             else if (available <= 5) status = "LOW";

             flat.push({
               productId: p._id,
               variantId: v._id,
               productCode: p.productCode,
               productName: p.name,
               category: p.category || "Uncategorized",
               image: p.imageUrls?.[0],
               size: v.size,
               color: v.color || "-",
               price: v.price,
               total: (v.stock || 0) + (v.locked || 0),
               reserved: v.locked || 0,
               available: available,
               sold: v.paidQty || 0, // ยอดที่ขายจริงจาก Backend
               status: status,
               preorder: !!p.preorder
             });
          });
        });
      }
      setRows(flat);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter Logic
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchQ = !q || r.productName.toLowerCase().includes(q.toLowerCase()) || r.productCode?.toLowerCase().includes(q.toLowerCase());
      const matchCat = cat === "ALL" || r.category === cat;
      const matchStatus = stockStatus === "ALL" || 
                          (stockStatus === "LOW" && r.status === "LOW") || 
                          (stockStatus === "OUT" && r.status === "OUT") ||
                          (stockStatus === "OK" && r.status === "OK");
      return matchQ && matchCat && matchStatus;
    });
  }, [rows, q, cat, stockStatus]);

  // Stats
  const stats = useMemo(() => ({
    totalSKUs: rows.length,
    totalValue: rows.reduce((s, r) => s + (r.available * r.price), 0),
    lowStock: rows.filter(r => r.status === "LOW" && !r.preorder).length,
    outStock: rows.filter(r => r.status === "OUT" && !r.preorder).length
  }), [rows]);

  const categories = useMemo(() => Array.from(new Set(rows.map(r => r.category))), [rows]);

  // Save Stock Adjustment
  const saveAdjust = async () => {
    if (!adjustItem) return;
    setSaving(true);
    try {
      // 1. ดึง Product ตัวเต็มมาก่อน (เพื่อความปลอดภัย ไม่ให้ Variant อื่นหาย)
      const pRes = await fetch(`${API}/products/${adjustItem.productId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if(!pRes.ok) throw new Error("Product fetch failed");
      const product = await pRes.json();
      
      // 2. แก้ไขเฉพาะ Variant ที่เลือก
      const updatedVariants = product.variants.map((v: any) => {
         if (v._id === adjustItem.variantId || (v.size === adjustItem.size && v.color === adjustItem.color)) {
             return { ...v, stock: Number(newStock) }; // อัปเดต stock ใหม่
         }
         return v;
      });

      // 3. บันทึกกลับไป
      const res = await fetch(`${API}/products/${adjustItem.productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ variants: updatedVariants }) // ส่งเฉพาะ variants ที่แก้แล้ว
      });

      if (!res.ok) throw new Error("Update failed");
      
      alert("✅ ปรับปรุงยอดสต็อกเรียบร้อย");
      setAdjustItem(null);
      load(); // รีโหลดข้อมูลใหม่
    } catch (e) {
      alert("❌ เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    const data = filtered.map(r => ({
      "Code": r.productCode,
      "Product": r.productName,
      "Category": r.category,
      "Size": r.size,
      "Color": r.color,
      "Price": r.price,
      "Available (พร้อมขาย)": r.preorder ? "Preorder" : r.available,
      "Reserved (ติดจอง)": r.reserved,
      "Sold (ขายแล้ว)": r.sold,
      "Status": r.preorder ? "Preorder" : r.status
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
            <Box p={1.5} borderRadius={3} bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main">
                <WarehouseIcon fontSize="large" />
            </Box>
            <Box>
                <Typography variant="h4" fontWeight={900}>คลังสินค้า (Inventory)</Typography>
                <Typography variant="body2" color="text.secondary">ภาพรวมสินค้าคงเหลือและการเคลื่อนไหวสต็อก</Typography>
            </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} sx={{ borderRadius: 2 }}>รีเฟรช</Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportExcel} sx={{ borderRadius: 2 }}>Export</Button>
            <Button component={Link} to="/receiving" variant="contained" startIcon={<AddCircleOutlineIcon />} sx={{ borderRadius: 2, fontWeight: 700 }}>
                รับสินค้าเข้า (PO)
            </Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      <Grid container spacing={2} mb={4}>
         <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <Inventory2Icon sx={{ fontSize: 40, color: 'text.secondary', mr: 2 }} />
                    <Box>
                        <Typography variant="h4" fontWeight={800}>{stats.totalSKUs.toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">รายการสินค้า (SKUs)</Typography>
                    </Box>
                </CardContent>
            </Card>
         </Grid>
         <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <MonetizationOnIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                    <Box>
                        <Typography variant="h4" fontWeight={800} color="success.main">฿{stats.totalValue.toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">มูลค่าสินค้าพร้อมขาย (Estimate)</Typography>
                    </Box>
                </CardContent>
            </Card>
         </Grid>
         <Grid item xs={12} sm={4}>
            <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: stats.lowStock > 0 ? 'error.main' : 'divider', bgcolor: stats.lowStock > 0 ? alpha(theme.palette.error.main, 0.05) : 'white' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <WarningAmberIcon sx={{ fontSize: 40, color: stats.lowStock > 0 ? 'error.main' : 'text.disabled', mr: 2 }} />
                    <Box>
                        <Typography variant="h4" fontWeight={800} color={stats.lowStock > 0 ? 'error.main' : 'text.primary'}>
                             {stats.lowStock + stats.outStock}
                        </Typography>
                        <Typography variant="caption" color={stats.lowStock > 0 ? 'error.main' : 'text.secondary'}>
                             รายการสินค้าเหลือน้อย / หมด
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
         </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
                <TextField 
                    fullWidth size="small" placeholder="ค้นหาชื่อสินค้า, รหัส..." value={q} onChange={e=>setQ(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <TextField select fullWidth size="small" label="หมวดหมู่" value={cat} onChange={e=>setCat(e.target.value)}>
                    <MenuItem value="ALL">ทุกหมวดหมู่</MenuItem>
                    {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
            </Grid>
            <Grid item xs={6} md={3}>
                <TextField select fullWidth size="small" label="สถานะสต็อก" value={stockStatus} onChange={e=>setStockStatus(e.target.value)}>
                    <MenuItem value="ALL">ทั้งหมด</MenuItem>
                    <MenuItem value="OK">✅ มีสินค้า (In Stock)</MenuItem>
                    <MenuItem value="LOW">⚠️ เหลือน้อย (Low Stock)</MenuItem>
                    <MenuItem value="OUT">❌ สินค้าหมด (Out of Stock)</MenuItem>
                </TextField>
            </Grid>
        </Grid>
      </Paper>

      {/* Inventory Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid', borderColor: 'divider' }}>
        {loading && <LinearProgress />}
        <Table stickyHeader>
          <TableHead sx={{ '& th': { fontWeight: 800, bgcolor: '#FAFAFA' } }}>
            <TableRow>
              <TableCell>สินค้า</TableCell>
              <TableCell>ตัวเลือก (Variant)</TableCell>
              <TableCell align="right">ราคา</TableCell>
              <TableCell align="center">สถานะ</TableCell>
              <TableCell align="center" sx={{ bgcolor: alpha(theme.palette.success.main, 0.05), color: 'success.dark' }}>พร้อมขาย</TableCell>
              <TableCell align="center" sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.dark' }}>ติดจอง</TableCell>
              <TableCell align="center" sx={{ color: 'primary.main' }}>ขายแล้ว</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && !loading ? (
                 <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่พบรายการสินค้า</TableCell></TableRow>
            ) : filtered.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                         {r.image && <Box component="img" src={r.image} sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover' }} />}
                         <Box>
                            <Typography variant="body2" fontWeight={700}>{r.productName}</Typography>
                            {r.productCode && <Typography variant="caption" color="text.secondary">#{r.productCode}</Typography>}
                            <Chip label={r.category} size="small" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
                         </Box>
                    </Stack>
                </TableCell>
                <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.size}</Typography>
                    {r.color !== "-" && <Typography variant="caption" color="text.secondary">{r.color}</Typography>}
                </TableCell>
                <TableCell align="right">{r.price.toLocaleString()}</TableCell>
                <TableCell align="center">
                    {r.preorder ? (
                         <Chip label="Preorder" size="small" color="warning" variant="outlined" />
                    ) : r.status === "OUT" ? (
                         <Chip label="หมด" size="small" color="error" />
                    ) : r.status === "LOW" ? (
                         <Chip label="เหลือน้อย" size="small" color="warning" />
                    ) : (
                         <Chip label="มีของ" size="small" color="success" variant="outlined" icon={<CheckCircleIcon />} />
                    )}
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: alpha(theme.palette.success.main, 0.05), fontWeight: 700, color: 'success.main', fontSize: '1.1rem' }}>
                    {r.preorder ? "∞" : r.available.toLocaleString()}
                </TableCell>
                <TableCell align="center" sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main' }}>
                    {r.reserved > 0 ? r.reserved.toLocaleString() : "-"}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {r.sold > 0 ? r.sold.toLocaleString() : "-"}
                </TableCell>
                <TableCell align="right">
                    <Tooltip title="ปรับสต็อกด่วน">
                        <IconButton size="small" onClick={()=>{ setAdjustItem(r); setNewStock(r.available); }} color="primary" disabled={r.preorder}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Adjust Dialog */}
      <Dialog open={!!adjustItem} onClose={()=>setAdjustItem(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>🛠️ ปรับจำนวนสต็อก (Manual)</DialogTitle>
          <DialogContent>
               <Alert severity="warning" sx={{ mb: 2 }}>
                   เหมาะสำหรับกรณีของหาย, นับผิด, หรือปรับยอดด่วน <br/>
                   <b>หากเป็นการรับของเข้าปกติ โปรดใช้เมนู "รับสินค้าเข้า (PO)"</b>
               </Alert>
               {adjustItem && (
                   <Box textAlign="center" mb={2}>
                       <Typography fontWeight={700}>{adjustItem.productName}</Typography>
                       <Typography variant="body2" color="text.secondary">{adjustItem.size} {adjustItem.color}</Typography>
                   </Box>
               )}
               <TextField 
                  fullWidth autoFocus
                  label="จำนวนพร้อมขาย (Available Stock)" 
                  type="number" 
                  value={newStock} onChange={e=>setNewStock(e.target.value)}
                  InputProps={{ sx: { fontSize: '1.5rem', textAlign: 'center' } }}
               />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
              <Button onClick={()=>setAdjustItem(null)}>ยกเลิก</Button>
              <Button variant="contained" onClick={saveAdjust} disabled={saving} startIcon={<SaveIcon />}>
                  {saving ? "กำลังบันทึก..." : "บันทึกยอดใหม่"}
              </Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}