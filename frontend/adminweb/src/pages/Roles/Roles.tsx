// src/pages/Roles/Roles.tsx
import { useEffect, useState } from "react";
import { Box, Paper, Typography, Button, Table, TableRow, TableCell, TableBody, TableHead, Checkbox, FormControlLabel, Dialog, TextField, Stack, Chip, Grid } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";

const API = import.meta.env.VITE_API_URL || "/api";
// รายการ Permission ที่ระบบรองรับ (สมมติ)
const PERMISSIONS_LIST = [
  "view_dashboard", "manage_orders", "view_orders", "manage_products", 
  "manage_inventory", "manage_users", "manage_roles", "manage_issues", "view_audit_log"
];

export default function Roles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{name:string, permissions:string[]}>({ name: "", permissions: [] });

  const load = () => fetch(`${API}/roles`, { headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` } }).then(r=>r.json()).then(setRoles);
  useEffect(() => { load(); }, []);

  const togglePerm = (p: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(p) ? prev.permissions.filter(x => x !== p) : [...prev.permissions, p]
    }));
  };

  const save = async () => {
    await fetch(`${API}/roles`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("aw_token")}`}, body:JSON.stringify(form) });
    setOpen(false); load();
  };

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Stack direction="row" justifyContent="space-between" mb={3}>
        <Stack direction="row" spacing={1} alignItems="center">
            <SecurityIcon color="primary" fontSize="large"/>
            <Typography variant="h4" fontWeight={700}>สิทธิ์การใช้งาน (Roles)</Typography>
        </Stack>
        <Button variant="contained" onClick={()=>{setForm({name:"", permissions:[]}); setOpen(true);}}>+ เพิ่มบทบาท</Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Role Name</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map(r => (
              <TableRow key={r._id}>
                <TableCell fontWeight={600}>{r.name}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {r.permissions.map((p:string) => <Chip key={p} label={p} size="small" variant="outlined" sx={{ my: 0.5 }} />)}
                  </Stack>
                </TableCell>
                <TableCell align="right"><Button size="small" color="error">ลบ</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm">
        <Box p={3}>
          <Typography variant="h6" mb={2}>สร้าง/แก้ไข Role</Typography>
          <TextField fullWidth label="Role Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} sx={{ mb: 2 }} />
          <Typography variant="subtitle2" mb={1}>เลือกสิทธิ์:</Typography>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflowY: "auto" }}>
            <Grid container>
              {PERMISSIONS_LIST.map(p => (
                <Grid item xs={6} key={p}>
                  <FormControlLabel 
                    control={<Checkbox checked={form.permissions.includes(p)} onChange={()=>togglePerm(p)} />} 
                    label={p} 
                  />
                </Grid>
              ))}
            </Grid>
          </Paper>
          <Button fullWidth variant="contained" onClick={save} sx={{ mt: 2 }}>บันทึก</Button>
        </Box>
      </Dialog>
    </Box>
  );
}