import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, IconButton, Alert, Chip, Grid, Divider, Tooltip, InputAdornment, FormHelperText,
  Card, CardContent
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";

// Icons
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import StoreIcon from '@mui/icons-material/Store';
import EventIcon from '@mui/icons-material/Event';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/Pending';

// API
import { listPO, createPO, downloadPO, listInventory, listSuppliers, type PO, type Product, type Variant, type Supplier } from "../../api/admin";

// Types
type NewItem = { productId: string; variantId?: string; quantity: number; unitPrice?: number };

// Helpers
const formatTHB = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
const formatDate = (date: string) => new Date(date).toLocaleDateString("th-TH", { year: 'numeric', month: 'short', day: 'numeric' });

export default function POList() {
  const theme = useTheme();
  const [rows, setRows] = useState<PO[] | null>(null);
  const [q, setQ] = useState("");

  // Dialogs
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedReceiveDate, setExpectedReceiveDate] = useState<string>("");
  const [items, setItems] = useState<NewItem[]>([{ productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Load Data
  const load = async () => {
    try {
      const data = await listPO();
      setRows(data);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const [inv, sups] = await Promise.all([listInventory(), listSuppliers()]);
        setProducts(inv);
        setSuppliers(sups);
      } catch { /* ignore */ }
    })();
  }, []);

  // Filter
  const view = useMemo(() => {
    const list = rows || [];
    if (!q) return list;
    const qq = q.toLowerCase();
    return list.filter(p => {
      const poNum = p.poNumber.toLowerCase();
      let supName = "";
      if (typeof p.supplier === 'object' && p.supplier !== null) {
        supName = (p.supplier as Supplier).name;
      } else {
        supName = p.supplierNameSnapshot || "";
      }
      return poNum.includes(qq) || supName.toLowerCase().includes(qq);
    });
  }, [rows, q]);

  // Logic
  const addRow = () => setItems(s => [...s, { productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);
  const removeRow = (idx: number) => setItems(s => s.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<NewItem>) => setItems(s => {
    const d = [...s]; d[idx] = { ...d[idx], ...patch }; return d;
  });

  const variantsOf = (pid: string): Variant[] => (products.find(p => p._id === pid)?.variants || []);
  const totalAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.unitPrice || 0) * Number(it.quantity || 0)), 0), [items]);

  const getProductName = (item: any) => {
    if (item.product && typeof item.product === 'object' && item.product.name) return item.product.name;
    if (item.productName) return item.productName;
    const pid = (item.product && typeof item.product === 'object') ? item.product._id : item.product;
    const found = products.find(p => p._id === pid);
    return found ? found.name : "Unknown Product";
  };

  const getSupplierName = (po: PO) => {
    if (po.supplier && typeof po.supplier === 'object') {
        return (po.supplier as Supplier).name;
    }
    return po.supplierNameSnapshot || "(ไม่ระบุ)";
  };

  const save = async () => {
    if (!selectedSupplierId) { setMsg({ type: "error", text: "กรุณาเลือก Supplier" }); return; }
    const validRows = items.filter(it => it.productId && Number(it.quantity) > 0);
    if (!validRows.length) { setMsg({ type: "error", text: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 แถว" }); return; }

    setSaving(true); setMsg(null);
    try {
      const calculatedTotal = validRows.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
      const payloadItems = validRows.map(it => {
        const product = products.find(p => p._id === it.productId);
        const variant = product?.variants.find(v => v._id === it.variantId);
        return {
          product: it.productId,
          variantId: it.variantId || undefined,
          productName: product?.name || "", 
          size: variant?.size || "",       
          color: variant?.color || "",     
          quantity: Number(it.quantity || 0),
          price: Number(it.unitPrice || 0)
        };
      });

      const body = {
        supplier: selectedSupplierId,
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        expectedReceiveDate: expectedReceiveDate ? new Date(expectedReceiveDate).toISOString() : undefined,
        items: payloadItems,
        totalAmount: calculatedTotal
      };
      
      await createPO(body);
      setOpenCreate(false);
      
      // Reset
      setSelectedSupplierId(""); setOrderDate(new Date().toISOString().split('T')[0]);
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
      setMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการดาวน์โหลด' });
    }
  };

  const getStatusChip = (status: string) => {
    let color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" = "default";
    let icon = <PendingIcon />;
    let label = status;

    switch (status) {
      case 'DRAFT': color = "default"; label="Draft"; break;
      case 'ORDERED': color = "info"; icon=<LocalShippingIcon/>; label="Ordered"; break;
      case 'RECEIVED': color = "success"; icon=<CheckCircleIcon/>; label="Received"; break;
      case 'CANCELLED': color = "error"; icon=<CancelIcon/>; label="Cancelled"; break;
      case 'PARTIAL': color = "warning"; icon=<LocalShippingIcon/>; label="Partial"; break;
    }
    
    return (
        <Chip 
            icon={icon} 
            label={label} 
            color={color} 
            size="small" 
            variant="outlined" 
            sx={{ 
                fontWeight: 'bold', 
                border: 'none', 
                // ✅ แก้ไขตรงนี้ เพื่อไม่ให้ Error
                bgcolor: (t) => {
                    if (color === 'default') return alpha(t.palette.text.primary, 0.08);
                    return t.palette[color] ? alpha(t.palette[color].main, 0.1) : 'transparent';
                },
                // ✅ แก้ไขตรงนี้
                color: (t) => {
                    if (color === 'default') return t.palette.text.secondary;
                    return t.palette[color] ? t.palette[color].main : 'inherit';
                }
            }} 
        />
    );
  };

  return (
    <Box p={{ xs: 2, md: 4 }} sx={{ bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ display:'flex', alignItems:'center', gap:1 }}>
            <DescriptionIcon fontSize="large"/> Purchase Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">จัดการใบสั่งซื้อสินค้า และสถานะการรับของจาก Supplier</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} sx={{ borderRadius: 2 }}>รีเฟรช</Button>
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" onClick={() => setOpenCreate(true)} sx={{ borderRadius: 2, boxShadow: 3 }}>
            สร้าง PO ใหม่
          </Button>
        </Stack>
      </Stack>

      {/* Search */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <TextField 
          size="small" 
          placeholder="ค้นหา (เลข PO / Supplier)..." 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          fullWidth
          InputProps={{ 
            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
            sx: { borderRadius: 2 }
          }}
          sx={{ maxWidth: 400 }}
        />
      </Paper>

      {msg && <Alert sx={{ mb: 2, borderRadius: 2 }} severity={msg.type} onClose={()=>setMsg(null)}>{msg.text}</Alert>}

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>เลข PO</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Supplier</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>สถานะ</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>วันที่สั่ง</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>กำหนดรับ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>ยอดรวม</TableCell>
              <TableCell align="center" width={160} sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
              {view.map(p => (
                <TableRow component={motion.tr} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} key={p._id} hover>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{p.poNumber}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <StoreIcon fontSize="small" color="action"/>
                        <Typography variant="body2">{getSupplierName(p)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{getStatusChip(p.status)}</TableCell>
                  <TableCell>{p.orderDate ? formatDate(p.orderDate) : "-"}</TableCell>
                  <TableCell>{p.expectedReceiveDate ? formatDate(p.expectedReceiveDate) : "-"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'success.dark' }}>{formatTHB(p.totalAmount || 0)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="รายละเอียด">
                        <IconButton size="small" onClick={()=>{ setSelectedPO(p); setOpenDetail(true); }} sx={{color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1)}}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="PDF">
                        <IconButton size="small" onClick={()=>handleExport(p._id, "pdf")} sx={{color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1)}}>
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excel">
                        <IconButton size="small" onClick={()=>handleExport(p._id, "excel")} sx={{color: 'success.main', bgcolor: alpha(theme.palette.success.main, 0.1)}}>
                          <TableViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
            {view.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่พบข้อมูลใบสั่งซื้อ</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* --- Create PO Dialog --- */}
      <Dialog open={openCreate} onClose={()=>setOpenCreate(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddCircleOutlineIcon /> สร้างใบสั่งซื้อ (Create PO)
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Supplier (ผู้ขาย)"
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  fullWidth
                  required
                  InputProps={{ startAdornment: <InputAdornment position="start"><StoreIcon/></InputAdornment> }}
                >
                    <MenuItem value="">— เลือกผู้ขาย —</MenuItem>
                    {suppliers.map(s => (
                        <MenuItem key={s._id} value={s._id}>{s.name} {s.contactPerson ? `(${s.contactPerson})` : ''}</MenuItem>
                    ))}
                </TextField>
                {suppliers.length === 0 && <FormHelperText sx={{color: 'warning.main'}}>⚠️ ยังไม่มีข้อมูล Supplier</FormHelperText>}
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="วันที่สั่ง (Order Date)" type="date" InputLabelProps={{ shrink: true }} value={orderDate} onChange={e=>setOrderDate(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="วันคาดว่าจะรับ (Expected)" type="date" InputLabelProps={{ shrink: true }} value={expectedReceiveDate} onChange={e=>setExpectedReceiveDate(e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }}><Chip label="รายการสินค้า" icon={<LocalShippingIcon/>} /></Divider>

            <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2 }}>
            {items.map((it, idx) => (
              <Paper key={idx} elevation={0} sx={{ p: 2, mb: 1.5, borderRadius: 2, border: '1px solid #e0e0e0' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select label="สินค้า" value={it.productId} fullWidth size="small"
                      onChange={e=>{ updateRow(idx, { productId: e.target.value, variantId: "" }); }}
                    >
                      <MenuItem value="">— เลือกสินค้า —</MenuItem>
                      {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      select label="Variant" value={it.variantId || ""} fullWidth size="small"
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
                    <IconButton onClick={()=>removeRow(idx)} color="error" size="small"><DeleteOutlineIcon /></IconButton>
                  </Grid>
                </Grid>
              </Paper>
            ))}
            <Button startIcon={<AddCircleOutlineIcon />} onClick={addRow} variant="outlined" fullWidth sx={{ borderStyle: 'dashed', bgcolor: 'white' }}>
              เพิ่มรายการสินค้า
            </Button>
            </Box>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.light', borderRadius: 2, color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 2 }}>
              <Typography variant="subtitle1">ยอดรวมสุทธิ (Total Amount)</Typography>
              <Typography variant="h5" fontWeight="bold">{formatTHB(totalAmount)}</Typography>
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={()=>setOpenCreate(false)}>ยกเลิก</Button>
          <Button onClick={save} variant="contained" size="large" disabled={saving || suppliers.length===0} sx={{ px: 4 }}>
            {saving ? "กำลังบันทึก..." : "ยืนยันการสร้าง PO"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Detail Dialog --- */}
      <Dialog open={openDetail} onClose={()=>setOpenDetail(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box display="flex" alignItems="center" gap={1}>
                <DescriptionIcon color="primary"/> 
                <span>PO: <b>{selectedPO?.poNumber}</b></span>
            </Box>
            {selectedPO && getStatusChip(selectedPO.status)}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedPO && (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <Card variant="outlined" sx={{ bgcolor: '#f9fafb' }}>
                        <CardContent sx={{ py: 2 }}>
                            <Typography variant="caption" color="text.secondary">SUPPLIER</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ display:'flex', alignItems:'center', gap:1 }}>
                                <StoreIcon color="action"/> {getSupplierName(selectedPO)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card variant="outlined">
                        <CardContent sx={{ py: 2 }}>
                            <Typography variant="caption" color="text.secondary">ORDER DATE</Typography>
                            <Typography variant="subtitle1" fontWeight={600}><EventIcon fontSize="inherit" sx={{mr:0.5, verticalAlign:'middle'}}/>{formatDate(selectedPO.orderDate)}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <Card variant="outlined">
                        <CardContent sx={{ py: 2 }}>
                            <Typography variant="caption" color="text.secondary">EXPECTED</Typography>
                            <Typography variant="subtitle1" fontWeight={600}>{selectedPO.expectedReceiveDate ? formatDate(selectedPO.expectedReceiveDate) : "-"}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
              </Grid>
              
              <Divider textAlign="left"><Chip label="Order Items" size="small"/></Divider>
              
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                     <TableCell>สินค้า</TableCell>
                     <TableCell>Spec</TableCell>
                     <TableCell align="right">สั่ง</TableCell>
                     <TableCell align="right" sx={{color: 'success.main'}}>รับแล้ว</TableCell>
                     <TableCell align="right">ราคา/หน่วย</TableCell>
                     <TableCell align="right">รวม</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedPO.items?.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{getProductName(item)}</TableCell>
                        <TableCell><Chip label={`${item.size} ${item.color}`} size="small" variant="outlined"/></TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: (item.receivedQuantity >= item.quantity) ? 'success.main' : 'warning.main' }}>
                            {item.receivedQuantity || 0}
                        </TableCell>
                        <TableCell align="right">{formatTHB(item.price || 0)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatTHB((item.price||0) * (item.quantity||0))}</TableCell>
                      </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.1rem' }}>{formatTHB(selectedPO.totalAmount || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f9fafb' }}>
          <Button onClick={()=>setOpenDetail(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}