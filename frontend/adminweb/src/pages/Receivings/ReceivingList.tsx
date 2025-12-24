import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, IconButton, Alert,
  Chip, Grid, InputAdornment, Tooltip, Divider
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import AddBoxIcon from "@mui/icons-material/AddBox";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import InventoryIcon from '@mui/icons-material/Inventory';
import TableViewIcon from '@mui/icons-material/TableView';

import {
  listReceiving, createReceiving, downloadReceiving,
  listPO, listInventory,
  type Receiving, type PO, type Product, type Variant
} from "../../api/admin";

type NewItem = { productId: string; variantId?: string; quantity: number; unitCost?: number };

const formatDate = (date: string) => new Date(date).toLocaleDateString("th-TH", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });

export default function ReceivingList() {
  const [rows, setRows] = useState<Receiving[] | null>(null);
  const [q, setQ] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedReceiving, setSelectedReceiving] = useState<Receiving | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:'success'|'error'|'info', text:string} | null>(null);

  // Form State
  const [po, setPo] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<NewItem[]>([{ productId: "", variantId: "", quantity: 1, unitCost: 0 }]);

  const [poList, setPoList] = useState<PO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Init Data
  const load = async () => {
    try {
      const data = await listReceiving();
      setRows(data);
    } catch { setRows([]); }
  };
  useEffect(()=>{ load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [pos, inv] = await Promise.all([listPO(), listInventory()]);
        setPoList(pos);
        setProducts(inv);
      } catch { setPoList([]); setProducts([]); }
    })();
  }, []);

  // Auto-fill receiver name
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('admin') || localStorage.getItem('auth');
      if (stored) {
        const u = JSON.parse(stored);
        const name = u.name || u.username || u.firstName || u.user?.name || u.user?.username || "Admin";
        setReceiverName(name);
      }
    } catch (err) { }
  }, []);

  const view = useMemo(() => {
    const list = rows || [];
    if (!q) return list;
    const qq = q.toLowerCase();
    return list.filter(r => r.receivingNumber.toLowerCase().includes(qq) || (r.receiverName||"").toLowerCase().includes(qq));
  }, [rows, q]);

  const addRow = () => setItems(s => [...s, { productId: "", variantId: "", quantity: 1, unitCost: 0 }]);
  const removeRow = (idx: number) => setItems(s => s.filter((_,i)=>i!==idx));
  const updateRow = (idx: number, patch: Partial<NewItem>) => setItems(s => { const d=[...s]; d[idx] = { ...d[idx], ...patch }; return d; });
  const variantsOf = (pid: string): Variant[] => (products.find(p => p._id === pid)?.variants || []);

  const getProductName = (item: any) => {
    if (item.product && typeof item.product === 'object' && item.product.name) return item.product.name;
    if (item.productName) return item.productName;
    const pid = (item.product && typeof item.product === 'object') ? item.product._id : item.product;
    const found = products.find(p => p._id === pid);
    return found ? found.name : "Unknown Product";
  };

  const handleSelectPO = (poId: string) => {
    setPo(poId);
    if (!poId) {
        setItems([{ productId: "", variantId: "", quantity: 1, unitCost: 0 }]);
        return;
    }

    const selected = poList.find(p => p._id === poId);
    if (selected && selected.items) {
        const newItems: NewItem[] = [];

        selected.items.forEach((poItem: any) => {
            const ordered = poItem.quantity || 0;
            const received = poItem.receivedQuantity || 0;
            const remaining = ordered - received;

            if (remaining > 0) {
                const prodId = (typeof poItem.product === 'object' && poItem.product) ? poItem.product._id : (poItem.product || "");
                let varId = "";
                
                // หา Product และ Variant ID จริงๆ จาก Store (เพราะ PO Item อาจจะไม่มี variantId เก็บไว้ในบางเคส)
                const product = products.find(p => p._id === prodId);
                if (product && product.variants) {
                    const matchVar = product.variants.find(v => v.size === poItem.size && v.color === poItem.color);
                    if (matchVar) varId = matchVar._id;
                }

                newItems.push({
                    productId: prodId,
                    variantId: varId, // ใส่ Variant ID ให้ตรง เพื่อให้ Backend ตัดสต็อกถูกตัว
                    quantity: remaining,
                    unitCost: poItem.price || 0
                });
            }
        });

        if (newItems.length > 0) {
            setItems(newItems);
             setMsg({ type: 'info', text: `ดึงรายการสินค้าจาก PO เรียบร้อย (${newItems.length} รายการคงเหลือ)` });
             setTimeout(()=>setMsg(null), 3000);
        } else {
             setMsg({ type: 'info', text: 'PO นี้ได้รับสินค้าครบถ้วนแล้ว (Completed)' });
             setItems([{ productId: "", variantId: "", quantity: 1, unitCost: 0 }]);
        }
    }
  };

  const save = async () => {
    const validRows = items.filter(it => it.productId && Number(it.quantity) > 0);
    if (!validRows.length) { setMsg({type:'error', text:"กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ"}); return; }
    if (!receiverName.trim()) { setMsg({type:'error', text:"กรุณาระบุชื่อผู้รับของ"}); return; }

    setSaving(true); setMsg(null);
    try {
      const body = {
        po: po || undefined,
        receiverName: receiverName.trim(),
        receiveDate: receiveDate ? new Date(receiveDate).toISOString() : undefined,
        items: validRows.map(it => {
            const product = products.find(p => p._id === it.productId);
            const variant = product?.variants.find(v => v._id === it.variantId);
            return {
                product: it.productId,
                variantId: it.variantId || undefined,
                size: variant?.size || "", // ส่งไปเผื่อไว้
                color: variant?.color || "",
                quantity: Number(it.quantity || 0),
                unitCost: Number(it.unitCost || 0),
            };
        })
      };
      
      await createReceiving(body);
      setOpenCreate(false);
      
      setPo(""); 
      setReceiveDate(new Date().toISOString().split('T')[0]); 
      setItems([{ productId: "", variantId: "", quantity: 1, unitCost: 0 }]);
      
      await load();
      const pos = await listPO();
      setPoList(pos);

      setMsg({type:'success', text: "บันทึกรับเข้าสำเร็จ! (Stock & PO Updated)"});
      setTimeout(()=>setMsg(null), 3000);
    } catch (e:any) {
      console.error(e);
      setMsg({type:'error', text: e?.response?.data?.error || e?.message || "เกิดข้อผิดพลาดในการบันทึก"});
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (id: string, type: "pdf" | "excel") => {
    try {
      setMsg({ type: 'info', text: 'กำลังดาวน์โหลด...' });
      await downloadReceiving(id, type);
      setMsg(null);
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'เกิดข้อผิดพลาดในการดาวน์โหลด' });
    }
  };

  return (
    <Box p={{ xs:2, md:4 }} sx={{ bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary.main">Receiving (Inbound)</Typography>
          <Typography variant="body2" color="text.secondary">บันทึกการรับสินค้าเข้าคลัง และอัปเดต Stock</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} sx={{ borderRadius: 2 }}>รีเฟรช</Button>
          <Button startIcon={<InventoryIcon />} variant="contained" color="secondary" onClick={() => setOpenCreate(true)} sx={{ borderRadius: 2, boxShadow: 2 }}>
            รับสินค้าเข้า
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
        <TextField 
          size="small" 
          placeholder="ค้นหา (เลขเอกสาร / ชื่อผู้รับ)..." 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          fullWidth
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
          sx={{ maxWidth: 400 }}
        />
      </Paper>

      {msg && <Alert severity={msg.type} sx={{ mb: 2, borderRadius: 2 }} onClose={()=>setMsg(null)}>{msg.text}</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: '1px solid #eaeff1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>เลขที่รับเข้า</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>PO Ref.</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>ผู้รับของ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>วันที่รับ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>รายการ</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
            {view.map(r => (
              <TableRow component={motion.tr} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} key={r._id} hover>
                <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>{r.receivingNumber}</TableCell>
                <TableCell>{r.po ? <Chip label={r.po.poNumber || "PO"} size="small" variant="outlined" color="primary" /> : "-"}</TableCell>
                <TableCell>{r.receiverName || "-"}</TableCell>
                <TableCell>{r.receiveDate ? formatDate(r.receiveDate) : "-"}</TableCell>
                <TableCell>{r.items?.length || 0} รายการ</TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Tooltip title="ดูรายละเอียด">
                      <IconButton size="small" color="info" onClick={()=>{ setSelectedReceiving(r); setOpenDetail(true); }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ดาวน์โหลด Excel">
                      <IconButton size="small" color="success" onClick={() => handleExport(r._id, "excel")}>
                        <TableViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            </AnimatePresence>
            {view.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>ไม่พบข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      {/* --- Create Receiving Dialog --- */}
      <Dialog open={openCreate} onClose={()=>setOpenCreate(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ bgcolor: 'secondary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <InventoryIcon /> รับสินค้าเข้า Stock
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              การบันทึกหน้านี้จะทำการ <b>เพิ่มจำนวนสินค้า (Stock)</b> ในระบบทันที
            </Alert>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                 <TextField select label="อ้างอิง PO (Purchase Order)" value={po} onChange={e=>handleSelectPO(e.target.value)} fullWidth>
                  <MenuItem value=""><em>(ไม่มี / ไม่ระบุ)</em></MenuItem>
                  {poList.map(p => (
                    <MenuItem key={p._id} value={p._id}>
                        {p.poNumber} — {p.supplierName} 
                        {p.status === 'RECEIVED' ? ' (ครบแล้ว)' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                 <TextField label="ชื่อผู้รับของ (Receiver)" value={receiverName} onChange={e=>setReceiverName(e.target.value)} fullWidth required />
              </Grid>
              <Grid item xs={12} sm={6}>
                 <TextField label="วันที่รับของ" type="date" InputLabelProps={{ shrink:true }} value={receiveDate} onChange={e=>setReceiveDate(e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 2 }}><Chip label="รายการสินค้าที่รับเข้า" /></Divider>

            {items.map((it, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2, bgcolor: '#fafafa' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    <TextField
                      select label="สินค้า" value={it.productId || ""} onChange={e=>{
                        updateRow(idx, { productId: e.target.value, variantId: "" });
                      }} fullWidth size="small"
                    >
                      <MenuItem value="">— เลือกสินค้า —</MenuItem>
                      {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      select label="Variant" value={it.variantId || ""} onChange={e=>updateRow(idx, { variantId: e.target.value })}
                      fullWidth size="small" disabled={!it.productId}
                    >
                      <MenuItem value="">(ไม่ระบุ)</MenuItem>
                      {variantsOf(it.productId).map(v => (
                        <MenuItem key={v._id} value={v._id}>{v.size} {v.color && `/ ${v.color}`}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField label="จำนวนรับ" type="number" size="small" fullWidth value={it.quantity} onChange={e=>updateRow(idx, { quantity: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={6} sm={1}>
                     <IconButton onClick={()=>removeRow(idx)} color="error"><DeleteOutlineIcon /></IconButton>
                  </Grid>
                </Grid>
              </Paper>
            ))}
            <Button startIcon={<AddBoxIcon />} onClick={addRow} variant="outlined" sx={{ mt: 1, borderStyle: 'dashed' }} fullWidth>เพิ่มรายการ</Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={()=>setOpenCreate(false)}>ยกเลิก</Button>
          <Button onClick={save} variant="contained" color="secondary" size="large" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "ยืนยันรับเข้า"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDetail} onClose={()=>setOpenDetail(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>รายละเอียดการรับ: <b>{selectedReceiving?.receivingNumber}</b></DialogTitle>
        <DialogContent dividers>
          {selectedReceiving && (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#eee' }}>
                  <TableCell>สินค้า</TableCell>
                  <TableCell>Variant</TableCell>
                  <TableCell align="right">จำนวนรับ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedReceiving.items?.map((item: any, i:number) => (
                    <TableRow key={i}>
                        <TableCell>{getProductName(item)}</TableCell>
                        <TableCell>{item.size} {item.color}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>+{item.quantity}</TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenDetail(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}