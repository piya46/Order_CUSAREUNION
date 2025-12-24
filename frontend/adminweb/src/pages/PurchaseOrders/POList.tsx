// src/pages/POList.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, IconButton, Alert
} from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import { listPO, createPO, exportPOUrl, listInventory, type PO, type Product, type Variant } from "../../api/admin";

type NewItem = { productId: string; variantId?: string; quantity: number; unitPrice?: number };

export default function POList() {
  const [rows, setRows] = useState<PO[] | null>(null);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState<string>("");
  const [expectedReceiveDate, setExpectedReceiveDate] = useState<string>("");
  const [items, setItems] = useState<NewItem[]>([{ productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);

  const [products, setProducts] = useState<Product[]>([]);

  const load = async () => {
    try {
      const data = await listPO();
      setRows(data);
    } catch {
      setRows([]);
    }
  };
  useEffect(()=>{ load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const inv = await listInventory();
        setProducts(inv);
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  const view = useMemo(() => {
    const list = rows || [];
    if (!q) return list;
    const qq = q.toLowerCase();
    return list.filter(p => p.poNumber.toLowerCase().includes(qq) || (p.supplierName||"").toLowerCase().includes(qq));
  }, [rows, q]);

  const addRow = () => setItems(s => [...s, { productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);
  const removeRow = (idx: number) => setItems(s => s.filter((_,i)=>i!==idx));

  const updateRow = (idx: number, patch: Partial<NewItem>) => setItems(s => {
    const d = [...s]; d[idx] = { ...d[idx], ...patch }; return d;
  });

  const variantsOf = (pid: string): Variant[] => (products.find(p => p._id === pid)?.variants || []);

  const totalAmount = useMemo(() => items.reduce((s, it) => s + (Number(it.unitPrice||0) * Number(it.quantity||0)), 0), [items]);

  const save = async () => {
    // basic validate
    if (!supplierName.trim()) { setMsg("กรุณากรอกชื่อซัพพลายเออร์"); return; }
    const validRows = items.filter(it => it.productId && Number(it.quantity) > 0);
    if (!validRows.length) { setMsg("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 แถว"); return; }

    setSaving(true); setMsg(null);
    try {
      const body = {
        supplierName: supplierName.trim(),
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        expectedReceiveDate: expectedReceiveDate ? new Date(expectedReceiveDate).toISOString() : undefined,
        items: validRows.map(it => ({
          productId: it.productId,
          variantId: it.variantId || undefined,
          quantity: Number(it.quantity || 0),
          unitPrice: Number(it.unitPrice || 0)
        }))
      };
      await createPO(body);
      setOpen(false);
      setSupplierName(""); setOrderDate(""); setExpectedReceiveDate(""); setItems([{ productId: "", variantId: "", quantity: 1, unitPrice: 0 }]);
      await load();
      setMsg("สร้าง PO สำเร็จ");
    } catch (e:any) {
      setMsg(e?.message || "สร้าง PO ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openExport = (id: string, type: "pdf" | "excel") => {
    const url = exportPOUrl(id, type);
    window.open(url, "_blank");
  };

  return (
    <Box p={{ xs:2, md:3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Typography variant="h5" fontWeight={900}>Purchase Orders</Typography>
          <Button startIcon={<AddBoxIcon />} variant="contained" onClick={() => setOpen(true)}>สร้าง PO</Button>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>รีเฟรช</Button>
        </Stack>
        <TextField size="small" placeholder="ค้นหา (เลข/ซัพพลายเออร์)" value={q} onChange={e=>setQ(e.target.value)} />
      </Stack>

      {msg && <Alert sx={{ mb: 1.5 }} severity="info">{msg}</Alert>}

      <Paper elevation={3} sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>เลข PO</TableCell>
              <TableCell>ซัพพลายเออร์</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell>สั่งเมื่อ</TableCell>
              <TableCell>คาดรับ</TableCell>
              <TableCell align="right">ยอดรวม</TableCell>
              <TableCell width={160}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.map(p => (
              <TableRow key={p._id} hover>
                <TableCell>{p.poNumber}</TableCell>
                <TableCell>{p.supplierName || "-"}</TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell>{p.orderDate ? new Date(p.orderDate).toLocaleDateString("th-TH") : "-"}</TableCell>
                <TableCell>{p.expectedReceiveDate ? new Date(p.expectedReceiveDate).toLocaleDateString("th-TH") : "-"}</TableCell>
                <TableCell align="right">{(p.totalAmount||0).toLocaleString()} บาท</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={()=>openExport(p._id, "pdf")}>PDF</Button>
                    <Button size="small" variant="outlined" onClick={()=>openExport(p._id, "excel")}>Excel</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow><TableCell colSpan={7}><Box p={2}><Typography color="text.secondary">ไม่พบข้อมูล</Typography></Box></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create PO dialog */}
      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>สร้าง PO ใหม่</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: .5 }}>
            <TextField label="ซัพพลายเออร์" value={supplierName} onChange={e=>setSupplierName(e.target.value)} />
            <Stack direction={{ xs:"column", md:"row" }} spacing={1}>
              <TextField label="วันที่สั่ง" type="date" InputLabelProps={{ shrink: true }} value={orderDate} onChange={e=>setOrderDate(e.target.value)} fullWidth />
              <TextField label="คาดรับ" type="date" InputLabelProps={{ shrink: true }} value={expectedReceiveDate} onChange={e=>setExpectedReceiveDate(e.target.value)} fullWidth />
            </Stack>

            <Typography fontWeight={800} sx={{ mt: 1 }}>รายการ</Typography>
            {items.map((it, idx) => (
              <Stack key={idx} direction={{ xs:"column", md:"row" }} spacing={1} alignItems="center">
                <TextField
                  select label="สินค้า" value={it.productId} onChange={e=>{
                    const pid = e.target.value;
                    updateRow(idx, { productId: pid, variantId: "" });
                  }} sx={{ minWidth: 240 }}
                >
                  <MenuItem value="">— เลือกสินค้า —</MenuItem>
                  {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                </TextField>
                <TextField
                  select label="ตัวเลือก (Variant)" value={it.variantId || ""} onChange={e=>updateRow(idx, { variantId: e.target.value })}
                  sx={{ minWidth: 220 }}
                  disabled={!it.productId}
                >
                  <MenuItem value="">(ไม่ระบุ)</MenuItem>
                  {variantsOf(it.productId).map(v => (
                    <MenuItem key={v._id || `${v.size}-${v.color||'-'}`} value={v._id || `${v.size}|${v.color||'-'}`}>
                      {v.size}{v.color ? ` / ${v.color}` : ""} — ฿{(v.price||0).toLocaleString()}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="จำนวน" type="number" sx={{ width: 130 }} value={it.quantity} onChange={e=>updateRow(idx, { quantity: Number(e.target.value||0) })} />
                <TextField label="ราคาต่อหน่วย" type="number" sx={{ width: 160 }} value={it.unitPrice ?? 0} onChange={e=>updateRow(idx, { unitPrice: Number(e.target.value||0) })} />
                <IconButton onClick={()=>removeRow(idx)} color="error"><DeleteIcon /></IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddBoxIcon />} onClick={addRow} variant="outlined">เพิ่มแถว</Button>

            <Alert severity="info">ยอดรวมโดยประมาณ: <b>{totalAmount.toLocaleString()} บาท</b></Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpen(false)}>ยกเลิก</Button>
          <Button onClick={save} variant="contained" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}