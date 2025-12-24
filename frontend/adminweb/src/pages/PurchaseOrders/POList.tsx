import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, IconButton, Alert, Chip, Grid, Divider, Tooltip, InputAdornment
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';

import { listPO, createPO, downloadPO, listInventory, type PO, type Product, type Variant } from "../../api/admin";

// Types
type NewItem = { productId: string; variantId?: string; quantity: number; unitPrice?: number };

// Helpers
const formatTHB = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
const formatDate = (date: string) => new Date(date).toLocaleDateString("th-TH", { year: 'numeric', month: 'short', day: 'numeric' });

export default function POList() {
  const [rows, setRows] = useState<PO[] | null>(null);
  const [q, setQ] = useState("");

  // Dialogs
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Form State
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedReceiveDate, setExpectedReceiveDate] = useState<string>("");
  const [items, setItems] = useState<NewItem[]>([{ productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);

  const [products, setProducts] = useState<Product[]>([]);

  // Load Data
  const load = async () => {
    try {
      const data = await listPO();
      setRows(data);
    } catch {
      setRows([]);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const inv = await listInventory();
        setProducts(inv);
      } catch { setProducts([]); }
    })();
  }, []);

  const view = useMemo(() => {
    const list = rows || [];
    if (!q) return list;
    const qq = q.toLowerCase();
    return list.filter(p => p.poNumber.toLowerCase().includes(qq) || (p.supplierName || "").toLowerCase().includes(qq));
  }, [rows, q]);

  // Logic
  const addRow = () => setItems(s => [...s, { productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);
  const removeRow = (idx: number) => setItems(s => s.filter((_, i) => i !== idx));

  const updateRow = (idx: number, patch: Partial<NewItem>) => setItems(s => {
    const d = [...s]; d[idx] = { ...d[idx], ...patch }; return d;
  });

  const variantsOf = (pid: string): Variant[] => (products.find(p => p._id === pid)?.variants || []);
  const totalAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.unitPrice || 0) * Number(it.quantity || 0)), 0), [items]);

  // ✅ Helper: หาชื่อสินค้าสำหรับ PO
  const getProductName = (item: any) => {
    if (typeof item.product === 'object' && item.product?.name) return item.product.name;
    if (item.productName) return item.productName;
    
    // ค้นจาก Products Store ใน Frontend
    const pid = typeof item.product === 'object' ? item.product?._id : item.product;
    const found = products.find(p => p._id === pid);
    return found ? found.name : "Unknown Product";
  };

  const save = async () => {
    if (!supplierName.trim()) { setMsg({ type: "error", text: "กรุณากรอกชื่อ Supplier" }); return; }
    const validRows = items.filter(it => it.productId && Number(it.quantity) > 0);
    if (!validRows.length) { setMsg({ type: "error", text: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 แถว" }); return; }

    setSaving(true); setMsg(null);
    try {
      // ✅ คำนวณยอดรวมที่ Frontend เพื่อส่งไปบันทึก
      const calculatedTotal = validRows.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);

      // เตรียมข้อมูลสินค้าให้ครบถ้วน แก้ไขชื่อ Field ให้ตรงกับ Backend Model
      const payloadItems = validRows.map(it => {
        const product = products.find(p => p._id === it.productId);
        const variant = product?.variants.find(v => v._id === it.variantId);
        return {
          product: it.productId,           // ✅ ถูกต้อง: PO Model ใช้ 'product'
          variantId: it.variantId || undefined,
          productName: product?.name || "", 
          size: variant?.size || "",       
          color: variant?.color || "",     
          quantity: Number(it.quantity || 0),
          price: Number(it.unitPrice || 0) // ✅ ถูกต้อง: POItem Model ใช้ 'price' (แต่ state เราใช้ unitPrice)
        };
      });

      const body = {
        supplierName: supplierName.trim(),
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        expectedReceiveDate: expectedReceiveDate ? new Date(expectedReceiveDate).toISOString() : undefined,
        items: payloadItems,
        totalAmount: calculatedTotal
      };
      
      await createPO(body);
      setOpenCreate(false);
      
      // Reset Form
      setSupplierName(""); setOrderDate(new Date().toISOString().split('T')[0]);
      setExpectedReceiveDate(""); setItems([{ productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);
      
      await load();
      setMsg({ type: "success", text: "สร้าง PO สำเร็จ!" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "สร้าง PO ไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (id: string, type: "pdf" | "excel") => {
    try {
      setMsg({ type: 'info', text: 'กำลังดาวน์โหลด...' });
      await downloadPO(id, type);
      setMsg(null);
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการดาวน์โหลด' });
    }
  };

  const getStatusChip = (status: string) => {
    let color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" = "default";
    switch (status) {
      case 'DRAFT': color = "default"; break;
      case 'ORDERED': color = "info"; break;
      case 'RECEIVED': color = "success"; break;
      case 'CANCELLED': color = "error"; break;
      case 'PARTIAL': color = "warning"; break;
    }
    return <Chip label={status} color={color} size="small" variant="filled" sx={{ fontWeight: 'bold' }} />;
  };

  return (
    <Box p={{ xs: 2, md: 4 }} sx={{ bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary.main">Purchase Orders</Typography>
          <Typography variant="body2" color="text.secondary">จัดการใบสั่งซื้อสินค้าและสถานะการรับของ</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} sx={{ borderRadius: 2 }}>รีเฟรช</Button>
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" onClick={() => setOpenCreate(true)} sx={{ borderRadius: 2, boxShadow: 2 }}>
            สร้าง PO ใหม่
          </Button>
        </Stack>
      </Stack>

      {/* Filter & Message */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
        <TextField 
          size="small" 
          placeholder="ค้นหา (เลข PO / Supplier)..." 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          fullWidth
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
          sx={{ maxWidth: 400 }}
        />
      </Paper>

      {msg && <Alert sx={{ mb: 2, borderRadius: 2 }} severity={msg.type} onClose={()=>setMsg(null)}>{msg.text}</Alert>}

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: '1px solid #eaeff1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>เลข PO</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Supplier</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>สถานะ</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>สั่งเมื่อ</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>คาดรับ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>ยอดรวม</TableCell>
              <TableCell align="center" width={180} sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
              {view.map(p => (
                <TableRow component={motion.tr} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} key={p._id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{p.poNumber}</TableCell>
                  <TableCell>{p.supplierName || "-"}</TableCell>
                  <TableCell>{getStatusChip(p.status)}</TableCell>
                  <TableCell>{p.orderDate ? formatDate(p.orderDate) : "-"}</TableCell>
                  <TableCell>{p.expectedReceiveDate ? formatDate(p.expectedReceiveDate) : "-"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>{formatTHB(p.totalAmount || 0)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="รายละเอียด">
                        <IconButton size="small" color="primary" onClick={()=>{ setSelectedPO(p); setOpenDetail(true); }}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="ดาวน์โหลด PDF">
                        <IconButton size="small" color="error" onClick={()=>handleExport(p._id, "pdf")}>
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="ดาวน์โหลด Excel">
                        <IconButton size="small" color="success" onClick={()=>handleExport(p._id, "excel")}>
                          <TableViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
            {view.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>ไม่พบข้อมูล</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* --- Create PO Dialog --- */}
      <Dialog open={openCreate} onClose={()=>setOpenCreate(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShippingIcon /> สร้างใบสั่งซื้อ (Create PO)
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Supplier Name (ชื่อซัพพลายเออร์)" value={supplierName} onChange={e=>setSupplierName(e.target.value)} fullWidth required />
              </Grid>
              <Grid item xs={6}>
                <TextField label="วันที่สั่ง (Order Date)" type="date" InputLabelProps={{ shrink: true }} value={orderDate} onChange={e=>setOrderDate(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="วันคาดว่าจะรับ (Expected)" type="date" InputLabelProps={{ shrink: true }} value={expectedReceiveDate} onChange={e=>setExpectedReceiveDate(e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }}><Chip label="รายการสินค้า" /></Divider>

            {items.map((it, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select label="เลือกสินค้า" value={it.productId} fullWidth size="small"
                      onChange={e=>{ updateRow(idx, { productId: e.target.value, variantId: "" }); }}
                    >
                      <MenuItem value="">— เลือกสินค้า —</MenuItem>
                      {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      select label="ตัวเลือก (Variant)" value={it.variantId || ""} fullWidth size="small"
                      disabled={!it.productId}
                      onChange={e=>updateRow(idx, { variantId: e.target.value })}
                    >
                      <MenuItem value="">(ไม่ระบุ)</MenuItem>
                      {variantsOf(it.productId).map(v => (
                        <MenuItem key={v._id || `${v.size}-${v.color}`} value={v._id || `${v.size}|${v.color}`}>
                          {v.size}{v.color ? ` / ${v.color}` : ""} — {formatTHB(v.price||0)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField label="จำนวน" type="number" size="small" fullWidth value={it.quantity} onChange={e=>updateRow(idx, { quantity: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField label="ราคา/หน่วย" type="number" size="small" fullWidth value={it.unitPrice} onChange={e=>updateRow(idx, { unitPrice: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={12} sm={1} display="flex" justifyContent="center">
                    <IconButton onClick={()=>removeRow(idx)} color="error"><DeleteOutlineIcon /></IconButton>
                  </Grid>
                </Grid>
              </Paper>
            ))}
            <Button startIcon={<AddCircleOutlineIcon />} onClick={addRow} variant="outlined" sx={{ mt: 1, borderStyle: 'dashed' }} fullWidth>
              เพิ่มรายการสินค้า
            </Button>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.light', borderRadius: 2, color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6">ยอดรวมสุทธิ</Typography>
              <Typography variant="h6" fontWeight="bold">{formatTHB(totalAmount)}</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={()=>setOpenCreate(false)}>ยกเลิก</Button>
          <Button onClick={save} variant="contained" size="large" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "ยืนยันการสร้าง PO"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Detail Dialog --- */}
      <Dialog open={openDetail} onClose={()=>setOpenDetail(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ borderBottom: '1px solid #eee' }}>
            รายละเอียด PO: <b>{selectedPO?.poNumber}</b>
            {selectedPO && <Box component="span" sx={{ ml: 2 }}>{getStatusChip(selectedPO.status)}</Box>}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedPO && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}><Typography variant="body2" color="text.secondary">Supplier:</Typography> <Typography variant="body1" fontWeight={600}>{selectedPO.supplierName}</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" color="text.secondary">Order Date:</Typography> <Typography variant="body1">{formatDate(selectedPO.orderDate)}</Typography></Grid>
              </Grid>
              
              <Divider textAlign="left" sx={{ my: 2 }}>รายการสินค้า</Divider>
              
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                     <TableCell>สินค้า</TableCell>
                     <TableCell>Spec</TableCell>
                     <TableCell align="right">จำนวนสั่ง</TableCell>
                     <TableCell align="right" sx={{color: 'success.main'}}>รับแล้ว</TableCell>
                     <TableCell align="right">ราคา/หน่วย</TableCell>
                     <TableCell align="right">รวม</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedPO.items?.map((item: any, i: number) => {
                    return (
                      <TableRow key={i}>
                        {/* ✅ ใช้ Helper getProductName */}
                        <TableCell>{getProductName(item)}</TableCell>
                        <TableCell>{item.size} {item.color}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: (item.receivedQuantity >= item.quantity) ? 'success.main' : 'warning.main' }}>
                            {item.receivedQuantity || 0}
                        </TableCell>
                        <TableCell align="right">{formatTHB(item.price || 0)}</TableCell>
                        <TableCell align="right">{formatTHB((item.price||0) * (item.quantity||0))}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatTHB(selectedPO.totalAmount || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenDetail(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}