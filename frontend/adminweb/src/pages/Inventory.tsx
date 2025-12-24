// src/pages/Inventory.tsx
import { useEffect, useState, useMemo } from "react";
import { Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, Stack, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import WarehouseIcon from "@mui/icons-material/Warehouse";

const API = import.meta.env.VITE_API_URL || "/api";

export default function Inventory() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`${API}/products/inventory`, { headers: { Authorization: `Bearer ${localStorage.getItem("aw_token")}` } })
      .then(r => r.json()).then(d => {
        // Flatten variants
        const flat = d.flatMap((p: any) => p.variants.map((v: any) => ({
          ...v, productName: p.name, code: p.productCode, category: p.category, 
          // Logic: Stock in DB is usually "Available". If logic differs, adjust here.
          // Assumption: v.stock = Available. v.locked = Reserved. Total = Available + Reserved.
          total: (v.stock || 0) + (v.locked || 0),
          reserved: v.locked || 0,
          available: v.stock || 0
        })));
        setRows(flat);
      });
  }, []);

  const filtered = useMemo(() => rows.filter(r => r.productName.toLowerCase().includes(q.toLowerCase()) || r.code?.includes(q)), [rows, q]);

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <WarehouseIcon color="primary" fontSize="large" />
        <Box>
          <Typography variant="h4" fontWeight={700}>คลังสินค้า</Typography>
          <Typography color="text.secondary">จัดการจำนวนสินค้าคงเหลือ</Typography>
        </Box>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField 
          fullWidth size="small" placeholder="ค้นหาสินค้า..." value={q} onChange={e=>setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
        />
      </Paper>

      <Paper sx={{ overflow: "hidden" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>รหัส</TableCell>
              <TableCell>สินค้า</TableCell>
              <TableCell>ตัวเลือก</TableCell>
              <TableCell align="right">ราคา</TableCell>
              <TableCell align="center" sx={{ bgcolor: '#FFFDE7' }}>ทั้งหมด (Total)</TableCell>
              <TableCell align="center" sx={{ bgcolor: '#FFEBEE', color: '#D32F2F' }}>ติดจอง (Reserved)</TableCell>
              <TableCell align="center" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32' }}>พร้อมขาย (Available)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell><Chip label={r.code || "-"} size="small" variant="outlined" /></TableCell>
                <TableCell fontWeight={600}>{r.productName}</TableCell>
                <TableCell>{r.size} {r.color}</TableCell>
                <TableCell align="right">{r.price.toLocaleString()}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>{r.total.toLocaleString()}</TableCell>
                <TableCell align="center" sx={{ color: 'error.main' }}>{r.reserved > 0 ? r.reserved.toLocaleString() : "-"}</TableCell>
                <TableCell align="center">
                  <Chip 
                    label={r.available.toLocaleString()} 
                    color={r.available > 0 ? "success" : "default"} 
                    variant={r.available > 0 ? "filled" : "outlined"} 
                    size="small" 
                    sx={{ minWidth: 60 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}