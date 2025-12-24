// src/pages/Roles/Roles.tsx
import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Button, Table, TableRow, TableCell, TableBody, TableHead,
  Checkbox, FormControlLabel, Dialog, TextField, Stack, Chip, Grid, IconButton,
  Tooltip, Alert, CircularProgress, Card, CardContent, Divider, alpha
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

// Icons
import SecurityIcon from "@mui/icons-material/Security";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VpnKeyIcon from "@mui/icons-material/VpnKey";

const API = import.meta.env.VITE_API_URL || "/api";

// --- Config: Permission Groups ตามที่ Backend & SideNav ใช้งาน ---
// อ้างอิง Key จาก SideNav.tsx (เช่น order:manage, product:manage)
const PERMISSION_GROUPS = [
  {
    category: "📦 การจัดการคำสั่งซื้อ (Orders)",
    color: "primary",
    items: [
      { id: "order:manage", label: "จัดการออเดอร์ (ดู/แก้ไข/เปลี่ยนสถานะ)" },
    ]
  },
  {
    category: "🛍️ สินค้าและคลัง (Product & Stock)",
    color: "secondary",
    items: [
      { id: "product:manage", label: "จัดการสินค้า (เพิ่ม/ลบ/แก้ไข/สต็อก)" },
    ]
  },
  {
    category: "🛒 จัดซื้อและซัพพลายเออร์ (Purchasing)",
    color: "info",
    items: [
      { id: "po:manage", label: "จัดการใบสั่งซื้อ (PO) & ผู้ขาย (Supplier)" },
      { id: "receiving:manage", label: "จัดการรับสินค้าเข้า (Receiving)" },
    ]
  },
  {
    category: "🔧 ผู้ดูแลระบบ (Administration)",
    color: "error",
    items: [
      { id: "user:manage", label: "จัดการผู้ใช้งาน (Users)" },
      { id: "role:manage", label: "จัดการสิทธิ์ (Roles)" },
      { id: "audit:manage", label: "ดูประวัติการใช้งาน (Audit Logs)" },
    ]
  },
  {
    category: "🆘 บริการและช่วยเหลือ (Support)",
    color: "warning",
    items: [
      { id: "issue:manage", label: "จัดการรายการแจ้งปัญหา (Issues)" },
    ]
  }
];

export default function Roles() {
  const theme = useTheme();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState<{ _id?: string, name: string, permissions: string[] }>({ name: "", permissions: [] });

  // Load Roles
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/roles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` }
      });
      if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Handle Permission Toggle
  const togglePerm = (p: string) => {
    setForm(prev => {
      const exists = prev.permissions.includes(p);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter(x => x !== p)
          : [...prev.permissions, p]
      };
    });
  };

  // Toggle All in Category
  const toggleCategory = (categoryItems: { id: string }[]) => {
    const ids = categoryItems.map(i => i.id);
    const allSelected = ids.every(id => form.permissions.includes(id));

    setForm(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !ids.includes(p)) // Uncheck all
        : Array.from(new Set([...prev.permissions, ...ids])) // Check all
    }));
  };

  // Save Role
  const save = async () => {
    if (!form.name.trim()) return setError("กรุณากรอกชื่อ Role");
    // ไม่บังคับ permissions เพราะบาง Role อาจแค่ดูได้อย่างเดียว (หรือรอแก้ไข)
    
    setSaving(true);
    setError(null);
    try {
      const method = form._id ? "PUT" : "POST";
      const url = form._id ? `${API}/roles/${form._id}` : `${API}/roles`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("aw_token")}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Role
  const handleDelete = async (id: string) => {
    if(!confirm("ยืนยันการลบ Role นี้? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
    try {
        const res = await fetch(`${API}/roles/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` }
        });
        if (!res.ok) throw new Error("ลบไม่สำเร็จ");
        load();
    } catch (e: any) {
        alert(e.message);
    }
  };

  const openCreate = () => {
    setForm({ name: "", permissions: [] });
    setError(null);
    setOpen(true);
  };

  const openEdit = (role: any) => {
    setForm({ _id: role._id, name: role.name, permissions: role.permissions || [] });
    setError(null);
    setOpen(true);
  };

  return (
    <Box>
      {/* Header Section */}
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
            <SecurityIcon fontSize="large" />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: -0.5 }}>
              บทบาท & สิทธิ์
            </Typography>
            <Typography variant="body2" color="text.secondary">
              กำหนดสิทธิ์การเข้าถึงเมนูและการจัดการข้อมูลในระบบ
            </Typography>
          </Box>
        </Stack>

        <Button
          variant="contained"
          size="large"
          startIcon={<AddCircleIcon />}
          onClick={openCreate}
          sx={{ borderRadius: 3, px: 3, py: 1.2, fontWeight: 800, boxShadow: theme.shadows[4] }}
        >
          สร้าง Role ใหม่
        </Button>
      </Stack>

      {/* Roles List */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800, py: 2, width: '25%' }}>ชื่อบทบาท (Role Name)</TableCell>
              <TableCell sx={{ fontWeight: 800, py: 2 }}>สิทธิ์การใช้งาน (Permissions)</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, py: 2, width: '15%' }}>จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
            ) : roles.length === 0 ? (
               <TableRow><TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.secondary" }}>ไม่พบข้อมูล</TableCell></TableRow>
            ) : (
              roles.map(r => (
                <TableRow key={r._id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell valign="top">
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{mt:0.5}}>
                       <AdminPanelSettingsIcon color="action" />
                       <Box>
                           <Typography fontWeight={700} variant="body1">{r.name}</Typography>
                           <Typography variant="caption" color="text.secondary">ID: {r.code || r._id.slice(-6)}</Typography>
                       </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {(!r.permissions || r.permissions.length === 0) ? (
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">ไม่มีสิทธิ์พิเศษ (Access Forbidden)</Typography>
                    ) : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                        {r.permissions.map((p: string) => {
                            // Find category color
                            const group = PERMISSION_GROUPS.find(g => g.items.some(i => i.id === p));
                            const label = group?.items.find(i=>i.id===p)?.label || p;
                            return (
                            <Chip
                                key={p}
                                label={label}
                                size="small"
                                color={group?.color as any || "default"}
                                icon={<VpnKeyIcon style={{fontSize: 12}} />}
                                variant="outlined"
                                sx={{ 
                                    fontWeight: 600, 
                                    bgcolor: alpha(theme.palette[group?.color as any || "primary"].main, 0.05),
                                    borderColor: alpha(theme.palette[group?.color as any || "primary"].main, 0.3)
                                }}
                            />
                            );
                        })}
                        </Stack>
                    )}
                  </TableCell>
                  <TableCell align="right" valign="top">
                    <Stack direction="row" justifyContent="flex-end">
                        <Tooltip title="แก้ไข">
                        <IconButton color="primary" onClick={()=>openEdit(r)}>
                            <EditIcon />
                        </IconButton>
                        </Tooltip>
                        <Tooltip title="ลบ">
                        <IconButton color="error" onClick={()=>handleDelete(r._id)}>
                            <DeleteIcon />
                        </IconButton>
                        </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        fullWidth 
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <Box sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#FAFAFA" }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'primary.main', color: 'white' }}>
                    {form._id ? <EditIcon /> : <AddCircleIcon />}
                </Box>
                <Typography variant="h6" fontWeight={800}>
                    {form._id ? "แก้ไขบทบาท" : "สร้างบทบาทใหม่"}
                </Typography>
            </Stack>
        </Box>
        
        <Box sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
          
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="ชื่อบทบาท (Role Name)"
              placeholder="เช่น ผู้จัดการร้าน, พนักงานสต็อก, บัญชี"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              InputProps={{ sx: { borderRadius: 2 } }}
              autoFocus
            />

            <Box>
                <Typography variant="subtitle1" fontWeight={800} mb={1.5}>กำหนดสิทธิ์การใช้งาน (Permissions)</Typography>
                <Grid container spacing={2}>
                    {PERMISSION_GROUPS.map((group) => {
                        const allChecked = group.items.every(i => form.permissions.includes(i.id));
                        const someChecked = group.items.some(i => form.permissions.includes(i.id));
                        
                        return (
                            <Grid item xs={12} md={6} key={group.category}>
                                <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', borderColor: alpha(theme.palette[group.color as any].main, 0.3) }}>
                                    <Box 
                                        sx={{ 
                                            px: 2, py: 1.5, 
                                            bgcolor: alpha(theme.palette[group.color as any].main, 0.1),
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                    >
                                        <Typography variant="subtitle2" fontWeight={800} color={`${group.color}.main`}>
                                            {group.category}
                                        </Typography>
                                        <FormControlLabel
                                            label={<Typography variant="caption" fontWeight={600}>เลือกทั้งหมด</Typography>}
                                            control={
                                                <Checkbox 
                                                    size="small" 
                                                    checked={allChecked}
                                                    indeterminate={!allChecked && someChecked}
                                                    onChange={() => toggleCategory(group.items)}
                                                    color={group.color as any}
                                                />
                                            }
                                        />
                                    </Box>
                                    <Divider />
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Stack spacing={0.5}>
                                            {group.items.map(perm => (
                                                <FormControlLabel
                                                    key={perm.id}
                                                    control={
                                                        <Checkbox 
                                                            checked={form.permissions.includes(perm.id)} 
                                                            onChange={() => togglePerm(perm.id)}
                                                            color={group.color as any}
                                                            size="small"
                                                        />
                                                    }
                                                    label={<Typography variant="body2">{perm.label}</Typography>}
                                                    sx={{ ml: 0.5, mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.9rem' } }}
                                                />
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button onClick={() => setOpen(false)} sx={{ borderRadius: 2, color: 'text.secondary', fontWeight: 600 }}>ยกเลิก</Button>
          <Button 
            variant="contained" 
            onClick={save} 
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}