import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, Button, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Chip, IconButton, Alert
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";

const API = import.meta.env.VITE_API_URL || "/api";
const token = () => localStorage.getItem("aw_token") || "";

type Role = { _id: string; name: string };
type User = {
  _id: string;
  username: string;
  name?: string;
  email?: string;
  roles: (string | Role)[];
  createdAt: string;
};

export default function Users() {
  const [rows, setRows] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [formId, setFormId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");   // ใส่เมื่อสร้าง/เปลี่ยนรหัส
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const load = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API}/roles`, { headers: { Authorization: `Bearer ${token()}` } })
      ]);
      const [u, r] = await Promise.all([uRes.json(), rRes.json()]);
      setRows(Array.isArray(u) ? u : []);
      setRoles(Array.isArray(r) ? r : []);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setFormId(null);
    setUsername(""); setPassword("");
    setName(""); setEmail(""); setRoleIds([]);
    setOpen(true);
    setMsg(null);
  };

  const startEdit = (u: User) => {
    setFormId(u._id);
    setUsername(u.username);
    setPassword("");
    setName(u.name || "");
    setEmail(u.email || "");
    const ids = (u.roles || []).map((r:any)=> typeof r === "string" ? r : r._id);
    setRoleIds(ids);
    setOpen(true);
    setMsg(null);
  };

  const save = async () => {
    setMsg(null);
    try {
      const body: any = formId
        ? { name, email, roles: roleIds, ...(password ? { password } : {}) }
        : { username, password, name, email, roles: roleIds };

      const res = await fetch(formId ? `${API}/users/${formId}` : `${API}/users`, {
        method: formId ? "PUT" : "POST",
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

  const remove = async (u: User) => {
    if (!confirm(`ลบผู้ใช้ ${u.username}?`)) return;
    setMsg(null);
    try {
      const res = await fetch(`${API}/users/${u._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "delete failed");
      await load();
      setMsg("ลบสำเร็จ");
    } catch (e:any) {
      setMsg(e?.message || "ลบไม่สำเร็จ");
    }
  };

  const view = useMemo(() => {
    const list = rows || [];
    if (!q) return list;
    const qq = q.toLowerCase();
    return list.filter(u =>
      u.username.toLowerCase().includes(qq) ||
      (u.name || "").toLowerCase().includes(qq) ||
      (u.email || "").toLowerCase().includes(qq)
    );
  }, [rows, q]);

  return (
    <Box p={{ xs:2, md:3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={900}>ผู้ใช้ระบบ</Typography>
        <Stack direction="row" spacing={1}>
          <TextField size="small" placeholder="ค้นหา" value={q} onChange={e=>setQ(e.target.value)} />
          <Button variant="contained" onClick={startCreate}>+ ผู้ใช้</Button>
        </Stack>
      </Stack>

      {msg && <Alert sx={{ mb: 1.5 }} severity="info">{msg}</Alert>}

      <Paper elevation={3} sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>ชื่อ</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell width={110}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.map(u => (
              <TableRow key={u._id} hover>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.name || "-"}</TableCell>
                <TableCell>{u.email || "-"}</TableCell>
                <TableCell>
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {(u.roles || []).map((r:any, i:number) => {
                      const label = typeof r === "string" ? r : r.name;
                      return <Chip size="small" key={i} label={label} />;
                    })}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={()=>startEdit(u)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={()=>remove(u)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow><TableCell colSpan={5}><Box p={2}><Typography color="text.secondary">ไม่พบข้อมูล</Typography></Box></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* dialog */}
      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{formId ? "แก้ไขผู้ใช้" : "สร้างผู้ใช้"}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.2}>
            {!formId && (
              <TextField label="Username" value={username} onChange={e=>setUsername(e.target.value)} required />
            )}
            <TextField label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={formId ? "เว้นว่างถ้าไม่เปลี่ยน" : ""} />
            <TextField label="ชื่อ" value={name} onChange={e=>setName(e.target.value)} />
            <TextField label="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <TextField
              label="Roles"
              select
              SelectProps={{ multiple: true }}
              value={roleIds}
              onChange={(e:any)=>setRoleIds(e.target.value)}
            >
              {roles.map(r => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
            </TextField>
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