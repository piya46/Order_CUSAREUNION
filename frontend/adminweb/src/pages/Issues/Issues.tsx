// src/pages/Issues/Issues.tsx
import { useEffect, useState } from "react";
import { Box, Paper, Typography, Button, Table, TableRow, TableCell, TableBody, TableHead, Chip, Dialog, TextField, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const API = import.meta.env.VITE_API_URL || "/api";

export default function Issues() {
  const [issues, setIssues] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ refId: "", description: "" });

  const load = () => fetch(`${API}/issues`, { headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` } }).then(r=>r.json()).then(setIssues);
  useEffect(() => { load(); }, []);

  const create = async () => {
    await fetch(`${API}/issues`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("aw_token")}`}, body:JSON.stringify({ ...form, refType:"ORDER" }) });
    setOpen(false); load();
  };

  const resolve = async (id: string) => {
    if(!confirm("ยืนยันการปิดงาน?")) return;
    await fetch(`${API}/issues/${id}`, { method:"PUT", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("aw_token")}`}, body:JSON.stringify({ status:"RESOLVED" }) });
    load();
  };

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Stack direction="row" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight={700}>แจ้งปัญหา (Issues)</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={()=>setOpen(true)}>สร้างรายการ</Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Issue No.</TableCell>
              <TableCell>Ref ID</TableCell>
              <TableCell>รายละเอียด</TableCell>
              <TableCell>สถานะ</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {issues.map(i => (
              <TableRow key={i._id}>
                <TableCell>{i.issueNumber}</TableCell>
                <TableCell><Chip label={i.refId} size="small" /></TableCell>
                <TableCell>{i.description}</TableCell>
                <TableCell>
                  <Chip label={i.status} color={i.status==="RESOLVED"?"success":i.status==="OPEN"?"error":"warning"} size="small" />
                </TableCell>
                <TableCell align="right">
                  {i.status !== "RESOLVED" && (
                    <Button size="small" color="success" startIcon={<CheckCircleIcon />} onClick={()=>resolve(i._id)}>ปิดงาน</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm">
        <Box p={3}>
          <Typography variant="h6" mb={2}>แจ้งปัญหาใหม่</Typography>
          <TextField fullWidth label="Order ID / Ref ID" value={form.refId} onChange={e=>setForm({...form, refId:e.target.value})} sx={{ mb: 2 }} />
          <TextField fullWidth multiline rows={3} label="รายละเอียดปัญหา" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} sx={{ mb: 2 }} />
          <Button fullWidth variant="contained" onClick={create}>บันทึก</Button>
        </Box>
      </Dialog>
    </Box>
  );
}