import { useEffect, useState } from "react";
import { 
  Box, Paper, Typography, Button, Chip, Dialog, TextField, Stack, 
  MenuItem, Grid, Autocomplete, CircularProgress, Card 
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
// Import API เพิ่มเติม
import { listIssues, createIssue, updateIssue, listOrders, listInventory } from "../../api/admin"; 
import { Issue } from "../../types";

// ✅ Kanban Column Component
const KanbanColumn = ({ title, status, issues, color, onEdit }: any) => (
  <Paper sx={{ flex: 1, minWidth: 280, p: 2, bgcolor: "#f4f6f8", borderRadius: 3 }}>
    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
       <Chip label={issues.length} color={color} size="small" sx={{ fontWeight: 'bold' }} />
       <Typography fontWeight={800} color="text.secondary">{title}</Typography>
    </Stack>
    <Stack spacing={2}>
      {issues.map((i: any) => (
        <Paper 
            key={i._id} 
            elevation={1}
            sx={{ p: 2, cursor: "pointer", borderLeft: `4px solid`, borderColor: `${color}.main`, '&:hover': { boxShadow: 3, transform: 'translateY(-2px)', transition: '0.2s' } }} 
            onClick={() => onEdit(i)}
        >
           <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight={800}>{i.issueNumber}</Typography>
              {i.priority === 'CRITICAL' && <Chip label="CRITICAL" size="small" color="error" />}
              {i.priority === 'HIGH' && <Chip label="HIGH" size="small" color="warning" />}
           </Stack>
           <Typography variant="body2" noWrap sx={{ mb: 1 }}>{i.description}</Typography>
           <Typography variant="caption" color="text.secondary" display="block">
              Ref: {i.refType} #{i.refId}
           </Typography>
        </Paper>
      ))}
    </Stack>
  </Paper>
);

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  
  // Dialog State
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  // Form States
  const [createForm, setCreateForm] = useState({ 
    refType: "ORDER", 
    refId: "", 
    description: "", 
    priority: "MEDIUM" 
  });
  
  const [editForm, setEditForm] = useState<{ id: string, status: string, priority: string, adminComment: string } | null>(null);

  // State สำหรับ Autocomplete
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
    if (!openCreate) return;

    const fetchOptions = async () => {
      setLoadingOptions(true);
      setRefOptions([]); 
      
      try {
        if (createForm.refType === "ORDER") {
          const orders = await listOrders();
          setRefOptions(orders.map(o => ({ 
            label: `${o.orderNo} (${o.customerName})`, 
            value: o.orderNo 
          })));
        } else if (createForm.refType === "PRODUCT") {
          const products = await listInventory();
          setRefOptions(products.map(p => ({ 
            label: p.name, 
            value: p._id 
          })));
        }
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
      await createIssue({ ...createForm } as any);
      setOpenCreate(false);
      setCreateForm({ refType: "ORDER", refId: "", description: "", priority: "MEDIUM" });
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

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Stack direction="row" justifyContent="space-between" mb={3}>
        <Typography variant="h4" fontWeight={700}>แจ้งปัญหา (Issues)</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>
          สร้างรายการ
        </Button>
      </Stack>

      {/* ✅ Kanban Board Layout */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start" sx={{ overflowX: "auto", pb: 2 }}>
        <KanbanColumn 
             title="แจ้งใหม่ (Open)" 
             status="OPEN" 
             issues={issues.filter(i=>i.status==='OPEN')} 
             color="error" 
             onEdit={openEditModal} 
        />
        <KanbanColumn 
             title="กำลังดำเนินการ (Processing)" 
             status="PROCESSING" 
             issues={issues.filter(i=>i.status==='PROCESSING')} 
             color="warning" 
             onEdit={openEditModal} 
        />
        <KanbanColumn 
             title="แก้ไขแล้ว (Resolved)" 
             status="RESOLVED" 
             issues={issues.filter(i=>i.status==='RESOLVED')} 
             color="success" 
             onEdit={openEditModal} 
        />
        <KanbanColumn 
             title="ปิดงาน (Closed)" 
             status="CLOSED" 
             issues={issues.filter(i=>i.status==='CLOSED' || i.status==='REJECTED')} 
             color="default" 
             onEdit={openEditModal} 
        />
      </Stack>

      {/* Dialog สร้างใหม่ */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <Box p={3}>
          <Typography variant="h6" mb={2}>แจ้งปัญหาใหม่</Typography>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField 
                    select fullWidth label="Ref Type" 
                    value={createForm.refType} 
                    onChange={e => setCreateForm({...createForm, refType: e.target.value, refId: ""})} 
                >
                    <MenuItem value="ORDER">Order</MenuItem>
                    <MenuItem value="PRODUCT">Product</MenuItem>
                    <MenuItem value="RECEIVING">Receiving</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={8}>
                 <Autocomplete
                    options={refOptions}
                    getOptionLabel={(option) => option.label}
                    loading={loadingOptions}
                    onChange={(_, newValue) => {
                        setCreateForm({ ...createForm, refId: newValue ? newValue.value : "" });
                    }}
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
            <TextField select label="Priority" value={createForm.priority} onChange={e => setCreateForm({...createForm, priority: e.target.value})}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            <TextField multiline rows={3} label="รายละเอียดปัญหา" value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} />
            <Button variant="contained" onClick={handleCreate} disabled={!createForm.refId || !createForm.description}>บันทึก</Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Dialog แก้ไข */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <Box p={3}>
          <Typography variant="h6" mb={2}>จัดการปัญหา</Typography>
          {editForm && (
              <Stack spacing={2}>
                  <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField fullWidth select label="Status" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                            {['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED', 'CLOSED'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={6}>
                        <TextField fullWidth select label="Priority" value={editForm.priority} onChange={e => setEditForm({...editForm, priority: e.target.value})}>
                            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        </TextField>
                      </Grid>
                  </Grid>
                  <TextField fullWidth multiline rows={3} label="Admin Comment / Note" placeholder="บันทึกการแก้ไข..." value={editForm.adminComment} onChange={e => setEditForm({...editForm, adminComment: e.target.value})} />
                  <Button variant="contained" color="primary" onClick={handleUpdate}>บันทึกการเปลี่ยนแปลง</Button>
              </Stack>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}