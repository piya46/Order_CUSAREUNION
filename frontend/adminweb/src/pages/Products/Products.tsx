// src/pages/Products/Products.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Grid, Paper, Typography, Card, CardMedia, CardContent, Chip, Stack, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, IconButton,
  Divider, Tooltip, Skeleton, InputAdornment, MenuItem, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow, Tab, Tabs, alpha, useTheme, Fade
} from "@mui/material";

// Icons
import AddBoxIcon from "@mui/icons-material/AddBox";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Cancel from "@mui/icons-material/Cancel";
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import Refresh from "@mui/icons-material/Refresh";
import LocalOffer from "@mui/icons-material/LocalOffer";
import CategoryIcon from "@mui/icons-material/Category";
import Search from "@mui/icons-material/Search";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CloseIcon from "@mui/icons-material/Close";
import ListAltIcon from "@mui/icons-material/ListAlt";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import PriceCheckIcon from "@mui/icons-material/PriceCheck";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SaveIcon from "@mui/icons-material/Save";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }

// Types
type Variant = {
  _id?: string;
  size: string;
  color?: string;
  price: number;
  stock: number;
  locked?: number;
  paidQty?: number;
};
type Product = {
  _id: string;
  productCode?: string;
  name: string;
  description?: string;
  category?: string;
  preorder?: boolean;
  images?: string[];
  imageUrls?: string[];
  availableFrom?: string;
  availableTo?: string;
  isActive?: boolean;
  variants: Variant[];
  createdAt?: string;
  updatedAt?: string;
};

/* --- Helpers --- */
const fmtDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const fmtDateShow = (iso?: string) => iso ? new Date(iso).toLocaleDateString("th-TH", { day:"2-digit", month:"short", year:"2-digit" }) : "-";
const sumStock = (v?: Variant[]) => (v || []).reduce((s, x) => s + (x.stock || 0), 0);
const sumLocked = (v?: Variant[]) => (v || []).reduce((s, x) => s + (x.locked || 0), 0);
const sumPaid   = (v?: Variant[]) => (v || []).reduce((s, x) => s + (x.paidQty || 0), 0);
const now = () => Date.now();
const isAfter = (iso?: string) => (iso ? now() > new Date(iso).getTime() : false);
const isBefore = (iso?: string) => (iso ? now() < new Date(iso).getTime() : false);
const hasSaleWindow = (p: Product) => !!p.availableFrom || !!p.availableTo;
const saleState = (p: Product) => {
  if (!hasSaleWindow(p)) return "always";
  if (p.availableFrom && isBefore(p.availableFrom)) return "waiting";
  if (p.availableTo && isAfter(p.availableTo))   return "closed";
  return "active";
};
const filenameFromUrl = (u: string) => {
  try {
    const seg = u.split("/").pop() || "";
    return decodeURIComponent(seg);
  } catch { return ""; }
};

const CATEGORIES = ["เสื้อยืด", "เสื้อโปโล", "หมวก", "กระเป๋า", "ของที่ระลึก", "อื่น ๆ"];

export default function Products() {
  const theme = useTheme();
  const [items, setItems] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success'|'error', text: string } | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("ALL");
  const [onlyActive, setOnlyActive] = useState<"all"|"active"|"inactive">("all");

  // Dialogs
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [tabIndex, setTabIndex] = useState(0); // 0=Info, 1=Variants, 2=Images
  const [saving, setSaving] = useState(false);
  
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);
  const [stockDlg, setStockDlg] = useState<Product | null>(null);
  
  // Image Upload
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  
  // Image Gallery
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [currImgIdx, setCurrImgIdx] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/products/inventory`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setMsg({ type: 'error', text: "โหลดข้อมูลสินค้าไม่สำเร็จ" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return (items || [])
      .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.productCode?.toLowerCase().includes(q.toLowerCase()))
      .filter(p => cat === "ALL" || p.category === cat)
      .filter(p => onlyActive === "all" ? true : (onlyActive === "active" ? p.isActive : !p.isActive));
  }, [items, q, cat, onlyActive]);

  // --- CRUD Actions ---
  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { alert("กรุณากรอกชื่อสินค้า"); return; }
    if (!editing.variants?.length) { alert("ต้องมีอย่างน้อย 1 ตัวเลือกสินค้า"); setTabIndex(1); return; }

    setSaving(true);
    try {
      const body = {
        name: editing.name,
        description: editing.description || "",
        category: editing.category || "",
        preorder: !!editing.preorder,
        availableFrom: editing.availableFrom ? new Date(editing.availableFrom).toISOString() : undefined,
        availableTo: editing.availableTo ? new Date(editing.availableTo).toISOString() : undefined,
        isActive: editing.isActive !== false,
        variants: editing.variants.map(v => ({
          size: v.size, color: (v.color || "").trim(),
          price: Number(v.price || 0), stock: Number(v.stock || 0)
        }))
      };

      const isEdit = !!editing._id;
      const res = await fetch(`${API}/products${isEdit ? `/${editing._id}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type":"application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "บันทึกไม่สำเร็จ");

      setMsg({ type: 'success', text: isEdit ? "บันทึกข้อมูลเรียบร้อย" : "สร้างสินค้าใหม่เรียบร้อย" });
      
      // ถ้าสร้างใหม่ ให้เปิดหน้าต่างต่อแต่เปลี่ยนเป็นโหมดแก้ไข เพื่อให้ไปอัปรูปได้
      if(!isEdit && data._id) {
          setEditing({ ...editing, _id: data._id, variants: data.variants });
          setTabIndex(2); // ไปหน้าอัปโหลดรูป
          load(); // reload background list
      } else {
          setEditing(null);
          load();
      }
    } catch (e:any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/products/${confirmDel._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) {
        setMsg({ type: 'success', text: "ลบสินค้าเรียบร้อย" });
        load();
      } else throw new Error("ลบไม่สำเร็จ");
    } catch(e:any) { alert(e.message); }
    finally { setSaving(false); setConfirmDel(null); }
  };

  const handleUpload = async () => {
    if (!editing?._id || !uploadFiles?.length) return;
    const fd = new FormData();
    Array.from(uploadFiles).forEach(f => fd.append("files", f));
    try {
      const res = await fetch(`${API}/products/${editing._id}/images`, {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      // Update local state
      setEditing(prev => ({ ...prev, imageUrls: data.imageUrls || [] }));
      setUploadFiles(null);
      // Reload main list silently
      load(); 
    } catch (e) { alert("อัปโหลดรูปไม่สำเร็จ"); }
  };

  const handleDeleteImage = async (url: string) => {
    if(!confirm("ลบรูปนี้?")) return;
    const name = filenameFromUrl(url);
    try {
       await fetch(`${API}/products/${editing?._id}/images/${encodeURIComponent(name)}`, {
         method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` }
       });
       setEditing(prev => ({ ...prev, imageUrls: prev?.imageUrls?.filter(u => u !== url) }));
       load();
    } catch { alert("ลบรูปไม่สำเร็จ"); }
  };

  const toggleActive = async (p: Product) => {
     // Optimistic Update
     const newVal = !p.isActive;
     setItems(prev => (prev||[]).map(x => x._id === p._id ? { ...x, isActive: newVal } : x));
     try {
        await fetch(`${API}/products/${p._id}`, {
            method: "PUT", headers: { "Content-Type":"application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ isActive: newVal })
        });
     } catch {
        // Revert
        setItems(prev => (prev||[]).map(x => x._id === p._id ? { ...x, isActive: !newVal } : x));
     }
  };

  // Form Logic
  const openCreate = () => {
    setEditing({ 
        name: "", category: "", isActive: true, preorder: false, 
        variants: [{ size: "Free Size", color: "", price: 0, stock: 0 }] 
    });
    setTabIndex(0);
  };
  const openEdit = (p: Product) => {
    setEditing({
      ...p,
      availableFrom: fmtDateInput(p.availableFrom),
      availableTo: fmtDateInput(p.availableTo),
    });
    setTabIndex(0);
  };

  const updateVariant = (idx: number, field: keyof Variant, val: any) => {
    const vars = [...(editing?.variants || [])];
    vars[idx] = { ...vars[idx], [field]: val };
    setEditing(prev => ({ ...prev, variants: vars }));
  };

  return (
    <Box>
       {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} alignItems="center" justifyContent="space-between" mb={3} spacing={2}>
         <Stack direction="row" spacing={2} alignItems="center">
            <Box p={1.5} borderRadius={3} bgcolor={alpha(theme.palette.primary.main, 0.1)} color="primary.main">
                <Inventory2Icon fontSize="large" />
            </Box>
            <Box>
                <Typography variant="h4" fontWeight={900}>จัดการสินค้า</Typography>
                <Typography variant="body2" color="text.secondary">รายการสินค้าและสต๊อก (Inventory)</Typography>
            </Box>
         </Stack>
         <Button variant="contained" startIcon={<AddBoxIcon />} onClick={openCreate} size="large" sx={{ borderRadius: 2, fontWeight: 700 }}>
            เพิ่มสินค้าใหม่
         </Button>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
         <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField 
                size="small" placeholder="ค้นหาชื่อสินค้า..." value={q} onChange={e=>setQ(e.target.value)} 
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
                sx={{ flex: 1 }}
            />
            <TextField select size="small" label="หมวดหมู่" value={cat} onChange={e=>setCat(e.target.value)} sx={{ minWidth: 150 }}>
                <MenuItem value="ALL">ทั้งหมด</MenuItem>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="สถานะ" value={onlyActive} onChange={e=>setOnlyActive(e.target.value as any)} sx={{ minWidth: 150 }}>
                <MenuItem value="all">ทั้งหมด</MenuItem>
                <MenuItem value="active">Active (เปิดขาย)</MenuItem>
                <MenuItem value="inactive">Inactive (ปิดขาย)</MenuItem>
            </TextField>
         </Stack>
      </Paper>

      {msg && <Alert severity={msg.type} onClose={()=>setMsg(null)} sx={{ mb: 3, borderRadius: 2 }}>{msg.text}</Alert>}

      {/* Products Grid */}
      <Grid container spacing={3}>
         {loading ? Array.from({length:6}).map((_,i)=>(
            <Grid item xs={12} sm={6} md={4} key={i}>
               <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
            </Grid>
         )) : filtered.map(p => {
             const cover = p.imageUrls?.[0];
             const state = saleState(p);
             const isPre = p.preorder;
             const totalStock = sumStock(p.variants);
             
             return (
                 <Grid item xs={12} sm={6} md={4} key={p._id}>
                     <Card sx={{ 
                         height: '100%', borderRadius: 3, display: 'flex', flexDirection: 'column', 
                         transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[4] }
                     }}>
                        {/* Image Cover */}
                        <Box sx={{ position: 'relative', paddingTop: '56.25%', bgcolor: '#f5f5f5', cursor: 'pointer' }} 
                             onClick={()=>{if(p.imageUrls?.length) { setPreviewImages(p.imageUrls); setCurrImgIdx(0); }}}>
                             {cover ? (
                                <Box component="img" src={cover} sx={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover' }} />
                             ) : (
                                <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, color: 'text.disabled' }}>
                                    <ImageNotSupportedIcon sx={{ fontSize: 48 }} />
                                </Stack>
                             )}
                             
                             {/* Status Badges */}
                             <Stack direction="column" spacing={0.5} sx={{ position: 'absolute', top: 10, left: 10 }}>
                                 {isPre && <Chip label="Preorder" color="warning" size="small" sx={{ fontWeight: 700 }} />}
                                 {state === "waiting" && <Chip label="เร็วๆ นี้" color="info" size="small" />}
                                 {state === "closed" && <Chip label="ปิดรับแล้ว" color="error" size="small" />}
                             </Stack>
                             {p.imageUrls && p.imageUrls.length > 1 && (
                                 <Chip label={`+${p.imageUrls.length-1} รูป`} size="small" sx={{ position: 'absolute', bottom: 10, right: 10, bgcolor: 'rgba(0,0,0,0.6)', color: 'white' }} />
                             )}
                        </Box>

                        <CardContent sx={{ flex: 1, pb: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                <Typography fontWeight={800} variant="h6" sx={{ lineHeight: 1.2, mb: 0.5 }}>{p.name}</Typography>
                                <Switch size="small" checked={!!p.isActive} onChange={()=>toggleActive(p)} color="success" />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" noWrap mb={1}>{p.description || "ไม่มีรายละเอียด"}</Typography>
                            
                            <Stack direction="row" spacing={1} mb={2}>
                                <Chip icon={<CategoryIcon sx={{fontSize:'14px!important'}} />} label={p.category || "General"} size="small" variant="outlined" />
                                <Chip label={p.productCode} size="small" variant="outlined" sx={{ display: p.productCode ? 'inline-flex' : 'none' }} />
                            </Stack>

                            <Divider sx={{ my: 1.5 }} />
                            
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box textAlign="center">
                                    <Typography variant="caption" color="text.secondary">คงเหลือ</Typography>
                                    <Typography fontWeight={700} color={isPre ? "warning.main" : totalStock > 0 ? "success.main" : "error.main"}>
                                        {isPre ? "∞" : totalStock}
                                    </Typography>
                                </Box>
                                <Box textAlign="center">
                                    <Typography variant="caption" color="text.secondary">จองแล้ว</Typography>
                                    <Typography fontWeight={700}>{isPre ? sumPaid(p.variants) : sumLocked(p.variants)}</Typography>
                                </Box>
                                <Box textAlign="center">
                                    <Typography variant="caption" color="text.secondary">ขายแล้ว</Typography>
                                    <Typography fontWeight={700} color="primary.main">{sumPaid(p.variants)}</Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                        
                        <Stack direction="row" sx={{ p: 1.5, pt: 0 }}>
                            <Button fullWidth variant="outlined" startIcon={<Edit />} onClick={()=>openEdit(p)} sx={{ mr: 1, borderRadius: 2 }}>แก้ไข</Button>
                            <Button fullWidth variant="outlined" startIcon={<ListAltIcon />} onClick={()=>setStockDlg(p)} sx={{ borderRadius: 2 }}>สต๊อก</Button>
                        </Stack>
                     </Card>
                 </Grid>
             );
         })}
      </Grid>
      
      {/* Create / Edit Dialog */}
      <Dialog open={!!editing} onClose={()=>!saving && setEditing(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2 }}>
              <Typography variant="h6" fontWeight={800}>{editing?._id ? "แก้ไขสินค้า" : "สร้างสินค้าใหม่"}</Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
             <Tabs value={tabIndex} onChange={(_,v)=>setTabIndex(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Tab label="1. ข้อมูลทั่วไป" />
                <Tab label={`2. ตัวเลือกสินค้า (${editing?.variants?.length || 0})`} />
                <Tab label={`3. รูปภาพ (${editing?.imageUrls?.length || 0})`} disabled={!editing?._id} />
             </Tabs>

             {/* Tab 0: General Info */}
             {tabIndex === 0 && (
                <Stack spacing={2} sx={{ p: 3 }}>
                    <TextField label="ชื่อสินค้า" fullWidth value={editing?.name} onChange={e=>setEditing({...editing, name: e.target.value})} autoFocus />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField select label="หมวดหมู่" fullWidth value={editing?.category} onChange={e=>setEditing({...editing, category: e.target.value})}>
                            <MenuItem value="">ไม่ระบุ</MenuItem>
                            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </TextField>
                        <TextField label="รหัสสินค้า (Optional)" fullWidth value={editing?.productCode||""} onChange={e=>setEditing({...editing, productCode: e.target.value})} />
                    </Stack>
                    <TextField label="รายละเอียด" multiline rows={3} value={editing?.description} onChange={e=>setEditing({...editing, description: e.target.value})} />
                    
                    <Typography variant="subtitle2" fontWeight={700} mt={1}>การตั้งค่าการขาย</Typography>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mb={2}>
                             <FormControlLabel control={<Switch checked={!!editing?.isActive} onChange={e=>setEditing({...editing, isActive: e.target.checked})} color="success" />} label="เปิดขาย (Active)" />
                             <FormControlLabel control={<Switch checked={!!editing?.preorder} onChange={e=>setEditing({...editing, preorder: e.target.checked})} color="warning" />} label="สินค้า Preorder (สต๊อกไม่จำกัด)" />
                        </Stack>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField type="date" label="เริ่มขาย" InputLabelProps={{shrink:true}} value={editing?.availableFrom||""} onChange={e=>setEditing({...editing, availableFrom: e.target.value})} size="small" />
                            <Typography>-</Typography>
                            <TextField type="date" label="สิ้นสุด" InputLabelProps={{shrink:true}} value={editing?.availableTo||""} onChange={e=>setEditing({...editing, availableTo: e.target.value})} size="small" />
                        </Stack>
                    </Paper>
                </Stack>
             )}

             {/* Tab 1: Variants */}
             {tabIndex === 1 && (
                <Box sx={{ p: 3 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>กำหนดขนาด สี และราคาของสินค้า (ต้องมีอย่างน้อย 1 รายการ)</Alert>
                    <Table size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell width="25%">Size</TableCell>
                                <TableCell width="25%">Color</TableCell>
                                <TableCell width="20%">Price</TableCell>
                                <TableCell width="20%">Stock</TableCell>
                                <TableCell width="10%"></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(editing?.variants || []).map((v, i) => (
                                <TableRow key={i}>
                                    <TableCell><TextField size="small" fullWidth value={v.size} onChange={e=>updateVariant(i, 'size', e.target.value)} placeholder="เช่น S, M, L" /></TableCell>
                                    <TableCell><TextField size="small" fullWidth value={v.color||""} onChange={e=>updateVariant(i, 'color', e.target.value)} placeholder="เช่น แดง, ดำ" /></TableCell>
                                    <TableCell><TextField size="small" type="number" fullWidth value={v.price} onChange={e=>updateVariant(i, 'price', +e.target.value)} /></TableCell>
                                    <TableCell><TextField size="small" type="number" fullWidth value={v.stock} onChange={e=>updateVariant(i, 'stock', +e.target.value)} disabled={!!editing?.preorder} /></TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" color="error" onClick={()=>{
                                            const nv = [...(editing?.variants||[])]; nv.splice(i,1);
                                            setEditing({...editing, variants: nv});
                                        }}><Delete fontSize="small" /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Button startIcon={<AddBoxIcon />} sx={{ mt: 1 }} onClick={()=>setEditing({...editing, variants: [...(editing?.variants||[]), {size:"", color:"", price:0, stock:0}]})}>
                        เพิ่มตัวเลือก
                    </Button>
                </Box>
             )}

             {/* Tab 2: Images */}
             {tabIndex === 2 && (
                 <Box sx={{ p: 3 }}>
                     <Stack direction="row" spacing={1} mb={2}>
                        <Button component="label" variant="contained" startIcon={<PhotoCamera />}>
                            เลือกรูปภาพ
                            <input type="file" hidden multiple accept="image/*" onChange={e=>setUploadFiles(e.target.files)} />
                        </Button>
                        <Button variant="outlined" onClick={handleUpload} disabled={!uploadFiles?.length}>อัปโหลด ({uploadFiles?.length || 0})</Button>
                     </Stack>
                     
                     <Grid container spacing={2}>
                         {editing?.imageUrls?.map(u => (
                             <Grid item xs={6} sm={4} md={3} key={u}>
                                 <Box sx={{ position: 'relative', paddingTop: '100%' }}>
                                     <Box component="img" src={u} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, border: '1px solid #eee' }} />
                                     <IconButton size="small" onClick={()=>handleDeleteImage(u)} sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.9)', color: 'error.main', '&:hover': { bgcolor: '#fff' } }}>
                                         <Delete fontSize="small" />
                                     </IconButton>
                                 </Box>
                             </Grid>
                         ))}
                     </Grid>
                     {!editing?.imageUrls?.length && <Typography align="center" color="text.secondary" my={4}>ยังไม่มีรูปภาพ</Typography>}
                 </Box>
             )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              {editing?._id && <Button color="error" onClick={()=>setConfirmDel(editing as Product)} sx={{ mr: 'auto' }}>ลบสินค้านี้</Button>}
              <Button onClick={()=>setEditing(null)} color="inherit">ปิด</Button>
              <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={<SaveIcon />}>บันทึกข้อมูล</Button>
          </DialogActions>
      </Dialog>

      {/* Stock Dialog */}
      <Dialog open={!!stockDlg} onClose={()=>setStockDlg(null)} maxWidth="sm" fullWidth>
         <DialogTitle>📦 เช็คสต๊อก: {stockDlg?.name}</DialogTitle>
         <DialogContent dividers>
             <Table size="small">
                 <TableHead><TableRow><TableCell>แบบ</TableCell><TableCell align="right">ราคา</TableCell><TableCell align="right">คงเหลือ</TableCell><TableCell align="right">จอง</TableCell><TableCell align="right">ขายแล้ว</TableCell></TableRow></TableHead>
                 <TableBody>
                     {stockDlg?.variants.map((v, i) => (
                         <TableRow key={i}>
                             <TableCell>{v.size} {v.color && `(${v.color})`}</TableCell>
                             <TableCell align="right">{v.price.toLocaleString()}</TableCell>
                             <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{stockDlg.preorder ? '∞' : v.stock}</TableCell>
                             <TableCell align="right">{stockDlg.preorder ? v.paidQty : v.locked}</TableCell>
                             <TableCell align="right">{v.paidQty}</TableCell>
                         </TableRow>
                     ))}
                 </TableBody>
             </Table>
         </DialogContent>
         <DialogActions><Button onClick={()=>setStockDlg(null)}>ปิด</Button></DialogActions>
      </Dialog>
      
      {/* Delete Confirm */}
      <Dialog open={!!confirmDel} onClose={()=>setConfirmDel(null)}>
          <DialogTitle>ยืนยันการลบ?</DialogTitle>
          <DialogContent>คุณต้องการลบสินค้า <b>{confirmDel?.name}</b> ใช่หรือไม่?</DialogContent>
          <DialogActions>
              <Button onClick={()=>setConfirmDel(null)}>ยกเลิก</Button>
              <Button onClick={handleDelete} variant="contained" color="error">ลบสินค้า</Button>
          </DialogActions>
      </Dialog>

      {/* Fullscreen Image Preview */}
      <Dialog open={!!previewImages} onClose={()=>setPreviewImages(null)} maxWidth="lg" PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}>
          {previewImages && (
              <Box position="relative" display="flex" justifyContent="center">
                  <Box component="img" src={previewImages[currImgIdx]} sx={{ maxHeight: '85vh', maxWidth: '100%', borderRadius: 2 }} />
                  {previewImages.length > 1 && (
                      <>
                        <IconButton onClick={()=>setCurrImgIdx(currImgIdx > 0 ? currImgIdx-1 : previewImages.length-1)} sx={{ position: 'absolute', left: 0, top: '50%', color: 'white', bgcolor: 'rgba(0,0,0,0.5)' }}><ArrowBackIcon /></IconButton>
                        <IconButton onClick={()=>setCurrImgIdx(currImgIdx < previewImages.length-1 ? currImgIdx+1 : 0)} sx={{ position: 'absolute', right: 0, top: '50%', color: 'white', bgcolor: 'rgba(0,0,0,0.5)' }}><ArrowForwardIcon /></IconButton>
                      </>
                  )}
              </Box>
          )}
      </Dialog>
    </Box>
  );
}