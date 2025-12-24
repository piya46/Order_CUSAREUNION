// src/pages/Suppliers/SupplierList.tsx
import { useEffect, useState, useMemo } from "react";
import {
  Box, Paper, Typography, Stack, Button, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, InputAdornment, Tooltip, Avatar, alpha, useTheme, Fade, Grid
} from "@mui/material";

// Icons
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import StoreIcon from '@mui/icons-material/Store';
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BadgeIcon from '@mui/icons-material/Badge';
import SaveIcon from '@mui/icons-material/Save';

// API
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from "../../api/admin";

// Helper: Generate color from string
const stringToColor = (string: string) => {
  let hash = 0;
  for (let i = 0; i < string.length; i++) hash = string.charCodeAt(i) + ((hash << 5) - hash);
  let color = '#';
  for (let i = 0; i < 3; i++) color += `00${((hash >> (i * 8)) & 0xff).toString(16)}`.slice(-2);
  return color;
};

export default function SupplierList() {
  const theme = useTheme();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({});
  const [saving, setSaving] = useState(false);
  
  const [msg, setMsg] = useState<{ type: 'success'|'error', text: string } | null>(null);

  // Load Data
  const load = async () => {
    setLoading(true);
    try {
      const data = await listSuppliers();
      setRows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter
  const view = useMemo(() => {
    if (!q) return rows;
    const lowerQ = q.toLowerCase();
    return rows.filter(s => 
      s.name.toLowerCase().includes(lowerQ) || 
      (s.contactPerson || "").toLowerCase().includes(lowerQ) ||
      (s.phone || "").includes(lowerQ)
    );
  }, [rows, q]);

  // Actions
  const handleOpenCreate = () => {
    setIsEdit(false);
    setFormData({ name: "", contactPerson: "", phone: "", email: "", address: "", taxId: "" });
    setOpenDialog(true);
    setMsg(null);
  };

  const handleOpenEdit = (item: Supplier) => {
    setIsEdit(true);
    setFormData({ ...item });
    setOpenDialog(true);
    setMsg(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("⚠️ ยืนยันการลบ Supplier นี้? \n(ข้อมูลใน PO เก่าจะยังคงอยู่ แต่จะไม่สามารถเลือก Supplier นี้ใน PO ใหม่ได้)")) return;
    try {
      await deleteSupplier(id);
      setMsg({ type: "success", text: "ลบข้อมูลสำเร็จ" });
      load();
    } catch (e) {
      setMsg({ type: "error", text: "เกิดข้อผิดพลาดในการลบ" });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      setMsg({ type: "error", text: "กรุณากรอกชื่อร้านค้า/บริษัท" });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && formData._id) {
        await updateSupplier(formData._id, formData);
        setMsg({ type: "success", text: "แก้ไขข้อมูลสำเร็จ" });
      } else {
        await createSupplier(formData);
        setMsg({ type: "success", text: "เพิ่ม Supplier สำเร็จ" });
      }
      setOpenDialog(false);
      load();
    } catch (e) {
      setMsg({ type: "error", text: "บันทึกข้อมูลไม่สำเร็จ" });
    } finally {
        setSaving(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
            <Box p={1.5} borderRadius={3} bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main">
                <StoreIcon fontSize="large" />
            </Box>
            <Box>
                <Typography variant="h4" fontWeight={900}>ผู้ขาย (Suppliers)</Typography>
                <Typography variant="body2" color="text.secondary">จัดการรายชื่อคู่ค้าและข้อมูลการติดต่อ</Typography>
            </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} sx={{ borderRadius: 2 }}>
            รีเฟรช
          </Button>
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" onClick={handleOpenCreate} sx={{ borderRadius: 2, fontWeight: 700 }}>
            เพิ่ม Supplier
          </Button>
        </Stack>
      </Stack>

      {/* Search & Alert */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <TextField 
          size="small" 
          placeholder="ค้นหาชื่อร้าน, ผู้ติดต่อ, เบอร์โทร..." 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          fullWidth
          InputProps={{ 
              startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
              sx: { borderRadius: 2 }
          }}
        />
      </Paper>

      {msg && (
        <Alert severity={msg.type} onClose={()=>setMsg(null)} sx={{ mb: 3, borderRadius: 2 }}>
          {msg.text}
        </Alert>
      )}

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#FAFAFA' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>ชื่อร้านค้า / บริษัท</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>ผู้ติดต่อ</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>การติดต่อ</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Tax ID</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
              {view.length === 0 && !loading ? (
                 <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่พบข้อมูล Supplier</TableCell></TableRow>
              ) : (
                  view.map((row) => (
                    <Fade in timeout={300} key={row._id}>
                        <TableRow hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                                <Avatar 
                                    sx={{ 
                                        bgcolor: stringToColor(row.name), 
                                        fontWeight: 700,
                                        width: 40, height: 40,
                                        fontSize: '1rem'
                                    }}
                                >
                                    {row.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                    <Typography variant="subtitle2" fontWeight={700}>{row.name}</Typography>
                                    {row.address && (
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <LocationOnIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>{row.address}</Typography>
                                        </Stack>
                                    )}
                                </Box>
                            </Stack>
                        </TableCell>
                        <TableCell>
                             {row.contactPerson ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <BadgeIcon sx={{ fontSize: 16, color: 'action.active' }} />
                                    <Typography variant="body2">{row.contactPerson}</Typography>
                                </Stack>
                             ) : "-"}
                        </TableCell>
                        <TableCell>
                            <Stack spacing={0.5}>
                                {row.phone && (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <LocalPhoneIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                        <Typography variant="body2">{row.phone}</Typography>
                                    </Stack>
                                )}
                                {row.email && (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <EmailIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                                        <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                                    </Stack>
                                )}
                                {!row.phone && !row.email && "-"}
                            </Stack>
                        </TableCell>
                        <TableCell>{row.taxId ? <Chip label={row.taxId} size="small" variant="outlined" sx={{ borderRadius: 1 }} /> : "-"}</TableCell>
                        <TableCell align="right">
                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                <Tooltip title="แก้ไข">
                                    <IconButton size="small" onClick={()=>handleOpenEdit(row)} color="primary"><EditIcon fontSize="small" /></IconButton>
                                </Tooltip>
                                <Tooltip title="ลบ">
                                    <IconButton size="small" onClick={()=>handleDelete(row._id)} sx={{ color: theme.palette.error.main }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                                </Tooltip>
                            </Stack>
                        </TableCell>
                        </TableRow>
                    </Fade>
                  ))
              )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={()=>setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2, bgcolor: '#FAFAFA' }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'primary.main', color: 'white' }}>
                    {isEdit ? <EditIcon /> : <StoreIcon />}
                </Box>
                <Typography variant="h6" fontWeight={800}>
                    {isEdit ? "แก้ไขข้อมูล Supplier" : "เพิ่ม Supplier ใหม่"}
                </Typography>
            </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField 
                label="ชื่อร้านค้า / บริษัท (จำเป็น)" 
                value={formData.name || ""} onChange={e=>setFormData({...formData, name: e.target.value})} 
                fullWidth required autoFocus 
                InputProps={{ sx: { borderRadius: 2 } }}
            />
            
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField 
                        fullWidth label="ชื่อผู้ติดต่อ" 
                        value={formData.contactPerson || ""} onChange={e=>setFormData({...formData, contactPerson: e.target.value})} 
                        InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon fontSize="small" color="action"/></InputAdornment>, sx: { borderRadius: 2 } }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField 
                        fullWidth label="เลขผู้เสียภาษี (Tax ID)" 
                        value={formData.taxId || ""} onChange={e=>setFormData({...formData, taxId: e.target.value})} 
                        InputProps={{ sx: { borderRadius: 2 } }}
                    />
                </Grid>
            </Grid>

            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" mb={1} display="block">ข้อมูลการติดต่อ</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField 
                            fullWidth label="เบอร์โทรศัพท์" 
                            value={formData.phone || ""} onChange={e=>setFormData({...formData, phone: e.target.value})} 
                            InputProps={{ startAdornment: <InputAdornment position="start"><LocalPhoneIcon fontSize="small" color="action"/></InputAdornment>, sx: { borderRadius: 2 } }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField 
                            fullWidth label="Email" 
                            value={formData.email || ""} onChange={e=>setFormData({...formData, email: e.target.value})} 
                            InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" color="action"/></InputAdornment>, sx: { borderRadius: 2 } }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField 
                            label="ที่อยู่ (Address)" 
                            value={formData.address || ""} onChange={e=>setFormData({...formData, address: e.target.value})} 
                            fullWidth multiline rows={2} 
                            InputProps={{ sx: { borderRadius: 2 } }}
                        />
                    </Grid>
                </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={()=>setOpenDialog(false)} color="inherit" sx={{ borderRadius: 2 }}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving} startIcon={<SaveIcon />} sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}>
             {saving ? "กำลังบันทึก..." : (isEdit ? "บันทึกการแก้ไข" : "ยืนยันการเพิ่ม")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}