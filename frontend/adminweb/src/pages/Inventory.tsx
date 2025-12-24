import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Box, Paper, Typography, Stack, TextField, MenuItem, InputAdornment, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Button, Divider,
  Switch, FormControlLabel
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DownloadIcon from "@mui/icons-material/Download";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CategoryIcon from "@mui/icons-material/Category";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PriceCheckIcon from "@mui/icons-material/PriceCheck";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }

type Variant = { _id?: string; size: string; color?: string; price: number; stock: number; locked?: number; paidQty?: number };
type Product = {
  _id: string;
  productCode?: string;
  name: string;
  category?: string;
  preorder?: boolean;
  availableFrom?: string;
  availableTo?: string;
  isActive?: boolean;
  variants: Variant[];
};

const now = () => Date.now();
const isAfter = (iso?: string) => (iso ? now() > new Date(iso).getTime() : false);
const isBefore = (iso?: string) => (iso ? now() < new Date(iso).getTime() : false);
const hasWindow = (p: Product) => !!p.availableFrom || !!p.availableTo;
const saleState = (p: Product): "no-window"|"before"|"during"|"after" => {
  if (!hasWindow(p)) return "no-window";
  if (p.availableFrom && isBefore(p.availableFrom)) return "before";
  if (p.availableTo && isAfter(p.availableTo))   return "after";
  return "during";
};

type Row = {
  id: string;
  productId: string;
  productName: string;
  productCode?: string;
  category?: string;
  preorder: boolean;
  sale: ReturnType<typeof saleState>;
  active: boolean;
  size: string;
  color?: string;
  price: number;
  stock: number;  // non-preorder เท่านั้น (preorder ถือว่า ∞)
  locked: number; // non-preorder: locked, preorder: paidQty (เพื่อ “จองไว้”)
  sold: number;   // ✅ paidQty เสมอ (ทั้ง pre และ non-pre) — ใช้แสดง “ขายแล้ว”
};

type Group = {
  productId: string;
  productName: string;
  productCode?: string;
  category?: string;
  preorder: boolean;
  sale: Row["sale"];
  active: boolean;
  rows: Row[];
  totals: { stock: number; locked: number; sold: number; minPrice: number; maxPrice: number };
};

export default function Inventory() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState<"all"|"active"|"inactive">("all");
  const [onlyPre, setOnlyPre] = useState<"all"|"pre"|"nonpre">("all");
  const [sale, setSale] = useState<"all"|"during"|"before"|"after"|"no-window">("all");
  const [lowAt, setLowAt] = useState<number>(5);
  const [showLow, setShowLow] = useState<"all"|"low"|"oos">("all");

  const [groupMode, setGroupMode] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // productId -> expanded?

  const [sortKey, setSortKey] = useState<keyof Row>("productName");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/products/inventory`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        const products: Product[] = await res.json();

        const flattened: Row[] = [];
        for (const p of products) {
          const st = saleState(p);
          for (const v of (p.variants || [])) {
            flattened.push({
              id: (v._id as string) || `${p._id}-${v.size}-${v.color || "-"}`,
              productId: p._id,
              productName: p.name,
              productCode: p.productCode,
              category: p.category,
              preorder: !!p.preorder,
              sale: st,
              active: p.isActive !== false,
              size: v.size,
              color: v.color || "-",
              price: Number(v.price || 0),
              stock: Number(v.stock || 0),
              locked: Number(p.preorder ? (v.paidQty || 0) : (v.locked || 0)), // “จองไว้”
              sold: Number(v.paidQty || 0),                                   // ✅ “ขายแล้ว”
            });
          }
        }
        // ตั้งค่า expanded เป็น true ทุก product
        const ex: Record<string, boolean> = {};
        for (const r of flattened) ex[r.productId] = true;
        setExpanded(ex);

        setRows(flattened);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  // ---------- Filter (ยังไม่ sort เพื่อรองรับ group/inner-sort) ----------
  const filteredBase = useMemo(() => {
    let list = rows || [];
    list = list
      .filter(r => !q
        || r.productName.toLowerCase().includes(q.toLowerCase())
        || (r.productCode || "").toLowerCase().includes(q.toLowerCase())
        || (r.category || "").toLowerCase().includes(q.toLowerCase())
        || (r.size || "").toLowerCase().includes(q.toLowerCase())
        || (r.color || "").toLowerCase().includes(q.toLowerCase())
      )
      .filter(r => onlyActive === "all" ? true : (onlyActive === "active" ? r.active : !r.active))
      .filter(r => onlyPre === "all" ? true : (onlyPre === "pre" ? r.preorder : !r.preorder))
      .filter(r => sale === "all" ? true : r.sale === sale)
      .filter(r => {
        if (showLow === "all") return true;
        if (r.preorder) return false; // preorder ไม่สนสต๊อก
        if (showLow === "oos") return r.stock <= 0;
        return r.stock > 0 && r.stock <= lowAt;
      });

    return list;
  }, [rows, q, onlyActive, onlyPre, sale, showLow, lowAt]);

  // ---------- Sort (กรณีไม่จัดกลุ่ม) ----------
  const sortedFlat = useMemo(() => {
    if (!filteredBase) return [];
    const sgn = sortDir === "asc" ? 1 : -1;
    const list = [...filteredBase];
    return list.sort((a,b) => {
      const A: any = a[sortKey]; const B: any = b[sortKey];
      if (typeof A === "number" && typeof B === "number") return (A - B) * sgn;
      return String(A).localeCompare(String(B)) * sgn;
    });
  }, [filteredBase, sortKey, sortDir]);

  // ---------- Group (default: เปิด) ----------
  const groups = useMemo<Group[]>(() => {
    if (!groupMode) return [];
    const map = new Map<string, Group>();
    for (const r of filteredBase) {
      if (!map.has(r.productId)) {
        map.set(r.productId, {
          productId: r.productId,
          productName: r.productName,
          productCode: r.productCode,
          category: r.category,
          preorder: r.preorder,
          sale: r.sale,
          active: r.active,
          rows: [],
          totals: { stock: 0, locked: 0, sold: 0, minPrice: r.price, maxPrice: r.price }
        });
      }
      const g = map.get(r.productId)!;
      g.rows.push(r);
      g.totals.stock += r.preorder ? 0 : r.stock;
      g.totals.locked += r.locked; // preorder = paidQty, non-preorder = locked
      g.totals.sold   += r.sold;   // ✅ รวมขายแล้ว
      g.totals.minPrice = Math.min(g.totals.minPrice, r.price);
      g.totals.maxPrice = Math.max(g.totals.maxPrice, r.price);
      // สถานะรวม
      g.preorder = g.preorder || r.preorder;
      g.active = g.active && r.active;
    }

    // sort กลุ่มตาม productName (หรือ productCode ถ้าเลือก)
    const by = (a: Group, b: Group) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "productCode") return String(a.productCode||"").localeCompare(String(b.productCode||"")) * dir;
      return a.productName.localeCompare(b.productName) * dir;
    };
    const groupsArr = Array.from(map.values()).sort(by);

    // sort แถวภายในกลุ่ม
    const innerKeySet: (keyof Row)[] = ["size","color","price","stock","locked","sold"];
    for (const g of groupsArr) {
      const dir = sortDir === "asc" ? 1 : -1;
      const k = innerKeySet.includes(sortKey) ? sortKey : "size";
      g.rows.sort((a,b)=>{
        const A:any=a[k], B:any=b[k];
        if (typeof A === "number" && typeof B === "number") return (A-B)*dir;
        return String(A).localeCompare(String(B))*dir;
      });
    }

    return groupsArr;
  }, [filteredBase, groupMode, sortKey, sortDir]);

  const totals = useMemo(() => {
    const avail = filteredBase.reduce((s,r)=> s + (r.preorder ? 0 : r.stock), 0);
    const locked = filteredBase.reduce((s,r)=> s + r.locked, 0);
    const sold   = filteredBase.reduce((s,r)=> s + r.sold, 0);
    return { avail, locked, sold, count: filteredBase.length };
  }, [filteredBase]);

  const toggleSort = (key: keyof Row) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportCsv = () => {
    const headers = ["รหัส","สินค้า","หมวด","Preorder","ช่วงขาย","Active","Size","Color","ราคา","พร้อมขาย","จองไว้","ขายแล้ว"]; // ✅ เพิ่ม “ขายแล้ว”
    const list = groupMode ? groups.flatMap(g => g.rows) : sortedFlat;
    const rowsCsv = list.map(r => [
      r.productCode || "-",
      r.productName,
      r.category || "-",
      r.preorder ? "Y" : "N",
      r.sale,
      r.active ? "Y" : "N",
      r.size,
      r.color || "-",
      r.price,
      r.preorder ? "∞" : r.stock,
      r.locked,
      r.sold
    ]);
    const esc = (x: any) => `"${String(x ?? "").replaceAll('"','""')}"`;
    const csv = ["\uFEFF" + headers.join(","), ...rowsCsv.map(r => r.map(esc).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const setAllExpand = (open: boolean) => {
    const ex: Record<string, boolean> = {};
    const list = groupMode ? groups : [];
    for (const g of list) ex[g.productId] = open;
    setExpanded(ex);
  };

  function SortBtn({ active, dir, onClick }: { active: boolean; dir: "asc"|"desc"; onClick: ()=>void }) {
    return (
      <IconButton size="small" onClick={onClick} sx={{ ml: .25 }}>
        {active ? (dir === "asc" ? <ArrowUpwardIcon fontSize="inherit" /> : <ArrowDownwardIcon fontSize="inherit" />) : <ArrowUpwardIcon sx={{ opacity: .2 }} fontSize="inherit" />}
      </IconButton>
    );
  }

  return (
    <Box p={{ xs: 2, md: 3 }}>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 2, border: "1px solid #e5eef7", background: "linear-gradient(180deg,#fff,#fbfdff)" }}>
        <Stack direction={{ xs:"column", md:"row" }} justifyContent="space-between" alignItems={{ xs:"flex-start", md:"center" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <WarehouseIcon />
            <Typography variant="h5" fontWeight={900}>หน้าสต๊อกทั้งหมด</Typography>
            <Chip size="small" label={`${totals.count.toLocaleString()} แถว`} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button component={Link} to="/products" variant="outlined">← กลับสินค้า</Button>
            <Button startIcon={<DownloadIcon />} variant="contained" onClick={exportCsv}>ส่งออก CSV</Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* Filters */}
        <Stack direction={{ xs:"column", md:"row" }} spacing={1.2} alignItems={{ xs:"stretch", md:"center" }} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="ค้นหา (สินค้า / รหัส / หมวด / ไซส์ / สี)"
            value={q}
            onChange={e=>setQ(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            sx={{ minWidth: 280 }}
          />
          <TextField select size="small" label="Active" value={onlyActive} onChange={e=>setOnlyActive(e.target.value as any)}>
            <MenuItem value="all">ทั้งหมด</MenuItem>
            <MenuItem value="active">Active เท่านั้น</MenuItem>
            <MenuItem value="inactive">Inactive เท่านั้น</MenuItem>
          </TextField>
          <TextField select size="small" label="Preorder" value={onlyPre} onChange={e=>setOnlyPre(e.target.value as any)}>
            <MenuItem value="all">ทั้งหมด</MenuItem>
            <MenuItem value="pre">เฉพาะ Preorder</MenuItem>
            <MenuItem value="nonpre">ไม่ใช่ Preorder</MenuItem>
          </TextField>
          <TextField select size="small" label="ช่วงขาย" value={sale} onChange={e=>setSale(e.target.value as any)}>
            <MenuItem value="all">ทั้งหมด</MenuItem>
            <MenuItem value="during">กำลังขาย</MenuItem>
            <MenuItem value="before">ยังไม่เปิดขาย</MenuItem>
            <MenuItem value="after">ปิดการขายแล้ว</MenuItem>
            <MenuItem value="no-window">ไม่ได้กำหนดช่วง</MenuItem>
          </TextField>

          <Chip icon={<FilterAltIcon />} label="สต๊อก" size="small" variant="outlined" />
          <TextField select size="small" value={showLow} onChange={e=>setShowLow(e.target.value as any)}>
            <MenuItem value="all">ทั้งหมด</MenuItem>
            <MenuItem value="low">ต่ำกว่าเกณฑ์</MenuItem>
            <MenuItem value="oos">หมดสต๊อก</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="number"
            label="เกณฑ์ต่ำกว่า (≤)"
            value={lowAt}
            onChange={e=>setLowAt(Math.max(0, parseInt(e.target.value||"0")))}
            disabled={showLow !== "low"}
            sx={{ width: 150 }}
          />

          {/* Group switch */}
          <FormControlLabel
            sx={{ ml: 1 }}
            control={<Switch checked={groupMode} onChange={e=>setGroupMode(e.target.checked)} color="primary" />}
            label="จัดกลุ่มตามสินค้า"
          />

          <Box flex={1} />
          <Stack direction="row" spacing={1}>
            <Chip variant="outlined" color="success" icon={<WarehouseIcon />} label={`พร้อมขายรวม: ${totals.avail.toLocaleString()} ชิ้น`} />
            <Chip variant="outlined" icon={<ListAltIcon />} label={`จองไว้รวม: ${totals.locked.toLocaleString()} ชิ้น`} />
            {/* ✅ แสดงขายแล้วรวม */}
            <Chip variant="outlined" color="primary" icon={<PriceCheckIcon />} label={`ขายแล้วรวม: ${totals.sold.toLocaleString()} ชิ้น`} />
          </Stack>
        </Stack>

        {/* Expand/Collapse when grouped */}
        {groupMode && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" variant="text" startIcon={<ExpandMoreIcon />} onClick={()=>setAllExpand(true)}>ขยายทั้งหมด</Button>
            <Button size="small" variant="text" startIcon={<ExpandLessIcon />} onClick={()=>setAllExpand(false)}>ย่อทั้งหมด</Button>
          </Stack>
        )}
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: "1px solid #e5eef7" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={.5}>
                  รหัส
                  <SortBtn active={sortKey==="productCode"} dir={sortDir} onClick={()=>toggleSort("productCode")} />
                </Stack>
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={.5}>
                  สินค้า
                  <SortBtn active={sortKey==="productName"} dir={sortDir} onClick={()=>toggleSort("productName")} />
                </Stack>
              </TableCell>
              <TableCell><CategoryIcon sx={{ fontSize: 16, mr: .5 }} />หมวด</TableCell>
              <TableCell><LocalOfferIcon sx={{ fontSize: 16, mr: .5 }} />Preorder</TableCell>
              <TableCell><CalendarMonthIcon sx={{ fontSize: 16, mr: .5 }} />ช่วงขาย</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={.5}>
                  Size
                  <SortBtn active={sortKey==="size"} dir={sortDir} onClick={()=>toggleSort("size")} />
                </Stack>
              </TableCell>
              <TableCell>Color</TableCell>
              <TableCell align="right">
                <Stack direction="row" alignItems="center" spacing={.5} justifyContent="flex-end">
                  ราคา
                  <SortBtn active={sortKey==="price"} dir={sortDir} onClick={()=>toggleSort("price")} />
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" alignItems="center" spacing={.5} justifyContent="flex-end">
                  พร้อมขาย
                  <SortBtn active={sortKey==="stock"} dir={sortDir} onClick={()=>toggleSort("stock")} />
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" alignItems="center" spacing={.5} justifyContent="flex-end">
                  จองไว้
                  <SortBtn active={sortKey==="locked"} dir={sortDir} onClick={()=>toggleSort("locked")} />
                </Stack>
              </TableCell>
              {/* ✅ คอลัมน์ใหม่ */}
              <TableCell align="right">
                <Stack direction="row" alignItems="center" spacing={.5} justifyContent="flex-end">
                  ขายแล้ว
                  <SortBtn active={sortKey==="sold"} dir={sortDir} onClick={()=>toggleSort("sold")} />
                </Stack>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {/* ----- Grouped mode ----- */}
            {groupMode && groups.map(g => {
              const saleChip =
                g.sale === "during" ? <Chip size="small" label="กำลังขาย" color="success" />
              : g.sale === "before" ? <Chip size="small" label="ยังไม่เปิดขาย" color="warning" />
              : g.sale === "after" ?  <Chip size="small" label="ปิดการขาย" />
              : <Chip size="small" label="ไม่กำหนดช่วง" variant="outlined" />;

              const priceText = g.totals.minPrice === g.totals.maxPrice
                ? g.totals.minPrice.toLocaleString()
                : `${g.totals.minPrice.toLocaleString()}–${g.totals.maxPrice.toLocaleString()}`;

              const open = expanded[g.productId] ?? true;

              return (
                <Fragment key={g.productId as string}>
                  {/* Group header row */}
                  <TableRow sx={{ bgcolor: "grey.50" }}>
                    <TableCell colSpan={13} sx={{ py: 0.75 }}>
                      <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <IconButton size="small" onClick={()=>setExpanded(prev=>({ ...prev, [g.productId]: !open }))}>
                            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                          <Typography fontWeight={800}>{g.productName}</Typography>
                          <Chip size="small" variant="outlined" label={g.productCode || "-"} />
                          {g.category && <Chip size="small" label={g.category} />}
                          {g.preorder && <Chip size="small" label="Preorder (∞)" color="warning" />}
                          {saleChip}
                          <Chip size="small" label={`ช่วงราคา: ${priceText}`} variant="outlined" />
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Chip size="small" color={g.active ? "success" : "default"} label={g.active ? "Active" : "Inactive"} variant={g.active ? "filled" : "outlined"} />
                          <Chip size="small" variant="outlined" color="success" label={`พร้อมขายรวม: ${g.preorder ? "∞" : g.totals.stock.toLocaleString()}`} />
                          <Chip size="small" variant="outlined" label={`จองไว้รวม: ${g.totals.locked.toLocaleString()}`} />
                          {/* ✅ รวมขายแล้วของกลุ่ม */}
                          <Chip size="small" variant="outlined" color="primary" icon={<PriceCheckIcon />} label={`ขายแล้วรวม: ${g.totals.sold.toLocaleString()}`} />
                        </Stack>
                      </Stack>
                    </TableCell>
                  </TableRow>

                  {/* Group body rows */}
                  {open && g.rows.map(r => {
                    const stockChip =
                      r.preorder ? <Chip size="small" label="∞" color="warning" variant="outlined" />
                      : r.stock <= 0 ? <Chip size="small" label="หมดสต๊อก" color="default" />
                      : r.stock <= lowAt ? <Chip size="small" label={`ต่ำ (${r.stock})`} color="warning" variant="outlined" />
                      : <Chip size="small" label={r.stock.toLocaleString()} variant="outlined" />;

                    return (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.productCode || "-"}</TableCell>
                        <TableCell>{r.productName}</TableCell>
                        <TableCell>{r.category || "-"}</TableCell>
                        <TableCell>{r.preorder ? <Chip size="small" label="Preorder" color="warning" /> : "-"}</TableCell>
                        <TableCell>
                          {r.sale === "during" ? <Chip size="small" label="กำลังขาย" color="success" /> :
                           r.sale === "before" ? <Chip size="small" label="ยังไม่เปิดขาย" color="warning" /> :
                           r.sale === "after" ? <Chip size="small" label="ปิดการขาย" /> :
                           <Chip size="small" label="ไม่กำหนดช่วง" variant="outlined" />}
                        </TableCell>
                        <TableCell>{r.active ? "Y" : "N"}</TableCell>
                        <TableCell>{r.size || "-"}</TableCell>
                        <TableCell>{r.color || "-"}</TableCell>
                        <TableCell align="right">{r.price.toLocaleString()}</TableCell>
                        <TableCell align="right">{stockChip}</TableCell>
                        <TableCell align="right">{r.locked ? r.locked.toLocaleString() : "-"}</TableCell>
                        {/* ✅ แสดงขายแล้วแยกไซส์ */}
                        <TableCell align="right">{r.sold ? r.sold.toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}

            {/* ----- Flat (ไม่จัดกลุ่ม) ----- */}
            {!groupMode && sortedFlat.map(r => {
              const saleChip =
                r.sale === "during" ? <Chip size="small" label="กำลังขาย" color="success" />
              : r.sale === "before" ? <Chip size="small" label="ยังไม่เปิดขาย" color="warning" />
              : r.sale === "after" ?  <Chip size="small" label="ปิดการขาย" />
              : <Chip size="small" label="ไม่กำหนดช่วง" variant="outlined" />;

              const stockChip =
                r.preorder ? <Chip size="small" label="∞" color="warning" variant="outlined" />
                : r.stock <= 0 ? <Chip size="small" label="หมดสต๊อก" color="default" />
                : r.stock <= lowAt ? <Chip size="small" label={`ต่ำ (${r.stock})`} color="warning" variant="outlined" />
                : <Chip size="small" label={r.stock.toLocaleString()} variant="outlined" />;

              return (
                <TableRow key={r.id} hover>
                  <TableCell>{r.productCode || "-"}</TableCell>
                  <TableCell>
                    <Stack spacing={0}>
                      <Typography fontWeight={700} variant="body2">{r.productName}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.productId}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{r.category || "-"}</TableCell>
                  <TableCell>{r.preorder ? <Chip size="small" label="Preorder" color="warning" /> : "-"}</TableCell>
                  <TableCell>{saleChip}</TableCell>
                  <TableCell>{r.active ? "Y" : "N"}</TableCell>
                  <TableCell>{r.size || "-"}</TableCell>
                  <TableCell>{r.color || "-"}</TableCell>
                  <TableCell align="right">{r.price.toLocaleString()}</TableCell>
                  <TableCell align="right">{stockChip}</TableCell>
                  <TableCell align="right">{r.locked ? r.locked.toLocaleString() : "-"}</TableCell>
                  {/* ✅ คอลัมน์ขายแล้ว */}
                  <TableCell align="right">{r.sold ? r.sold.toLocaleString() : "-"}</TableCell>
                </TableRow>
              );
            })}

            {rows && (groupMode ? groups.length === 0 : sortedFlat.length === 0) && (
              <TableRow>
                <TableCell colSpan={12}>
                  <Box p={2}><Typography color="text.secondary">ไม่พบข้อมูลตามเงื่อนไข</Typography></Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}