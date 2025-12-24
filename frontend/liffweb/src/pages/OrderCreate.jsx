// src/pages/OrderCreate.jsx
import { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../api/productApi';
import {
  Box, Typography, Button, TextField, Alert, Paper, Stack,
  Divider, Grid, Chip, Snackbar, IconButton, Badge, Portal,
  Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import { useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CollectionsIcon from '@mui/icons-material/Collections';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';

import { collectImages } from '../utils/img';
import {
  summarizeSizes,
  sortSizes,
  parseSizeChestLen,
  sizeOrderIndex
} from '../utils/size';
import useElementHeight from '../hooks/useElementHeight';

const PLACEHOLDER = 'https://i.pinimg.com/736x/03/00/b0/0300b0434822e05d77bf60d02ccccfe0.jpg';

// ---------- helpers (ไม่ใช่ Hook) ----------
const now = () => Date.now();
const hasWindow = (p) => !!p?.availableFrom || !!p?.availableTo;
const isBefore = (iso) => (iso ? now() < new Date(iso).getTime() : false);
const isAfter  = (iso) => (iso ? now() > new Date(iso).getTime() : false);
const saleState = (p) => {
  if (!hasWindow(p)) return 'no-window';
  if (p.availableFrom && isBefore(p.availableFrom)) return 'before';
  if (p.availableTo && isAfter(p.availableTo))     return 'after';
  return 'during';
};
const isPreorder = (p) => !!p?.preorder;
const money = (n) => Number(n || 0).toLocaleString('th-TH');
const vibe = (ms = 6) => { try { navigator.vibrate?.(ms); } catch {} };

// ---------- หน้า ----------
export default function OrderCreate() {
  const [params] = useSearchParams();
  const [product, setProduct] = useState(null);

  // ปริมาณที่เลือก เก็บเป็น {variantId: qty}
  const [quantities, setQuantities] = useState({});
  // สีที่เลือกต่อ “ไซส์” เก็บเป็น {sizeLabel: variantId}
  const [colorPick, setColorPick] = useState({});
  const [errors, setErrors] = useState({});
  const [addedOpen, setAddedOpen] = useState(false);
  const { add, totals } = useCart();

  // แกลเลอรีรูปสินค้า
  const [activeIdx, setActiveIdx] = useState(0);

  // วัดความสูง footer หลัก + footer หน้านี้
  const appFooterH  = useElementHeight('#app-footer-nav', 64);
  const pageFooterH = useElementHeight('#ordercreate-footer', 72);

  // โหลด product
  useEffect(() => {
    let alive = true;
    (async () => {
      const productId = params.get('productId');
      const list = await getProducts().catch(() => []);
      const p = (Array.isArray(list) ? list : []).find(x => x._id === productId) || null;
      if (!alive) return;
      setProduct(p);
      setActiveIdx(0);
      setQuantities({});
      setColorPick({});
    })();
    return () => { alive = false; };
  }, [params]);

  // อนุพันธ์จาก product (คงลำดับ Hook เสมอ)
  const images = useMemo(() => collectImages(product || {}), [product]);
  const img    = images[activeIdx] || PLACEHOLDER;

  const sState   = useMemo(() => saleState(product || {}), [product]);
  const activeOk = useMemo(() => (product ? product.isActive !== false : true), [product]);
  const timeOk   = useMemo(() => !product || !hasWindow(product) || sState === 'during', [product, sState]);
  const canBuy   = useMemo(() => activeOk && timeOk, [activeOk, timeOk]);

  // ตารางไซส์ (เล็ก→ใหญ่) + แสดงรอบอก/ความยาว (นิ้ว)
  const sizeRows = useMemo(() => sortSizes(summarizeSizes(product || {})), [product]);

  // จัดกลุ่ม “ไซส์ → สีที่มี” เพื่อเรนเดอร์ UI แบบเลือกสีแล้วค่อยใส่จำนวน
  const sizeGroups = useMemo(() => {
    const vs = Array.isArray(product?.variants) ? product.variants : [];
    const map = new Map(); // key: size label
    vs.forEach(v => {
      const dims = parseSizeChestLen(v?.size);
      const label = dims.label || String(v?.size || '').trim();
      if (!label) return;

      if (!map.has(label)) {
        map.set(label, { label, chest: dims.chest ?? null, length: dims.length ?? null, colors: [] });
      } else {
        const g = map.get(label);
        if (g.chest == null && dims.chest != null) g.chest = dims.chest;
        if (g.length == null && dims.length != null) g.length = dims.length;
      }

      const colorKey = (String(v?.color || 'ไม่ระบุสี').trim().toLowerCase());
      const g = map.get(label);
      const existed = g.colors.find(c => String(c.color || '').trim().toLowerCase() === colorKey);
      if (!existed) {
        g.colors.push({
          _id: v._id,
          color: v.color || 'ไม่ระบุสี',
          price: Number(v.price || 0),
          stock: Number(v.stock || 0)
        });
      } else {
        // รวมข้อมูลกรณีระบบมี variant สีเดียวกันหลายตัว
        existed.stock = Math.max(existed.stock, Number(v.stock || 0));
        existed.price = Math.min(existed.price, Number(v.price || 0));
      }
    });

    // เรียงไซส์เล็ก → ใหญ่
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.chest != null && b.chest != null && a.chest !== b.chest) return a.chest - b.chest;
      const ai = sizeOrderIndex(a.label), bi = sizeOrderIndex(b.label);
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label, 'th');
    });
    return arr;
  }, [product]);

  // เลือกสีอัตโนมัติ “เฉพาะกรณีมีสีเดียวและยังมีสต๊อก” (ไม่ใช่ Preorder ต้องเช็ค stock)
  useEffect(() => {
    setColorPick(prev => {
      const next = { ...prev };
      sizeGroups.forEach(g => {
        if (!g.colors.length) { delete next[g.label]; return; }

        if (g.colors.length === 1) {
          const only = g.colors[0];
          const ok = isPreorder(product) || Number(only.stock || 0) > 0;
          if (ok) next[g.label] = only._id;
          else delete next[g.label];
        } else if (!g.colors.find(v => v._id === next[g.label])) {
          delete next[g.label]; // เคยเลือกไว้แต่สีนี้ไม่มีแล้ว
        }
      });
      return next;
    });
  }, [sizeGroups, product]);

  // สรุปที่เลือกไว้ (รวมทุก variantId จาก quantities)
  const pickedList = useMemo(() => {
    const vs = Array.isArray(product?.variants) ? product.variants : [];
    return vs
      .map(v => ({ v, qty: Number(quantities[v._id] || 0) }))
      .filter(x => x.qty > 0);
  }, [product, quantities]);

  const pickedCount  = useMemo(() => pickedList.reduce((s, x) => s + x.qty, 0), [pickedList]);
  const pickedAmount = useMemo(() => pickedList.reduce((s, x) => s + (Number(x.v.price || 0) * x.qty), 0), [pickedList]);

  // เปลี่ยนจำนวน
  const handleQtyChange = (variantId, value) => {
    if (!variantId) return;
    const v = (product?.variants || []).find(v => v._id === variantId);
    const raw = Math.max(0, parseInt(String(value || '0').replace(/\D+/g, ''), 10) || 0);
    const capped = isPreorder(product) ? raw : Math.min(raw, Number(v?.stock || 0));
    setQuantities(q => ({ ...q, [variantId]: capped }));
  };
  const inc = (variantId) => { handleQtyChange(variantId, Number(quantities[variantId] || 0) + 1); vibe(); };
  const dec = (variantId) => { handleQtyChange(variantId, Math.max(0, Number(quantities[variantId] || 0) - 1)); vibe(); };

  // เพิ่มลงตะกร้า
  const addToCart = () => {
    if (!product) return;

    const errs = {};
    if (!activeOk) errs.sale = 'สินค้านี้ปิดการขาย';
    if (!timeOk)   errs.sale = sState === 'before' ? 'ยังไม่เปิดขาย' : 'ปิดการขายแล้ว';
    if (pickedList.length === 0) errs.qty = 'กรุณาเลือกจำนวนอย่างน้อย 1 ชิ้น';

    if (!isPreorder(product)) {
      for (const { v, qty } of pickedList) {
        if (qty > Number(v?.stock || 0)) { errs.stock = 'จำนวนที่เลือกเกินสต๊อกที่มี'; break; }
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    for (const { v, qty } of pickedList) {
      add({
        productId: product._id,
        productName: product.name,
        preorder: !!product.preorder,
        variantId: v._id,
        size: v?.size ?? '',
        color: v?.color ?? '',
        price: Number(v?.price || 0),
        qty: Number(qty)
      });
    }
    // ✅ ล้างจำนวน กันสับสน
    setQuantities({});
    setAddedOpen(true);
    vibe();
  };

  // แกลเลอรี
  const nextImg = () => setActiveIdx(i => (images.length ? (i + 1) % images.length : 0));
  const prevImg = () => setActiveIdx(i => (images.length ? (i - 1 + images.length) % images.length : 0));

  const productReady = !!product;

  // ---------------- Render ----------------
  return (
    <Box
      px={{ xs: 1.5, md: 3 }}
      py={2}
      sx={{ minHeight: '100vh', bgcolor: '#f6f7fb', pb: `${appFooterH + pageFooterH + 16}px` }}
    >
      <Paper
        sx={{
          width: '100%', maxWidth: 980, mx: 'auto',
          p: { xs: 2, md: 3 }, borderRadius: 4,
          border: '1px solid #e9eef9',
          background: 'linear-gradient(180deg,#ffffff,#fbfdff)',
          boxShadow: '0 10px 24px rgba(23,71,187,0.08)',
        }}
      >
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Button component={Link} to="/" size="small" variant="text" startIcon={<ArrowBackIcon />}>
            กลับหน้าแรก
          </Button>

          <Typography variant="h6" fontWeight={900} color="primary" sx={{ textAlign: 'center' }}>
            {productReady ? product.name : 'กำลังโหลดสินค้า…'}
          </Typography>

          <Button
            component={Link}
            to="/checkout"
            variant="contained"
            size="small"
            startIcon={
              <Badge color="secondary" badgeContent={totals.count} max={99}>
                <ShoppingCartIcon />
              </Badge>
            }
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
          >
            ตะกร้า
          </Button>
        </Stack>

        {/* สถานะ */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={1}>
          {product && hasWindow(product) && (
            <Chip
              label={sState === 'before' ? 'ยังไม่เปิดขาย' : sState === 'after' ? 'ปิดการขาย' : 'กำลังขาย'}
              color={sState === 'during' ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 800 }}
            />
          )}
          {product?.preorder && <Chip label="Preorder (ไม่จำกัดสต๊อก)" color="warning" size="small" sx={{ fontWeight: 800 }} />}
          {product && !activeOk && <Chip label="สินค้านี้ปิดการขาย" size="small" sx={{ fontWeight: 800 }} />}
        </Stack>

        {/* แกลเลอรี */}
        <Box sx={{ position: 'relative', borderRadius: 2, border: '1px solid #eef3ff', mb: 2, bgcolor: '#fff', textAlign: 'center' }}>
          <Box
            component="img"
            src={img}
            alt={product?.name || 'ภาพสินค้า'}
            draggable={false}
            onContextMenu={(e)=>e.preventDefault()}
            onClick={() => { if (images.length > 1) nextImg(); }}
            sx={{
              width: 'auto', height: 'auto',
              maxWidth: '100%', maxHeight: { xs: '60vh', md: '70vh' },
              display: 'inline-block', objectFit: 'contain', objectPosition: 'center',
              cursor: images.length > 1 ? 'pointer' : 'default'
            }}
          />
          {images.length > 1 && (
            <>
              <IconButton size="small" onClick={prevImg}
                sx={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)',
                      bgcolor: 'rgba(255,255,255,.75)', '&:hover': { bgcolor: 'rgba(255,255,255,.95)' } }}
                aria-label="รูปก่อนหน้า">
                <NavigateBeforeIcon />
              </IconButton>
              <IconButton size="small" onClick={nextImg}
                sx={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
                      bgcolor: 'rgba(255,255,255,.75)', '&:hover': { bgcolor: 'rgba(255,255,255,.95)' } }}
                aria-label="รูปถัดไป">
                <NavigateNextIcon />
              </IconButton>
              <Chip
                icon={<CollectionsIcon sx={{ color: '#fff' }} />}
                label={`${activeIdx + 1}/${images.length}`}
                size="small"
                sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(0,0,0,.45)', color: '#fff',
                      backdropFilter: 'blur(4px)', fontWeight: 800 }}
              />
            </>
          )}
        </Box>

        {/* เงื่อนไข 30 นาที */}
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          เมื่อกดสั่งซื้อแล้ว <b>ออร์เดอร์จะมีเวลา 30 นาที</b> ในการชำระเงินและอัปโหลดสลิป
        </Alert>

        {/* ตารางไซส์: ไซส์ / รอบอก / ความยาว (นิ้ว) */}
        <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 1 }}>ตารางไซส์</Typography>
        {sizeRows.length > 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2, overflow: 'hidden' }}>
            <Table size="small" aria-label="ตารางไซส์">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>ไซส์</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>รอบอก (นิ้ว)</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ความยาว (นิ้ว)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sizeRows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell sx={{ fontWeight: 800 }}>{r.label}</TableCell>
                    <TableCell>{r.chest  != null ? r.chest  : 'ไม่พบข้อมูลรอบอก'}</TableCell>
                    <TableCell>{r.length != null ? r.length : 'ไม่พบข้อมูลความยาว'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            ยังไม่พบข้อมูลไซส์จากระบบ
          </Alert>
        )}

        {/* เลือกสี → เลือกจำนวน (ต่อ “ไซส์”) */}
        <Divider sx={{ mb: 2 }}>เลือกจำนวน</Divider>

        <Grid container spacing={1.5} mb={1}>
          {sizeGroups.map((g) => {
            const selectedId = colorPick[g.label] ?? null;
            const selected = g.colors.find(v => v._id === selectedId) || null;

            // ราคาที่แสดง: ถ้าเลือกสีแล้วใช้ราคาของสีนั้น, ไม่งั้นแสดงช่วงราคาในไซส์นี้
            const minPrice = g.colors.length ? Math.min(...g.colors.map(c => c.price)) : 0;
            const maxPrice = g.colors.length ? Math.max(...g.colors.map(c => c.price)) : 0;
            const priceText = selected
              ? `${money(selected.price)} บาท`
              : (minPrice === maxPrice ? `${money(minPrice)} บาท` : `${money(minPrice)} - ${money(maxPrice)} บาท`);

            const soldOut = selected && !isPreorder(product) && Number(selected.stock || 0) <= 0;
            const qty = selected ? Number(quantities[selected._id] || 0) : 0;

            return (
              <Grid key={g.label} item xs={12} sm={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5, borderRadius: 2, background: '#ffffff',
                    border: '1px solid #e9eef9'
                  }}
                >
                  <Stack spacing={0.4} sx={{ mb: 1 }}>
                    <Typography fontWeight={900} color="primary.main" sx={{ fontSize: 18 }}>
                      {g.label}
                    </Typography>
                    <Typography color="text.secondary" fontSize={14}>
                      รอบอก: {g.chest != null ? `${g.chest} นิ้ว` : '—'}{`  •  `}
                      ความยาว: {g.length != null ? `${g.length} นิ้ว` : '—'}
                    </Typography>

                    {/* ตัวเลือกสี */}
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: .5 }}>
                      {g.colors.length === 0 && <Chip size="small" label="ไม่มีสี" />}
                      {g.colors.map(v => {
                        const selected = selectedId === v._id;
                        const out = !isPreorder(product) && Number(v.stock || 0) <= 0;
                        return (
                          <Chip
                            key={v._id}
                            label={`${v.color || 'ไม่ระบุสี'}${out ? ' (หมด)' : ''}`}
                            clickable={!out}
                            onClick={!out ? () => setColorPick(prev => ({ ...prev, [g.label]: v._id })) : undefined}
                            variant={selected ? 'filled' : 'outlined'}
                            color={selected ? 'primary' : 'default'}
                            sx={{
                              fontWeight: 800,
                              opacity: out ? 0.45 : 1,
                              pointerEvents: out ? 'none' : 'auto',
                              bgcolor: out ? 'grey.100' : undefined,
                              textDecoration: out ? 'line-through' : 'none',
                              '& .MuiChip-label': { px: 1.25, py: 0.25 }
                            }}
                          />
                        );
                      })}
                    </Stack>

                    <Typography color="primary" fontWeight={900}>
                      ราคา: {priceText}
                    </Typography>
                    {product?.preorder
                      ? <Typography color="success.main" fontSize={13}>Preorder: ไม่จำกัดจำนวน</Typography>
                      : selected && (
                          <Typography color={soldOut ? 'error' : 'success.main'} fontSize={13}>
                            {soldOut ? 'สินค้าหมด' : `คงเหลือ: ${selected.stock} ตัว`}
                          </Typography>
                        )
                    }
                  </Stack>

                  {/* stepper ขนาดใหญ่: ใช้ได้เมื่อเลือกสีแล้วเท่านั้น */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => selected && dec(selected._id)}
                      disabled={!canBuy || !selected || soldOut}
                      sx={{ minWidth: 48 }}
                      aria-label="ลดจำนวน"
                    >
                      <RemoveRoundedIcon />
                    </Button>

                    <TextField
                      type="number"
                      value={selected ? (qty || '') : ''}
                      onChange={(e)=> selected && handleQtyChange(selected._id, e.target.value)}
                      inputProps={{
                        min: 0,
                        max: selected ? (isPreorder(product) ? undefined : Number(selected.stock || 0)) : undefined,
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        style: { textAlign: 'center', fontWeight: 800, fontSize: 18, width: 96 }
                      }}
                      disabled={!canBuy || !selected || soldOut}
                    />

                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => selected && inc(selected._id)}
                      disabled={!canBuy || !selected || soldOut}
                      sx={{ minWidth: 48 }}
                      aria-label="เพิ่มจำนวน"
                    >
                      <AddRoundedIcon />
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        {/* ข้อความผิดพลาด */}
        {errors.sale &&  <Alert severity="warning" sx={{ mb: 1 }}>{errors.sale}</Alert>}
        {errors.stock && <Alert severity="error"   sx={{ mb: 1 }}>{errors.stock}</Alert>}
        {errors.qty &&   <Alert severity="info"    sx={{ mb: 1 }}>{errors.qty}</Alert>}

        {/* ปุ่มเสริมด้านบน */}
        <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 1 }}>
          <Button component={Link} to="/products" variant="outlined">← ดูสินค้าอื่น</Button>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" component={Link} to="/checkout">ไปตะกร้า</Button>
            <Button variant="contained" onClick={addToCart} disabled={!canBuy || pickedCount === 0}>
              เพิ่มลงตะกร้า
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Sticky footer (ยกเหนือฟุตเตอร์หลัก) */}
      <Portal>
        <Paper
          id="ordercreate-footer"
          elevation={0}
          sx={(t)=>({
            position: 'fixed',
            left: 0, right: 0,
            bottom: `${appFooterH}px`,
            zIndex: t.zIndex.appBar + 11,
            backdropFilter: 'saturate(160%) blur(12px)',
            background: `linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.98))`,
            borderTop: '1px solid rgba(229, 234, 246, .9)'
          })}
        >
          <Box sx={{ maxWidth: 1080, mx: 'auto', px: 1.5, py: 1.2,
                     display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack>
              <Typography fontWeight={900} color="primary" sx={{ fontSize: 18 }}>
                เลือกแล้ว: {pickedCount} ชิ้น
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                ยอดรวมชั่วคราว: <b>{money(pickedAmount)} บาท</b>
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" component={Link} to="/products" sx={{ fontWeight: 800 }}>
                + เลือกสินค้าอื่น
              </Button>
              <Button
                variant="contained"
                color="warning"
                onClick={addToCart}
                disabled={!canBuy || pickedCount === 0}
                sx={{ fontWeight: 900 }}
              >
                เพิ่มลงตะกร้า
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Portal>

      {/* แจ้งเพิ่มลงตะกร้าแล้ว */}
      <Snackbar
        open={addedOpen}
        autoHideDuration={2000}
        onClose={() => setAddedOpen(false)}
        message="เพิ่มลงตะกร้าแล้ว"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}