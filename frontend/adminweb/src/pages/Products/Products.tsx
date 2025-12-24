import { useEffect, useMemo, useState } from "react";
import {
  Box, Grid, Paper, Typography, Card, CardMedia, CardContent, Chip, Stack, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, IconButton,
  Divider, Tooltip, Skeleton, InputAdornment, MenuItem, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow
} from "@mui/material";
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
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }

type Variant = {
  _id?: string;
  size: string;
  color?: string;
  price: number;
  stock: number;
  locked?: number;
  paidQty?: number; // ✅ ยอดขายจริง (จาก SaleHistory) — ใช้แสดง “ขายแล้ว”
};
type Product = {
  _id: string;
  productCode?: string;
  name: string;
  description?: string;
  category?: string;
  preorder?: boolean;       // ∞ เฉพาะ Preorder
  images?: string[];
  imageUrls?: string[];
  availableFrom?: string;   // ISO
  availableTo?: string;     // ISO
  isActive?: boolean;
  variants: Variant[];
  createdAt?: string;
  updatedAt?: string;
};

/* ----------------------------- helpers ----------------------------- */
const fmtDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const fmtDateShow = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("th-TH", { day:"2-digit", month:"short", year:"numeric" }) : "-";
const sumStock = (v?: Variant[]) => (v || []).reduce((s, x) => s + (x.stock || 0), 0);
const sumLocked = (v?: Variant[]) => (v || []).reduce((s, x) => s + (x.locked || 0), 0);
const sumPaid   = (v?: Variant[]) => (v || []).reduce((s, x) => s + (x.paidQty || 0), 0);

const now = () => Date.now();
const isAfter = (iso?: string) => (iso ? now() > new Date(iso).getTime() : false);
const isBefore = (iso?: string) => (iso ? now() < new Date(iso).getTime() : false);

const hasSaleWindow = (p: Product) => !!p.availableFrom || !!p.availableTo;

const saleState = (p: Product) => {
  if (!hasSaleWindow(p)) return "no-window";          // ไม่กำหนดช่วง
  if (p.availableFrom && isBefore(p.availableFrom)) return "before"; // ยังไม่เปิด
  if (p.availableTo && isAfter(p.availableTo))   return "after";     // ปิดแล้ว
  return "during";                                   // กำลังขาย
};

const isInfiniteStock = (p: Product) => !!p.preorder;

/** filename จาก public URL */
const filenameFromUrl = (u: string) => {
  try {
    const path = new URL(u, window.location.origin).pathname;
    const seg = path.split("/").pop() || "";
    return decodeURIComponent(seg);
  } catch {
    const seg = (u || "").split("/").pop() || "";
    return decodeURIComponent(seg);
  }
};

const categories = ["เสื้อยืด","เสื้อโปโล","หมวก","กระเป๋า","ของที่ระลึก","อื่น ๆ"];

/* ----------------------------- component ----------------------------- */
export default function Products() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("ALL");
  const [onlyActive, setOnlyActive] = useState<"all"|"active"|"inactive">("all");
  const [onlyPre, setOnlyPre] = useState<"all"|"pre"|"nonpre">("all");

  // dialogs
  const [openUpload, setOpenUpload] = useState<string | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  const [editing, setEditing] = useState<null | Partial<Product>>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);

  // stock dialog
  const [stockDlg, setStockDlg] = useState<Product | null>(null);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      // ✅ endpoint inventory จะมี paidQty ต่อ variant
      const res = await fetch(`${API}/products/inventory`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setErr("โหลดข้อมูลสินค้าไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const list = items || [];
    return list
      .filter(p => !q
        || p.name?.toLowerCase().includes(q.toLowerCase())
        || p.productCode?.toLowerCase().includes(q.toLowerCase())
        || (p.category || "").toLowerCase().includes(q.toLowerCase()))
      .filter(p => cat === "ALL" ? true : (p.category === cat))
      .filter(p => onlyActive === "all" ? true : (onlyActive === "active" ? !!p.isActive : !p.isActive))
      .filter(p => onlyPre === "all" ? true : (onlyPre === "pre" ? !!p.preorder : !p.preorder));
  }, [items, q, cat, onlyActive, onlyPre]);

  /* ----------------------------- upload images ----------------------------- */
  const onUpload = async () => {
    if (!openUpload || !files?.length) return;
    setMsg(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("files", f)); // field: files
      const res = await fetch(`${API}/products/${openUpload}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "อัปโหลดไม่สำเร็จ");
      await load();
      setOpenUpload(null);
      setFiles(null);
      setMsg("อัปโหลดรูปสำเร็จ");
    } catch (e: any) {
      setMsg(e?.message || "อัปโหลดไม่สำเร็จ");
    }
  };

  /** ลบรูปเป็นรายไฟล์ */
  const deleteImage = async (productId: string, url: string) => {
    const name = filenameFromUrl(url);
    if (!name) return;
    if (!confirm(`ลบรูปนี้ออกจากสินค้าใช่ไหม?\n${name}`)) return;
    try {
      const res = await fetch(`${API}/products/${productId}/images/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "ลบรูปไม่สำเร็จ");
      setMsg("ลบรูปเรียบร้อย");
      await load();
    } catch (e:any) {
      setMsg(e?.message || "ลบรูปไม่สำเร็จ");
    }
  };

  /* ----------------------------- quick toggle active ----------------------------- */
  const toggleActive = async (p: Product) => {
    const old = p.isActive;
    setItems(list => (list || []).map(x => x._id === p._id ? { ...x, isActive: !old } : x));
    try {
      const res = await fetch(`${API}/products/${p._id}`, {
        method: "PUT",
        headers: { "Content-Type":"application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ isActive: !old })
      });
      if (!res.ok) throw new Error((await res.json())?.error || "อัปเดตสถานะไม่สำเร็จ");
    } catch (e:any) {
      setItems(list => (list || []).map(x => x._id === p._id ? { ...x, isActive: old } : x));
      setMsg(e?.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  /* ----------------------------- create / edit dialog ----------------------------- */
  const openCreate = () => {
    setEditing({
      name: "",
      description: "",
      category: "",
      preorder: false,
      availableFrom: "",
      availableTo: "",
      isActive: true,
      variants: [{ size: "F", color: "-", price: 0, stock: 0 }]
    });
  };
  const openEdit = (p: Product) => {
    setEditing({
      ...p,
      availableFrom: fmtDateInput(p.availableFrom),
      availableTo: fmtDateInput(p.availableTo),
    });
  };
  const closeEdit = () => setEditing(null);

  const updateEditing = (patch: Partial<Product>) => setEditing(prev => ({ ...(prev || {}), ...patch }));
  const updateVariant = (idx: number, patch: Partial<Variant>) => {
    const v = [...(editing?.variants || [])];
    v[idx] = { ...v[idx], ...patch };
    updateEditing({ variants: v });
  };
  const addVariant = () => updateEditing({ variants: [ ...(editing?.variants || []), { size:"", color:"", price:0, stock:0 } ] });
  const removeVariant = (idx: number) => {
    const v = [...(editing?.variants || [])];
    v.splice(idx, 1);
    updateEditing({ variants: v.length ? v : [{ size:"", color:"", price:0, stock:0 }] });
  };

  const saveProduct = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { setMsg("กรุณากรอกชื่อสินค้า"); return; }
    if (!editing.variants || editing.variants.length === 0) { setMsg("ต้องมีอย่างน้อย 1 variant"); return; }
    if (editing.variants.some(v => !v.size || v.price == null)) { setMsg("กรอก size และ price ของ variant ให้ครบ"); return; }

    setSaving(true);
    setMsg(null);
    try {
      const body = {
        name: editing.name,
        description: editing.description || "",
        category: editing.category || "",
        preorder: !!editing.preorder,
        availableFrom: editing.availableFrom ? new Date(editing.availableFrom).toISOString() : undefined,
        availableTo: editing.availableTo ? new Date(editing.availableTo).toISOString() : undefined,
        isActive: editing.isActive !== false,
        variants: (editing.variants || []).map(v => ({
          size: v.size, color: (v.color || "").trim() || undefined,
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
      if (!res.ok) throw new Error(data?.error || (isEdit ? "อัปเดตไม่สำเร็จ" : "สร้างไม่สำเร็จ"));
      setMsg(isEdit ? "บันทึกการแก้ไขเรียบร้อย" : "สร้างสินค้าเรียบร้อย");
      setEditing(null);
      await load();
    } catch (e:any) {
      setMsg(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------- delete product ----------------------------- */
  const doDelete = async () => {
    if (!confirmDel) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/products/${confirmDel!._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "ลบสินค้าไม่สำเร็จ");
      setConfirmDel(null);
      setMsg("ลบสินค้าเรียบร้อย");
      await load();
    } catch (e:any) {
      setMsg(e?.message || "ลบสินค้าไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------- UI ----------------------------- */
  return (
    <Box p={{ xs: 2, md: 3 }}
      sx={{
        background:
          "radial-gradient(1200px 500px at -10% -10%, rgba(2,132,199,.08), transparent 60%), radial-gradient(900px 380px at 110% 10%, rgba(7,193,96,.08), transparent 60%)",
        borderRadius: 3
      }}
    >
      {/* Header */}
      <Paper elevation={0} sx={{
        p: 2, mb: 2, borderRadius: 3,
        background: "linear-gradient(135deg, rgba(7,193,96,.06), rgba(25,118,210,.06))",
        border: "1px solid rgba(2,132,199,.12)"
      }}>
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs:"flex-start", md:"center" }} justifyContent="space-between" spacing={1.5}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Inventory2Icon />
            <Typography variant="h5" fontWeight={900}>สินค้า</Typography>
            <Chip size="small" label={`${filtered.length.toLocaleString()} รายการ`} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ListAltIcon />} variant="outlined" component={Link} to="/inventory">
              หน้าสต๊อกทั้งหมด
            </Button>
            <Button startIcon={<Refresh />} variant="outlined" onClick={load}>รีเฟรช</Button>
            <Button startIcon={<AddBoxIcon />} variant="contained" onClick={openCreate}>
              เพิ่มสินค้า
            </Button>
          </Stack>
        </Stack>

        {/* Filters */}
        <Divider sx={{ my: 1.5 }} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} alignItems={{ xs:"stretch", md:"center" }} flexWrap="wrap">
          <TextField
            size="small" placeholder="ค้นหา (ชื่อ / โค้ด / หมวดหมู่)" value={q} onChange={e=>setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ minWidth: 260 }}
          />
          <TextField
            select size="small" label="หมวดหมู่" value={cat} onChange={e=>setCat(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="ALL">ทั้งหมด</MenuItem>
            {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField
            select size="small" label="สถานะ" value={onlyActive} onChange={e=>setOnlyActive(e.target.value as any)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">ทั้งหมด</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField
            select size="small" label="Preorder" value={onlyPre} onChange={e=>setOnlyPre(e.target.value as any)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">ทั้งหมด</MenuItem>
            <MenuItem value="pre">เฉพาะ Preorder</MenuItem>
            <MenuItem value="nonpre">ไม่ใช่ Preorder</MenuItem>
          </TextField>
          <Box flex={1} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              color="success"
              icon={<WarehouseIcon />}
              label={
                `พร้อมขายรวม: ${
                  filtered.reduce((s,p)=> s + (p.preorder ? 0 : sumStock(p.variants)), 0)
                  .toLocaleString()
                } ชิ้น`
              }
              variant="outlined"
            />
            <Chip
              size="small"
              icon={<ListAltIcon />}
              label={`จองไว้รวม: ${
                filtered.reduce((s,p)=> s + (p.preorder ? sumPaid(p.variants) : sumLocked(p.variants)), 0)
                .toLocaleString()
              } ชิ้น`}
              variant="outlined"
            />
            {/* ✅ แสดงขายแล้วรวม */}
            <Chip
              size="small"
              color="primary"
              icon={<PriceCheckIcon />}
              label={`ขายแล้วรวม: ${
                filtered.reduce((s,p)=> s + sumPaid(p.variants), 0).toLocaleString()
              } ชิ้น`}
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>

      {msg && <Alert sx={{ mb: 2 }} severity="info">{msg}</Alert>}
      {err && <Alert sx={{ mb: 2 }} severity="error">{err}</Alert>}

      {/* Grid */}
      <Grid container spacing={2}>
        {loading && Array.from({ length: 6 }).map((_,i)=>(
          <Grid key={i} item xs={12} sm={6} md={4}>
            <Paper sx={{ p: 2, height: 300, borderRadius: 3 }}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2, mb: 1 }} />
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="80%" />
            </Paper>
          </Grid>
        ))}

        {!loading && filtered.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
              <Typography color="text.secondary">ไม่พบรายการ</Typography>
            </Paper>
          </Grid>
        )}

        {!loading && filtered.map(p => {
          const cover = p.imageUrls?.[0] || "https://via.placeholder.com/800x500?text=No+Image";
          const sState = saleState(p);
          const sumAvail = sumStock(p.variants);
          const sumHold  = p.preorder ? sumPaid(p.variants) : sumLocked(p.variants);
          const totalSold = sumPaid(p.variants);
          return (
            <Grid key={p._id} item xs={12} sm={6} md={4}>
              <Card sx={{ borderRadius: 3, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ position: "relative" }}>
                  <CardMedia
                    component="img" height={180} image={cover}
                    onError={(e:any)=>{e.currentTarget.src="https://via.placeholder.com/800x500?text=No+Image"}}
                  />
                  {sState === "after" && (
                    <Chip color="default" label="ปิดการขาย" size="small" sx={{ position: "absolute", top: 8, left: 8, fontWeight: 800 }} />
                  )}
                  {sState === "before" && (
                    <Chip color="warning" label="ยังไม่เปิดขาย" size="small" sx={{ position: "absolute", top: 8, left: 8, fontWeight: 800 }} />
                  )}
                  {sState === "during" && (
                    <Chip color="success" label="กำลังขาย" size="small" sx={{ position: "absolute", top: 8, left: 8, fontWeight: 800 }} />
                  )}
                </Box>

                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography fontWeight={900} noWrap title={p.name}>{p.name}</Typography>
                    <Chip size="small" variant="outlined" label={p.productCode || "-"} />
                  </Stack>
                  {p.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .25 }} noWrap title={p.description}>
                      {p.description}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={.5} mt={1} flexWrap="wrap">
                    {p.category && <Chip size="small" icon={<CategoryIcon />} label={p.category} variant="outlined" />}
                    {p.preorder && <Chip size="small" color="warning" icon={<LocalOffer />} label="Preorder (∞)" />}
                    <Chip
                      size="small"
                      color={p.isActive ? "success" : "default"}
                      icon={p.isActive ? <CheckCircle /> : <Cancel />}
                      label={p.isActive ? "Active" : "Inactive"}
                      variant={p.isActive ? "filled" : "outlined"}
                    />
                    {(p.availableFrom || p.availableTo) && (
                      <Chip size="small" variant="outlined" label={`วางขาย: ${fmtDateShow(p.availableFrom)} → ${fmtDateShow(p.availableTo)}`} />
                    )}
                  </Stack>

                  {/* สรุปสต๊อกย่อ */}
                  <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<WarehouseIcon />}
                      label={p.preorder ? "พร้อมขาย: ∞" : `พร้อมขาย: ${sumAvail.toLocaleString()}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<ListAltIcon />}
                      label={`จองไว้: ${sumHold.toLocaleString()}`}
                    />
                    {/* ✅ แสดงขายแล้วรวมต่อสินค้า */}
                    <Chip
                      size="small"
                      variant="outlined"
                      color="primary"
                      icon={<PriceCheckIcon />}
                      label={`ขายแล้ว: ${totalSold.toLocaleString()}`}
                    />
                  </Stack>

                  {/* แกลลอรี่รูป + ปุ่มลบรายไฟล์ */}
                  {p.imageUrls && p.imageUrls.length > 0 && (
                    <Stack direction="row" spacing={1} mt={1} sx={{ overflowX: "auto" }}>
                      {p.imageUrls.map((u) => (
                        <Box key={u} sx={{ position: "relative", display: "inline-block" }}>
                          <img src={u} alt="" height={50} style={{ borderRadius: 6, border: "1px solid #eee" }} />
                          <IconButton
                            size="small"
                            onClick={()=>deleteImage(p._id!, u)}
                            sx={{ position: "absolute", top: -8, right: -8, bgcolor: "rgba(0,0,0,.5)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,.65)" } }}
                          >
                            <CloseIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>

                {/* Actions */}
                <Box px={2} pb={2}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="อัปโหลดรูป">
                        <span>
                          <Button size="small" variant="outlined" startIcon={<PhotoCamera />} onClick={()=>setOpenUpload(p._id!)}>
                            รูป
                          </Button>
                        </span>
                      </Tooltip>
                      <Button size="small" variant="outlined" startIcon={<Edit />} onClick={()=>openEdit(p)}>
                        แก้ไข
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<WarehouseIcon />}
                        onClick={()=>setStockDlg(p)}
                      >
                        ดูสต๊อก
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControlLabel
                        label={<Typography variant="caption">{p.isActive ? "Active" : "Inactive"}</Typography>}
                        control={<Switch checked={!!p.isActive} onChange={()=>toggleActive(p)} color="success" />}
                      />
                      <Tooltip title="ลบสินค้า">
                        <span>
                          <IconButton onClick={()=>setConfirmDel(p)} color="error">
                            <Delete />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Upload dialog */}
      <Dialog open={Boolean(openUpload)} onClose={()=>{setOpenUpload(null); setFiles(null);}} maxWidth="sm" fullWidth>
        <DialogTitle>อัปโหลดรูปสินค้า</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1}>
            รองรับเลือกหลายไฟล์ (สูงสุด 10) • field: <b>files</b>
          </Typography>
          <input type="file" multiple accept="image/*" onChange={e=>setFiles(e.target.files)} />
          <Alert sx={{ mt: 1 }} severity="info">
            หลังอัปโหลด ระบบจะเพิ่มชื่อไฟล์ลง <code>images</code> และส่ง <code>imageUrls</code> กลับมาเพื่อแสดงผล
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>{setOpenUpload(null); setFiles(null);}}>ยกเลิก</Button>
          <Button variant="contained" onClick={onUpload} disabled={!files?.length}>อัปโหลด</Button>
        </DialogActions>
      </Dialog>

      {/* Stock detail dialog */}
      <Dialog open={!!stockDlg} onClose={()=>setStockDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle>สต๊อกสินค้า — {stockDlg?.name}</DialogTitle>
        <DialogContent>
          {stockDlg && (
            <>
              <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<WarehouseIcon />}
                  label={stockDlg.preorder ? "พร้อมขาย: ∞" : `พร้อมขาย: ${sumStock(stockDlg.variants).toLocaleString()}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<ListAltIcon />}
                  label={`จองไว้: ${
                    (stockDlg.preorder ? sumPaid(stockDlg.variants) : sumLocked(stockDlg.variants)).toLocaleString()
                  }`}
                />
                {/* ✅ แสดงขายแล้วรวมใน dialog */}
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  icon={<PriceCheckIcon />}
                  label={`ขายแล้ว: ${sumPaid(stockDlg.variants).toLocaleString()}`}
                />
              </Stack>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Size</TableCell>
                    <TableCell>Color</TableCell>
                    <TableCell align="right">ราคา</TableCell>
                    <TableCell align="right">พร้อมขาย</TableCell>
                    <TableCell align="right">จองไว้</TableCell>
                    <TableCell align="right">ขายแล้ว</TableCell>{/* ✅ คอลัมน์ใหม่ */}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockDlg.variants.map((v, i) => (
                    <TableRow key={v._id || i}>
                      <TableCell>{v.size || "-"}</TableCell>
                      <TableCell>{v.color || "-"}</TableCell>
                      <TableCell align="right">{(v.price || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{stockDlg.preorder ? "∞" : (v.stock || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">{(stockDlg.preorder ? (v.paidQty || 0) : (v.locked || 0)).toLocaleString()}</TableCell>
                      <TableCell align="right">{(v.paidQty || 0).toLocaleString()}</TableCell>{/* ✅ แสดงขายแล้วแยกไซส์ */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setStockDlg(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={!!editing} onClose={closeEdit} maxWidth="md" fullWidth>
        <DialogTitle>{editing?._id ? "แก้ไขสินค้า" : "สร้างสินค้าใหม่"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: .5 }}>
            <Stack direction={{ xs:"column", md:"row" }} spacing={1.25}>
              <TextField label="ชื่อสินค้า" fullWidth value={editing?.name || ""} onChange={e=>updateEditing({ name: e.target.value })} />
              <TextField select label="หมวดหมู่" fullWidth value={editing?.category || ""} onChange={e=>updateEditing({ category: e.target.value })}>
                <MenuItem value="">(ไม่ระบุ)</MenuItem>
                {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Stack>

            <TextField label="รายละเอียด" multiline minRows={2} value={editing?.description || ""} onChange={e=>updateEditing({ description: e.target.value })} placeholder="ข้อมูลเพิ่มเติม/คุณสมบัติ" />

            <Stack direction={{ xs:"column", md:"row" }} spacing={1.25}>
              <TextField label="เริ่มวางขาย" type="date" InputLabelProps={{ shrink: true }} value={editing?.availableFrom || ""} onChange={e=>updateEditing({ availableFrom: e.target.value })} fullWidth />
              <TextField label="สิ้นสุดวางขาย" type="date" InputLabelProps={{ shrink: true }} value={editing?.availableTo || ""} onChange={e=>updateEditing({ availableTo: e.target.value })} fullWidth />
            </Stack>

            <Stack direction={{ xs:"column", sm:"row" }} spacing={2} alignItems="center">
              <FormControlLabel control={<Switch checked={!!editing?.preorder} onChange={e=>updateEditing({ preorder: e.target.checked })} />} label="Preorder (สต๊อก ∞)" />
              <FormControlLabel control={<Switch checked={editing?.isActive !== false} onChange={e=>updateEditing({ isActive: e.target.checked })} />} label="Active" />
              {editing?.productCode && <Chip size="small" label={`Code: ${editing.productCode}`} />}
            </Stack>

            {/* Variants */}
            <Divider />
            <Typography fontWeight={900}>ตัวเลือก (Variants)</Typography>
            <Alert severity="info">กรอก <b>Size</b> และ <b>Price</b> ให้ครบ — Color ไม่กรอกได้ (จะเป็น "-")</Alert>

            {(editing?.variants || []).map((v, idx) => (
              <Stack key={idx} direction={{ xs:"column", md:"row" }} spacing={1} alignItems="center">
                <TextField label="Size" value={v.size || ""} onChange={e=>updateVariant(idx, { size: e.target.value })} sx={{ minWidth: 120 }} />
                <TextField label="Color" value={v.color || ""} onChange={e=>updateVariant(idx, { color: e.target.value })} sx={{ minWidth: 160 }} />
                <TextField label="Price" type="number" value={v.price ?? 0} onChange={e=>updateVariant(idx, { price: +e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start">฿</InputAdornment> }} />
                <TextField label="Stock" type="number" value={v.stock ?? 0} onChange={e=>updateVariant(idx, { stock: +e.target.value })} helperText={editing?.preorder ? "Preorder: ถือเป็น ∞" : "สต๊อกปกติ"} />
                <IconButton onClick={()=>removeVariant(idx)} color="error"><Delete /></IconButton>
              </Stack>
            ))}
            <Button variant="outlined" onClick={addVariant} startIcon={<AddBoxIcon />}>เพิ่มตัวเลือก</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveProduct} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDel} onClose={()=>setConfirmDel(null)}>
        <DialogTitle>ลบสินค้า</DialogTitle>
        <DialogContent>คุณต้องการลบสินค้า <b>{confirmDel?.name}</b> ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</DialogContent>
        <DialogActions>
          <Button onClick={()=>setConfirmDel(null)}>ยกเลิก</Button>
          <Button variant="contained" color="error" onClick={doDelete} disabled={saving}>ลบ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}