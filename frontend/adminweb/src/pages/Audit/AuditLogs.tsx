// src/pages/Audit/AuditLogs.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Stack, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TablePagination, InputAdornment, Card, CardContent, alpha, useTheme, Fade
} from "@mui/material";
import * as XLSX from "xlsx";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import HistoryIcon from "@mui/icons-material/History";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CodeIcon from "@mui/icons-material/Code";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PersonIcon from "@mui/icons-material/Person";
import DnsIcon from "@mui/icons-material/Dns";
import RefreshIcon from "@mui/icons-material/Refresh";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }

type Log = {
  _id: string;
  user?: { _id: string; username: string; name?: string; role?: string };
  action: string;
  resource?: string;
  detail?: any; // หรือ diff
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

export default function AuditLogs() {
  const theme = useTheme();
  const [rows, setRows] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialog Detail
  const [viewLog, setViewLog] = useState<Log | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/audit-logs`, { headers: { Authorization: `Bearer ${getToken()}` }});
      const data = await res.json();
      // Sort ใหม่สุดขึ้นก่อนเสมอ
      const sorted = Array.isArray(data) ? data.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
      setRows(sorted);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const qq = q.toLowerCase();
    return rows.filter(l =>
      l.action?.toLowerCase().includes(qq) ||
      (l.user?.username || "").toLowerCase().includes(qq) ||
      (l.user?.name || "").toLowerCase().includes(qq) ||
      (l.resource || "").toLowerCase().includes(qq) ||
      JSON.stringify(l.detail || {}).toLowerCase().includes(qq)
    );
  }, [rows, q]);

  const paginatedRows = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  // Export Excel
  const exportExcel = () => {
    const data = filtered.map(l => ({
        "Date": new Date(l.createdAt).toLocaleString("th-TH"),
        "User": l.user?.username || "System",
        "Action": l.action,
        "Resource": l.resource || "-",
        "Detail": JSON.stringify(l.detail || {}),
        "IP Address": l.ip
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "AuditLogs");
    XLSX.writeFile(wb, `AuditLog_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Helper for Chip Colors
  const getActionColor = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes("LOGIN")) return "info";
    if (a.includes("CREATE") || a.includes("ADD")) return "success";
    if (a.includes("UPDATE") || a.includes("EDIT")) return "warning";
    if (a.includes("DELETE") || a.includes("REMOVE")) return "error";
    return "default";
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4} spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
            <Box p={1.5} borderRadius={3} bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main">
                <HistoryIcon fontSize="large" />
            </Box>
            <Box>
                <Typography variant="h4" fontWeight={900}>ประวัติการใช้งาน (Audit Logs)</Typography>
                <Typography variant="body2" color="text.secondary">ตรวจสอบกิจกรรมทั้งหมดที่เกิดขึ้นในระบบ</Typography>
            </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} sx={{ borderRadius: 2 }}>รีเฟรช</Button>
            <Button variant="contained" color="success" startIcon={<FileDownloadIcon />} onClick={exportExcel} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Export Excel
            </Button>
        </Stack>
      </Stack>

      {/* Stats Card (Optional) */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
          <CardContent sx={{ py: 2 }}>
             <Stack direction="row" spacing={3} divider={<Box sx={{ borderRight: '1px solid #ddd', height: 24 }} />}>
                 <Box>
                     <Typography variant="caption" color="text.secondary">Total Logs</Typography>
                     <Typography variant="h6" fontWeight={800}>{rows.length.toLocaleString()}</Typography>
                 </Box>
                 <Box>
                     <Typography variant="caption" color="text.secondary">Users Active</Typography>
                     <Typography variant="h6" fontWeight={800}>{new Set(rows.map(r=>r.user?._id)).size}</Typography>
                 </Box>
                 <Box>
                     <Typography variant="caption" color="text.secondary">Actions Today</Typography>
                     <Typography variant="h6" fontWeight={800} color="primary">
                         {rows.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length}
                     </Typography>
                 </Box>
             </Stack>
          </CardContent>
      </Card>

      {/* Filter */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <TextField 
            fullWidth size="small" 
            placeholder="ค้นหา Action, User, IP หรือรายละเอียด..." 
            value={q} onChange={e=>setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
        />
      </Paper>

      {/* Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid', borderColor: 'divider' }}>
        <Table stickyHeader size="small">
          <TableHead sx={{ '& th': { bgcolor: '#FAFAFA', fontWeight: 800, py: 1.5 } }}>
            <TableRow>
              <TableCell width="180">Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action / Resource</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell align="right" width="100">Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
                 <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>กำลังโหลดข้อมูล...</TableCell></TableRow>
            ) : paginatedRows.length === 0 ? (
                 <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>ไม่พบข้อมูล</TableCell></TableRow>
            ) : (
                paginatedRows.map((l, i) => (
                    <Fade in timeout={300} key={l._id}>
                        <TableRow hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                {new Date(l.createdAt).toLocaleString("th-TH")}
                            </TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <PersonIcon fontSize="small" color="action" />
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>
                                            {l.user?.username || <Typography component="span" color="text.secondary" variant="body2" fontStyle="italic">System/Guest</Typography>}
                                        </Typography>
                                        {l.user?.name && <Typography variant="caption" color="text.secondary">{l.user.name}</Typography>}
                                    </Box>
                                </Stack>
                            </TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip 
                                        label={l.action} 
                                        size="small" 
                                        color={getActionColor(l.action) as any} 
                                        variant="outlined"
                                        sx={{ fontWeight: 700, borderRadius: 1, minWidth: 80 }}
                                    />
                                    {l.resource && <Typography variant="caption" color="text.secondary">on <b>{l.resource}</b></Typography>}
                                </Stack>
                            </TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <DnsIcon fontSize="inherit" color="action" sx={{ fontSize: 14 }} />
                                    <Typography variant="body2" fontFamily="monospace">{l.ip || "-"}</Typography>
                                </Stack>
                            </TableCell>
                            <TableCell align="right">
                                <Tooltip title="ดูรายละเอียด JSON">
                                    <IconButton size="small" onClick={()=>setViewLog(l)} color="primary">
                                        <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    </Fade>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog open={!!viewLog} onClose={()=>setViewLog(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #eee' }}>
              <CodeIcon color="primary" /> 
              <Typography fontWeight={700}>รายละเอียด Log Data</Typography>
          </DialogTitle>
          <DialogContent sx={{ bgcolor: '#f5f5f5', p: 0 }}>
              {viewLog && (
                  <Box p={3} sx={{ overflowX: 'auto' }}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                          ID: {viewLog._id} • {new Date(viewLog.createdAt).toLocaleString("th-TH")}
                      </Typography>
                      {/* JSON View */}
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#282c34', color: '#abb2bf', borderRadius: 2 }}>
                          <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, overflowX: 'auto' }}>
                              {JSON.stringify({
                                  action: viewLog.action,
                                  resource: viewLog.resource,
                                  user: viewLog.user,
                                  data: viewLog.detail || {}, // fallback if detail is null
                                  userAgent: viewLog.userAgent
                              }, null, 2)}
                          </pre>
                      </Paper>
                  </Box>
              )}
          </DialogContent>
          <DialogActions>
              <Button onClick={()=>setViewLog(null)}>ปิดหน้าต่าง</Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}