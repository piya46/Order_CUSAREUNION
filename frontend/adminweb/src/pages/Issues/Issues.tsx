import { useEffect, useState } from "react";
import { 
  Box, Paper, Typography, Button, Table, TableRow, TableCell, 
  TableBody, TableHead, Chip, Dialog, TextField, Stack, 
  MenuItem, IconButton, Grid, Autocomplete, CircularProgress 
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
// Import API เพิ่มเติมเพื่อดึงข้อมูล Order/Product มาแสดง
import { listIssues, createIssue, updateIssue, listOrders, listInventory } from "../../api/admin"; 
import { Issue } from "../../types";

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  
  // Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  // Form States
  const [createForm, setCreateForm] = useState({ 
    refType: "ORDER", // Default เป็น Order
    refId: "", 
    description: "", 
    priority: "MEDIUM" 
  });
  
  const [editForm, setEditForm] = useState<{ id: string, status: string, priority: string, adminComment: string } | null>(null);

  // State สำหรับ Autocomplete (รายการตัวเลือก Ref ID)
  const [refOptions, setRefOptions] = useState<{ label: string, value: string }[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Load Issues
  const load = async () => {
    try {
      const data = await listIssues();
      setIssues(data);
    } catch (error) {
      console.error("Failed to load issues", error);
    }
  };

  useEffect(() => { load(); }, []);

  // Effect: โหลดตัวเลือก Ref ID เมื่อเปลี่ยน Ref Type ในหน้า Create
  useEffect(() => {
    if (!openCreate) return; // ไม่ต้องโหลดถ้าไม่ได้เปิดหน้า Create

    const fetchOptions = async () => {
      setLoadingOptions(true);
      setRefOptions([]); // Clear เก่าก่อน
      
      try {
        if (createForm.refType === "ORDER") {
          const orders = await listOrders();
          // map orderNo มาเป็นตัวเลือก
          setRefOptions(orders.map(o => ({ 
            label: `${o.orderNo} (${o.customerName})`, // โชว์เลข + ชื่อลูกค้าให้ดูง่าย
            value: o.orderNo 
          })));
        } else if (createForm.refType === "PRODUCT") {
          const products = await listInventory();
          // map ชื่อสินค้าหรือรหัสมาเป็นตัวเลือก
          setRefOptions(products.map(p => ({ 
            label: p.name, 
            value: p._id // หรือใช้ p.productCode ถ้ามี
          })));
        }
        // กรณี RECEIVING หรืออื่นๆ เพิ่ม logic ตรงนี้ได้ครับ
      } catch (err) {
        console.error("Failed to load ref options", err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [createForm.refType, openCreate]);


  const handleCreate = async () => {
    try {
      // ส่ง refType และ refId ไปบันทึก
      await createIssue({ 
        ...createForm,
        // priority, refType, refId, description ถูกส่งไปครบถ้วน
      } as any);
      
      setOpenCreate(false);
      setCreateForm({ refType: "ORDER", refId: "", description: "", priority: "MEDIUM" }); // Reset
      load();
    } catch (error) {
      alert("Error creating issue");
    }
  };

  const openEditModal = (issue: Issue) => {
    setEditForm({
      id: issue._id,
      status: issue.status,
      priority: issue.priority || "MEDIUM",
      adminComment: issue.adminComment || ""
    });
    setOpenEdit(true);
  };

  const handleUpdate = async () => {
    if (!editForm) return;
    try {
      await updateIssue(editForm.id, {
        status: editForm.status as any,
        priority: editForm.priority as any,
        adminComment: editForm.adminComment
      });
      setOpenEdit(false);
      load();
    } catch (error) {
      alert("Error updating issue");
    }
  };

  // Helper colors... (เหมือนเดิม)
  const getPriorityColor = (p: string) => {
    switch(p) {
      case "CRITICAL": return "error";
      case "HIGH": return "warning";
      case "LOW": return "info";
      default: return "default";
    }
  };
  const getStatusColor = (s: string) => {
    switch(s) {
      case "RESOLVED": return "success";
      case "PROCESSING": return "primary";
      case "REJECTED": return "default";
      case "CLOSED": return "default";
      default: return "error"; 
    }
  };

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Stack direction="row" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight={700}>แจ้งปัญหา (Issues)</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>
          สร้างรายการ
        </Button>
      </Stack>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Issue No.</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Ref (Type/ID)</TableCell>
              <TableCell>รายละเอียด</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Manage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {issues.map(i => (
              <TableRow key={i._id}>
                <TableCell>{i.issueNumber}</TableCell>
                <TableCell>
                  <Chip label={i.priority || "MEDIUM"} color={getPriorityColor(i.priority || "MEDIUM") as any} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  {/* แสดง Type คู่กับ ID */}
                  <Stack direction="column" alignItems="flex-start">
                    <Typography variant="caption" color="textSecondary">{i.refType}</Typography>
                    <Chip label={i.refId} size="small" />
                  </Stack>
                </TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                    <Typography noWrap variant="body2">{i.description}</Typography>
                    {i.adminComment && <Typography variant="caption" color="primary">Admin: {i.adminComment}</Typography>}
                </TableCell>
                <TableCell>
                  <Chip label={i.status} color={getStatusColor(i.status) as any} size="small" />
                </TableCell>
                <TableCell align="right">
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openEditModal(i)}>
                        Edit
                    </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* --- Dialog สร้างใหม่ (Updated) --- */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <Box p={3}>
          <Typography variant="h6" mb={2}>แจ้งปัญหาใหม่</Typography>
          <Stack spacing={2}>
            
            <Grid container spacing={2}>
              {/* เลือกประเภทอ้างอิง */}
              <Grid item xs={4}>
                <TextField 
                    select fullWidth label="Ref Type" 
                    value={createForm.refType} 
                    onChange={e => setCreateForm({...createForm, refType: e.target.value, refId: ""})} // Reset ID เมื่อเปลี่ยน Type
                >
                    <MenuItem value="ORDER">Order</MenuItem>
                    <MenuItem value="PRODUCT">Product</MenuItem>
                    <MenuItem value="RECEIVING">Receiving</MenuItem>
                </TextField>
              </Grid>

              {/* Autocomplete: ค้นหาและเลือก Ref ID */}
              <Grid item xs={8}>
                 <Autocomplete
                    options={refOptions}
                    getOptionLabel={(option) => option.label}
                    loading={loadingOptions}
                    // เมื่อเลือกค่า
                    onChange={(_, newValue) => {
                        setCreateForm({ ...createForm, refId: newValue ? newValue.value : "" });
                    }}
                    // กรณีพิมพ์เอง (FreeSolo) หรือแสดงผล
                    renderInput={(params) => (
                        <TextField 
                            {...params} 
                            label={`ค้นหา ${createForm.refType} ID`} 
                            InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                    <>
                                        {loadingOptions ? <CircularProgress color="inherit" size={20} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            }}
                        />
                    )}
                 />
              </Grid>
            </Grid>

            <TextField 
                select label="Priority" 
                value={createForm.priority} 
                onChange={e => setCreateForm({...createForm, priority: e.target.value})}
            >
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>

            <TextField multiline rows={3} label="รายละเอียดปัญหา" value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} />
            
            <Button variant="contained" onClick={handleCreate} disabled={!createForm.refId || !createForm.description}>
                บันทึก
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* --- Dialog แก้ไข (Updated) --- */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <Box p={3}>
          <Typography variant="h6" mb={2}>จัดการปัญหา</Typography>
          {editForm && (
              <Stack spacing={2}>
                  <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField 
                            fullWidth select label="Status" 
                            value={editForm.status} 
                            onChange={e => setEditForm({...editForm, status: e.target.value})}
                        >
                            {['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED', 'CLOSED'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={6}>
                        <TextField 
                            fullWidth select label="Priority" 
                            value={editForm.priority} 
                            onChange={e => setEditForm({...editForm, priority: e.target.value})}
                        >
                            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        </TextField>
                      </Grid>
                  </Grid>
                  
                  <TextField 
                    fullWidth multiline rows={3} 
                    label="Admin Comment / Note" 
                    placeholder="บันทึกการแก้ไข..."
                    value={editForm.adminComment} 
                    onChange={e => setEditForm({...editForm, adminComment: e.target.value})} 
                  />
                  
                  <Button variant="contained" color="primary" onClick={handleUpdate}>บันทึกการเปลี่ยนแปลง</Button>
              </Stack>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}