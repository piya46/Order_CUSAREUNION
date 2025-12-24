// src/pages/Users/Users.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, Button, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Chip, IconButton, Alert, Avatar, InputAdornment,
  CircularProgress, alpha, Grid, Card, Divider
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

// Icons
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SearchIcon from "@mui/icons-material/Search";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import KeyIcon from "@mui/icons-material/Key";
import BadgeIcon from "@mui/icons-material/Badge";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

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

// ฟังก์ชันสร้างสีจากชื่อ (เพื่อให้ Avatar มีสีสันหลากหลาย)
const stringToColor = (string: string) => {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
};

export default function Users() {
  const theme = useTheme();
  const [rows, setRows] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  
  // Dialog State
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [formId, setFormId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
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
    setSaving(true);
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
      if (!res.ok) throw new Error(data?.error || "บันทึกไม่สำเร็จ");
      
      setOpen(false);
      await load();
      setMsg({ type: 'success', text: "บันทึกข้อมูลเรียบร้อยแล้ว" });
    } catch (e:any) {
      setMsg({ type: 'error', text: e?.message || "เกิดข้อผิดพลาดในการบันทึก" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: User) => {
    if (!confirm(`ต้องการลบผู้ใช้ "${u.username}" ใช่หรือไม่?`)) return;
    try {
      const res = await fetch(`${API}/users/${u._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "ลบไม่สำเร็จ");
      
      await load();
      setMsg({ type: 'success', text: "ลบผู้ใช้งานเรียบร้อยแล้ว" });
    } catch (e:any) {
      setMsg({ type: 'error', text: e?.message || "ลบไม่สำเร็จ" });
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
    <Box>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 56, height: 56, borderRadius: "50%",
              display: "grid", placeItems: "center",
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              color: "primary.main"
            }}
          >
            <PeopleAltIcon fontSize="large" />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: -0.5 }}>
              ผู้ใช้งานระบบ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              จัดการบัญชีผู้ใช้และกำหนดสิทธิ์การเข้าถึง
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <TextField 
            size="small" 
            placeholder="ค้นหาชื่อ, Username..." 
            value={q} 
            onChange={e=>setQ(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
              sx: { borderRadius: 3, bgcolor: 'white' }
            }}
            sx={{ flex: 1, minWidth: 240 }}
          />
          <Button 
            variant="contained" 
            startIcon={<PersonAddIcon />}
            onClick={startCreate}
            sx={{ borderRadius: 3, px: 2, whiteSpace: 'nowrap', fontWeight: 800, boxShadow: theme.shadows[3] }}
          >
            เพิ่มผู้ใช้
          </Button>
        </Stack>
      </Stack>

      {msg && <Alert sx={{ mb: 3, borderRadius: 2 }} severity={msg.type} onClose={()=>setMsg(null)}>{msg.text}</Alert>}

      {/* Table */}
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: 4, 
          overflow: "hidden", 
          border: '1px solid', 
          borderColor: 'divider',
          boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
            <TableRow>
              <TableCell sx={{ py: 2, fontWeight: 800 }}>ผู้ใช้งาน</TableCell>
              <TableCell sx={{ py: 2, fontWeight: 800 }}>อีเมล</TableCell>
              <TableCell sx={{ py: 2, fontWeight: 800 }}>สิทธิ์ (Roles)</TableCell>
              <TableCell sx={{ py: 2, fontWeight: 800 }} align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
            ) : view.length === 0 ? (
               <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6, color: "text.secondary" }}>ไม่พบข้อมูลผู้ใช้</TableCell></TableRow>
            ) : (
                view.map(u => {
                    const avatarColor = stringToColor(u.username);
                    const displayName = u.name || u.username;
                    const initial = displayName.charAt(0).toUpperCase();

                    return (
                        <TableRow key={u._id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                            <TableCell>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Avatar sx={{ bgcolor: avatarColor, fontWeight: 700 }}>{initial}</Avatar>
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight={700}>{u.name || "-"}</Typography>
                                        <Typography variant="caption" color="text.secondary">@{u.username}</Typography>
                                    </Box>
                                </Stack>
                            </TableCell>
                            <TableCell>{u.email || <Typography variant="caption" color="text.secondary">-</Typography>}</TableCell>
                            <TableCell>
                                <Stack direction="row" gap={0.8} flexWrap="wrap">
                                    {(u.roles || []).map((r:any, i:number) => {
                                        const label = typeof r === "string" ? r : r.name;
                                        return (
                                            <Chip 
                                                size="small" 
                                                key={i} 
                                                label={label} 
                                                variant="outlined"
                                                sx={{ 
                                                    fontWeight: 600, 
                                                    borderColor: alpha(theme.palette.primary.main, 0.3),
                                                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                                                    color: theme.palette.text.primary
                                                }}
                                            />
                                        );
                                    })}
                                    {!u.roles?.length && <Typography variant="caption" color="text.secondary">-</Typography>}
                                </Stack>
                            </TableCell>
                            <TableCell align="right">
                                <Stack direction="row" justifyContent="flex-end">
                                    <IconButton size="small" onClick={()=>startEdit(u)} color="primary">
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={()=>remove(u)} sx={{ color: theme.palette.error.main }}>
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </TableCell>
                        </TableRow>
                    );
                })
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Dialog */}
      <Dialog 
        open={open} 
        onClose={()=>setOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2, bgcolor: '#FAFAFA' }}>
             <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'primary.main', color: 'white' }}>
                    {formId ? <EditIcon /> : <PersonAddIcon />}
                </Box>
                <Typography variant="h6" fontWeight={800}>
                    {formId ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
                </Typography>
            </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            
            {/* Account Info */}
            <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>ข้อมูลเข้าระบบ</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField 
                            fullWidth 
                            label="Username" 
                            value={username} 
                            onChange={e=>setUsername(e.target.value)} 
                            disabled={!!formId}
                            required
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><AccountCircleIcon color="action" fontSize="small"/></InputAdornment>,
                                sx: { borderRadius: 2 }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                         <TextField 
                            fullWidth 
                            label={formId ? "Password (เว้นว่างถ้าไม่เปลี่ยน)" : "Password"} 
                            type="password" 
                            value={password} 
                            onChange={e=>setPassword(e.target.value)} 
                            required={!formId}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><KeyIcon color="action" fontSize="small"/></InputAdornment>,
                                sx: { borderRadius: 2 }
                            }}
                        />
                    </Grid>
                </Grid>
            </Box>

            <Divider />

            {/* Profile Info */}
            <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>ข้อมูลส่วนตัว</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField 
                            fullWidth 
                            label="ชื่อ-นามสกุล" 
                            value={name} 
                            onChange={e=>setName(e.target.value)} 
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><BadgeIcon color="action" fontSize="small"/></InputAdornment>,
                                sx: { borderRadius: 2 }
                            }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField 
                            fullWidth 
                            label="อีเมล (Email)" 
                            value={email} 
                            onChange={e=>setEmail(e.target.value)} 
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><AlternateEmailIcon color="action" fontSize="small"/></InputAdornment>,
                                sx: { borderRadius: 2 }
                            }}
                        />
                    </Grid>
                </Grid>
            </Box>

            <Divider />

            {/* Roles */}
            <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>สิทธิ์การใช้งาน (Roles)</Typography>
                <TextField
                    fullWidth
                    select
                    label="เลือกบทบาท"
                    SelectProps={{ 
                        multiple: true,
                        renderValue: (selected: any) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((value: string) => {
                                const r = roles.find(role => role._id === value);
                                return <Chip key={value} label={r?.name || value} size="small" sx={{ borderRadius: 1 }} />;
                              })}
                            </Box>
                        )
                    }}
                    value={roleIds}
                    onChange={(e:any)=>setRoleIds(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><AdminPanelSettingsIcon color="action" fontSize="small"/></InputAdornment>,
                        sx: { borderRadius: 2 }
                    }}
                >
                    {roles.map(r => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
                </TextField>
            </Box>

          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#FAFAFA' }}>
          <Button onClick={()=>setOpen(false)} sx={{ color: 'text.secondary', fontWeight: 600 }}>ยกเลิก</Button>
          <Button 
            variant="contained" 
            onClick={save}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}