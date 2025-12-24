import { useEffect, useMemo, useState } from "react";
import { Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow, TableCell, TableBody, Chip } from "@mui/material";

const API = import.meta.env.VITE_API_URL || "/api";
const token = () => localStorage.getItem("aw_token") || "";

type Log = {
  _id: string;
  user?: { _id: string; username: string; name?: string };
  action: string;
  detail?: any;
  ip?: string;
  createdAt: string;
};

export default function AuditLogs() {
  const [rows, setRows] = useState<Log[] | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${API}/audit-logs`, { headers: { Authorization: `Bearer ${token()}` }});
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
    return list.filter(l =>
      l.action?.toLowerCase().includes(qq) ||
      (l.user?.username || "").toLowerCase().includes(qq) ||
      JSON.stringify(l.detail || {}).toLowerCase().includes(qq)
    );
  }, [rows, q]);

  return (
    <Box p={{ xs:2, md:3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={900}>Audit Logs</Typography>
        <TextField size="small" placeholder="ค้นหา (action/user/detail)" value={q} onChange={e=>setQ(e.target.value)} />
      </Stack>

      <Paper elevation={3} sx={{ p: 0, borderRadius: 3, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>เวลา</TableCell>
              <TableCell>ผู้ใช้</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>รายละเอียด</TableCell>
              <TableCell>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.map(l => (
              <TableRow key={l._id} hover>
                <TableCell>{new Date(l.createdAt).toLocaleString("th-TH")}</TableCell>
                <TableCell>{l.user ? `${l.user.username}${l.user.name ? ` (${l.user.name})` : ""}` : "-"}</TableCell>
                <TableCell><Chip size="small" label={l.action} /></TableCell>
                <TableCell>
                  <code style={{ fontSize: 12, whiteSpace: "nowrap" }}>{JSON.stringify(l.detail || {})}</code>
                </TableCell>
                <TableCell>{l.ip || "-"}</TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow><TableCell colSpan={5}><Box p={2}><Typography color="text.secondary">ไม่พบข้อมูล</Typography></Box></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}