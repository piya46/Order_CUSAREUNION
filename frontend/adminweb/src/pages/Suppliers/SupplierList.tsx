import { useEffect, useState, useMemo } from "react";
import {
  Box, Paper, Typography, Stack, Button, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Chip, InputAdornment, Tooltip
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import StoreIcon from '@mui/icons-material/Store';

// API
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from "../../api/admin";

export default function SupplierList() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({});
  
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
      (s.contactPerson || "").toLowerCase().includes(lowerQ)
    );
  }, [rows, q]);

  // Actions
  const handleOpenCreate = () => {
    setIsEdit(false);
    setFormData({ name: "", contactPerson: "", phone: "", email: "", address: "", taxId: "" });
    setOpenDialog(true);
  };

  const handleOpenEdit = (item: Supplier) => {
    setIsEdit(true);
    setFormData({ ...item }); // Clone data
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบ Supplier นี้? (ข้อมูลใน PO เก่าจะยังคงอยู่)")) return;
    try {
      await deleteSupplier(id);
      setMsg({ type: "success", text: "ลบข้อมูลสำเร็จ" });
      load();
    } catch (e) {
      setMsg({ type: "error", text: "เกิดข้อผิดพลาดในการลบ" });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      setMsg({ type: "error", text: "กรุณากรอกชื่อร้านค้า/บริษัท" });
      return;
    }

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
    }
  };

  return (
    <Box p={{ xs: 2, md: 4 }} sx={{ bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary.main">
             Supplier Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
             จัดการรายชื่อผู้ขายและร้านค้าคู่ค้า (Master Data)
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} sx={{ borderRadius: 2 }}>
            รีเฟรช
          </Button>
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" onClick={handleOpenCreate} sx={{ borderRadius: 2, boxShadow: 2 }}>
            เพิ่ม Supplier
          </Button>
        </Stack>
      </Stack>

      {/* Search & Alert */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
        <TextField 
          size="small" 
          placeholder="ค้นหาชื่อร้าน, ผู้ติดต่อ..." 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          fullWidth
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
          sx={{ maxWidth: 400 }}
        />
      </Paper>

      {msg && (
        <Alert severity={msg.type} onClose={()=>setMsg(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {msg.text}
        </Alert>
      )}

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: '1px solid #eaeff1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>ชื่อร้านค้า / บริษัท</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>ผู้ติดต่อ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>เบอร์โทร / Email</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>เลขผู้เสียภาษี</TableCell>
              <TableCell align="center" width={140} sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
              {view.map((row) => (
                <TableRow component={motion.tr} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} key={row._id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box sx={{ p: 1, bgcolor: 'primary.light', borderRadius: 1, color: 'primary.contrastText' }}><StoreIcon fontSize="small"/></Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight={600}>{row.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{row.address || "-"}</Typography>
                        </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{row.contactPerson || "-"}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.phone || "-"}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                  </TableCell>
                  <TableCell>{row.taxId ? <Chip label={row.taxId} size="small" variant="outlined" /> : "-"}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="แก้ไข">
                        <IconButton size="small" color="primary" onClick={()=>handleOpenEdit(row)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                        <IconButton size="small" color="error" onClick={()=>handleDelete(row._id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
            {view.length === 0 && !loading && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>ไม่พบข้อมูล</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={()=>setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isEdit ? "แก้ไข Supplier" : "เพิ่ม Supplier ใหม่"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="ชื่อร้านค้า / บริษัท (จำเป็น)" value={formData.name || ""} onChange={e=>setFormData({...formData, name: e.target.value})} fullWidth required autoFocus />
            <TextField label="ชื่อผู้ติดต่อ (Contact Person)" value={formData.contactPerson || ""} onChange={e=>setFormData({...formData, contactPerson: e.target.value})} fullWidth />
            <Stack direction="row" spacing={2}>
                <TextField label="เบอร์โทรศัพท์" value={formData.phone || ""} onChange={e=>setFormData({...formData, phone: e.target.value})} fullWidth />
                <TextField label="Email" value={formData.email || ""} onChange={e=>setFormData({...formData, email: e.target.value})} fullWidth />
            </Stack>
            <TextField label="เลขประจำตัวผู้เสียภาษี (Tax ID)" value={formData.taxId || ""} onChange={e=>setFormData({...formData, taxId: e.target.value})} fullWidth />
            <TextField label="ที่อยู่ (Address)" value={formData.address || ""} onChange={e=>setFormData({...formData, address: e.target.value})} fullWidth multiline rows={3} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={()=>setOpenDialog(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={handleSubmit}>{isEdit ? "บันทึกการแก้ไข" : "ยืนยันการเพิ่ม"}</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}