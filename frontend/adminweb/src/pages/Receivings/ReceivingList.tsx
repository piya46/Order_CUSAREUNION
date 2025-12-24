// src/pages/ReceivingList.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, IconButton, Alert
} from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  listReceiving, createReceiving, exportReceivingUrl,
  listPO, listInventory,
  type Receiving, type PO, type Product, type Variant
} from "../../api/admin";

type NewItem = { productId: string; variantId?: string; quantity: number; unitCost?: number };

export default function ReceivingList() {
  const [rows, setRows] = useState<Receiving[] | null>(null);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form state
  const [po, setPo] = useState<string>("");
  const [receiverName, setReceiverName] = useState<string>("");
  const [receiveDate, setReceiveDate] = useState<string>("");
  const [items, setItems] = useState<NewItem[]>([{ productId: "", variantId: "", quantity: 1, unitCost: 0 }]);

  const [poList, setPoList] = useState<PO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const load = async () => {
    try {
      const data = await listReceiving();
      setRows(data);
    } catch {
      setRows([]);
    }
  };
  useEffect(()=>{ load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [pos, inv] = await Promise.all([listPO(), listInventory()]);
        setPoList(pos);
        setProducts(inv);
      } catch {
        setPoList([]); setProducts([]);
      }
    })();
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

  const save = async () => {
    const validRows = items.filter(it => it.productId && Number(it.quantity) > 0);
    if (!validRows.length) { setMsg("กรุณาเพิ่มรายการรับเข้าอย่างน้อย 1 แถว"); return; }
    if (!receiverName.trim()) { setMsg("กรุณากรอกชื่อผู้รับ"); return; }

    setSaving(true); setMsg(null);
    try {
      const body = {
        po: po || undefined,
        receiverName: receiverName.trim(),
        receiveDate: receiveDate ? new Date(receiveDate).toISOString() : undefined,
        items: validRows.map(it => ({
          productId: it.productId,
          variantId: it.variantId || undefined,
          quantity: Number(it.quantity || 0),
          unitCost: Number(it.unitCost || 0),
        }))
      };
      await createReceiving(body);
      // สมมติหลังบ้านอัปเดตสต๊อกให้ถูกต้องแล้ว
      setOpen(false);
      setPo(""); setReceiverName(""); setReceiveDate(""); setItems([{ productId: "", variantId: "", quantity: 1, unitCost: 0 }]);
      await load();
      setMsg("บันทึกรับสินค้าเรียบร้อย (สต๊อกอัปเดตแล้ว)");
    } catch (e:any) {
      setMsg(e?.message || "บันทึกรับสินค้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openExport = (id: string, type: "pdf" | "excel") => {
    const url = exportReceivingUrl(id, type);
    window.open(url, "_blank");
  };

  return (
    <Box p={{ xs:2, md:3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Typography variant="h5" fontWeight={900}>Receiving</Typography>
          <Button startIcon={<AddBoxIcon />} variant="contained" onClick={() => setOpen(true)}>บันทึกรับสินค้า</Button>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>รีเฟรช</Button>
        </Stack>
        <TextField size="small" placeholder="ค้นหา (เลข/ผู้รับ)" value={q} onChange={e=>setQ(e.target.value)} />
      </Stack>

      {msg && <Alert sx={{ mb: 1.5 }} severity="info">{msg}</Alert>}

      <Paper elevation={3} sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>เลขรับเข้า</TableCell>
              <TableCell>PO</TableCell>
              <TableCell>ผู้รับ</TableCell>
              <TableCell>วันที่รับ</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell align="right">จำนวนรายการ</TableCell>
              <TableCell width={160}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.map(r => (
              <TableRow key={r._id} hover>
                <TableCell>{r.receivingNumber}</TableCell>
                <TableCell>{r.po || "-"}</TableCell>
                <TableCell>{r.receiverName || "-"}</TableCell>
                <TableCell>{r.receiveDate ? new Date(r.receiveDate).toLocaleDateString("th-TH") : "-"}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell align="right">{r.items?.length || 0}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={()=>openExport(r._id, "pdf")}>PDF</Button>
                    <Button size="small" variant="outlined" onClick={()=>openExport(r._id, "excel")}>Excel</Button>
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

      {/* Create Receiving dialog */}
      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>บันทึกรับสินค้าเข้า</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ mt: .5 }}>
            <TextField select label="อ้างอิง PO (ถ้ามี)" value={po} onChange={e=>setPo(e.target.value)}>
              <MenuItem value="">(ไม่ระบุ)</MenuItem>
              {poList.map(p => <MenuItem key={p._id} value={p._id}>{p.poNumber} — {p.supplierName || "-"}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs:"column", md:"row" }} spacing={1}>
              <TextField label="ผู้รับ" value={receiverName} onChange={e=>setReceiverName(e.target.value)} fullWidth />
              <TextField label="วันที่รับ" type="date" InputLabelProps={{ shrink:true }} value={receiveDate} onChange={e=>setReceiveDate(e.target.value)} fullWidth />
            </Stack>

            <Typography fontWeight={800} sx={{ mt: 1 }}>รายการรับเข้า</Typography>
            {items.map((it, idx) => (
              <Stack key={idx} direction={{ xs:"column", md:"row" }} spacing={1} alignItems="center">
                <TextField
                  select label="สินค้า" value={it.productId} onChange={e=>{
                    const pid = e.target.value;
                    updateRow(idx, { productId: pid, variantId: "" });
                  }} sx={{ minWidth: 260 }}
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
                      {v.size}{v.color ? ` / ${v.color}` : ""} — (฿{(v.price||0).toLocaleString()})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="จำนวนรับ" type="number" sx={{ width: 160 }} value={it.quantity} onChange={e=>updateRow(idx, { quantity: Number(e.target.value||0) })} />
                <TextField label="ต้นทุน/หน่วย (ถ้ามี)" type="number" sx={{ width: 180 }} value={it.unitCost ?? 0} onChange={e=>updateRow(idx, { unitCost: Number(e.target.value||0) })} />
                <IconButton onClick={()=>removeRow(idx)} color="error"><DeleteIcon /></IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddBoxIcon />} onClick={addRow} variant="outlined">เพิ่มแถว</Button>

            <Alert severity="info">เมื่อบันทึกสำเร็จ ระบบจะทำการอัปเดตสต๊อกตามรายการรับเข้าให้อัตโนมัติ</Alert>
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