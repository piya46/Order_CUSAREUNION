import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, Button, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Alert, Chip
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const API = import.meta.env.VITE_API_URL || "/api";
const token = () => localStorage.getItem("aw_token") || "";

type Role = { _id: string; code?: string; name: string; description?: string; permissions: string[] };

export default function Roles() {
  const [rows, setRows] = useState<Role[] | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [perms, setPerms] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${API}/roles`, { headers: { Authorization: `Bearer ${token()}` }});
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
    return list.filter(r => r.name.toLowerCase().includes(qq) || (r.description||"").toLowerCase().includes(qq));
  }, [rows, q]);

  const startCreate = () => {
    setId(null); setName(""); setDesc(""); setPerms("");
    setOpen(true); setMsg(null);
  };
  const startEdit = (r: Role) => {
    setId(r._id); setName(r.name); setDesc(r.description || ""); setPerms((r.permissions||[]).join(","));
    setOpen(true); setMsg(null);
  };

  const save = async () => {
    const body: any = { name, description: desc, permissions: perms.split(",").map(s=>s.trim()).filter(Boolean) };
    setMsg(null);
    try {
      const res = await fetch(id ? `${API}/roles/${id}` : `${API}/roles`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "save failed");
      setOpen(false);
      await load();
      setMsg("บันทึกสำเร็จ");
    } catch (e:any) {
      setMsg(e?.message || "บันทึกไม่สำเร็จ");
    }
  };

  const remove = async (r: Role) => {
    if (!confirm(`ลบ role ${r.name}?`)) return;
    setMsg(null);
    try {
      const res = await fetch(`${API}/roles/${r._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` }});
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
        <Typography variant="h5" fontWeight={900}>สิทธิ์/บทบาท (Roles)</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" placeholder="ค้นหา" value={q} onChange={e=>setQ(e.target.value)} />
          <Button variant="contained" onClick={startCreate}>+ Role</Button>
        </Stack>
      </Stack>

      {msg && <Alert sx={{ mb: 1.5 }} severity="info">{msg}</Alert>}

      <Paper elevation={3} sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ชื่อ</TableCell>
              <TableCell>คำอธิบาย</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell width={100}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.map(r => (
              <TableRow key={r._id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.description || "-"}</TableCell>
                <TableCell>
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {(r.permissions || []).map((p, i) => <Chip key={i} size="small" label={p} />)}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={()=>startEdit(r)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={()=>remove(r)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow><TableCell colSpan={4}><Box p={2}><Typography color="text.secondary">ไม่พบข้อมูล</Typography></Box></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{id ? "แก้ไข Role" : "สร้าง Role"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.2}>
            <TextField label="ชื่อ" value={name} onChange={e=>setName(e.target.value)} required />
            <TextField label="คำอธิบาย" value={desc} onChange={e=>setDesc(e.target.value)} />
            <TextField label="Permissions (comma-separated)" value={perms} onChange={e=>setPerms(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={save}>บันทึก</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}