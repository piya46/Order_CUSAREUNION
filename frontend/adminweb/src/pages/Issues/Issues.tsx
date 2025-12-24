import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Button, Table, TableHead, TableRow,
  TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Alert
} from "@mui/material";

const API = import.meta.env.VITE_API_URL || "/api";
const token = () => localStorage.getItem("aw_token") || "";

type Issue = {
  _id: string;
  issueNumber: string;
  refType: "ORDER" | "RECEIVING" | "PRODUCT";
  refId: string;
  description?: string;
  status: "OPEN" | "PROCESSING" | "RESOLVED" | "REJECTED";
  createdAt: string;
};

const REF_TYPES = ["ORDER","RECEIVING","PRODUCT"] as const;
const STATUSES = ["OPEN","PROCESSING","RESOLVED","REJECTED"] as const;

export default function Issues() {
  const [rows, setRows] = useState<Issue[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [refType, setRefType] = useState<Issue["refType"]>("ORDER");
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<Issue["status"]>("OPEN");

  const load = async () => {
    try {
      const res = await fetch(`${API}/issues`, { headers: { Authorization: `Bearer ${token()}` }});
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
  };
  useEffect(()=>{ load(); }, []);

  const view = useMemo(() => {
    const list = rows || [];
    if (!q) return list;
    const qq = q.toLowerCase();
    return list.filter(i =>
      i.issueNumber.toLowerCase().includes(qq) ||
      (i.description||"").toLowerCase().includes(qq) ||
      (i.refId||"").toLowerCase().includes(qq)
    );
  }, [rows, q]);

  const openCreate = () => {
    setRefType("ORDER"); setRefId(""); setDescription("");
    setOpen(true); setMsg(null);
  };

  const createIssue = async () => {
    setMsg(null);
    try {
      const body = { refType, refId, description };
      const res = await fetch(`${API}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "create failed");
      setOpen(false);
      await load();
      setMsg("สร้าง Issue สำเร็จ");
    } catch (e:any) {
      setMsg(e?.message || "สร้างไม่สำเร็จ");
    }
  };

  const startEditStatus = (i: Issue) => {
    setEditId(i._id);
    setEditStatus(i.status);
  };
  const saveStatus = async () => {
    if (!editId) return;
    setMsg(null);
    try {
      const res = await fetch(`${API}/issues/${editId}`, {
        method: "PUT",
        headers: { "Content-Type":"application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: editStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "update failed");
      setEditId(null);
      await load();
      setMsg("อัปเดตสถานะสำเร็จ");
    } catch (e:any) {
      setMsg(e?.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  const remove = async (i: Issue) => {
    if (!confirm(`ลบ Issue ${i.issueNumber}?`)) return;
    setMsg(null);
    try {
      const res = await fetch(`${API}/issues/${i._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` }});
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "delete failed");
      await load();
      setMsg("ลบสำเร็จ");
    } catch (e:any) {
      setMsg(e?.message || "ลบไม่สำเร็จ");
    }
  };

  return (
    <Box p={{ xs:2, md:3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={900}>Issues</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" placeholder="ค้นหา (เลข/คำอธิบาย/อ้างอิง)" value={q} onChange={e=>setQ(e.target.value)} />
          <Button variant="contained" onClick={openCreate}>+ Issue</Button>
        </Stack>
      </Stack>

      {msg && <Alert sx={{ mb: 1.5 }} severity="info">{msg}</Alert>}

      <Paper elevation={3} sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>เลข Issue</TableCell>
              <TableCell>อ้างอิง</TableCell>
              <TableCell>รายละเอียด</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell width={220}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.map(i => (
              <TableRow key={i._id} hover>
                <TableCell>{i.issueNumber}</TableCell>
                <TableCell>{i.refType} • {i.refId}</TableCell>
                <TableCell>{i.description || "-"}</TableCell>
                <TableCell>{i.status}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <TextField
                      size="small"
                      select
                      value={editId === i._id ? editStatus : i.status}
                      onChange={e=> editId === i._id ? setEditStatus(e.target.value as Issue["status"]) : startEditStatus(i)}
                      onFocus={()=>startEditStatus(i)}
                      sx={{ minWidth: 140 }}
                    >
                      {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    {editId === i._id
                      ? <Button size="small" variant="contained" onClick={saveStatus}>บันทึก</Button>
                      : <Button size="small" color="error" onClick={()=>remove(i)}>ลบ</Button>}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow><TableCell colSpan={5}><Box p={2}><Typography color="text.secondary">ไม่พบข้อมูล</Typography></Box></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>สร้าง Issue</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.2}>
            <TextField label="ประเภทอ้างอิง" select value={refType} onChange={e=>setRefType(e.target.value as any)}>
              {REF_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField label="รหัสอ้างอิง (เช่น _id ของ Order/Receiving/Product)" value={refId} onChange={e=>setRefId(e.target.value)} />
            <TextField label="รายละเอียด" multiline minRows={3} value={description} onChange={e=>setDescription(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={createIssue} disabled={!refId}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}