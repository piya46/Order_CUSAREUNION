// src/pages/Products.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../api/productApi';
import {
  Box, Typography, Card, CardContent, CardMedia,
  Button, Chip, Stack, Skeleton, Grid, IconButton, Tooltip, Badge
} from '@mui/material';
import { Link } from 'react-router-dom';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CollectionsIcon from '@mui/icons-material/Collections';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useCart } from '../context/CartContext';
import { collectImages } from '../utils/img';

const PLACEHOLDER =
  'https://i.pinimg.com/736x/03/00/b0/0300b0434822e05d77bf60d02ccccfe0.jpg';

/* ---------- utilities ---------- */
const thMoney = (n) => Number(n || 0).toLocaleString('th-TH');

function priceRange(p) {
  // ดึงราคาจาก variants ถ้ามี (กรองค่า non-number ออก)
  const prices = Array.isArray(p.variants)
    ? p.variants.map(v => Number(v.price) || 0).filter(n => !Number.isNaN(n))
    : [];

  // ไม่มี variants → ใช้ p.price เดี่ยว
  if (prices.length === 0) {
    const base = Number(p.price) || 0;
    return `${thMoney(base)} บาท`;
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // ถ้าราคาทั้งหมดเท่ากัน ให้แสดงราคาเดียว
  if (minPrice === maxPrice) {
    return `${thMoney(minPrice)} บาท`;
  }

  // ถ้าราคาแตกต่าง ให้แสดงเป็นช่วง
  return `${thMoney(minPrice)} - ${thMoney(maxPrice)} บาท`;
}

/* --- sale window helpers --- */
const now = () => Date.now();
const hasWindow = (p) => !!p.availableFrom || !!p.availableTo;
const isBefore = (iso) => (iso ? now() < new Date(iso).getTime() : false);
const isAfter  = (iso) => (iso ? now() > new Date(iso).getTime() : false);
const saleState = (p) => {
  if (!hasWindow(p)) return 'no-window';
  if (p.availableFrom && isBefore(p.availableFrom)) return 'before';
  if (p.availableTo && isAfter(p.availableTo))     return 'after';
  return 'during';
};
const isPreorder = (p) => !!p.preorder;

/* ✅ helper สำหรับ srcset (ถ้า backend รองรับ query ?w=) */
const buildSrcSet = (url) =>
  `${url}?w=480 480w, ${url}?w=960 960w, ${url}?w=1440 1440w`;

export default function Products() {
  const [products, setProducts] = useState(null);
  const { totals } = useCart();

  useEffect(() => {
    getProducts()
      .then((list) => setProducts(Array.isArray(list) ? list : []))
      .catch(() => setProducts([]));
  }, []);

  // ซ่อนสินค้า “ที่หมดช่วงเวลาขายแล้ว”
  const visible = useMemo(() => {
    if (!Array.isArray(products)) return products;
    return products.filter(p => !(hasWindow(p) && saleState(p) === 'after'));
  }, [products]);

  const totalCount = useMemo(() => (Array.isArray(visible) ? visible.length : 0), [visible]);

  return (
    <Box
      px={{ xs: 2, md: 4 }}
      py={2.5}
      sx={{
        background:
          "radial-gradient(1200px 600px at 5% -10%, rgba(62,142,247,0.06), transparent 50%)," +
          "radial-gradient(1200px 600px at 95% 110%, rgba(76,175,80,0.06), transparent 50%), #f7f9fc",
        minHeight: '100vh',
        // กันไม่ให้ปุ่มด้านล่างโดนฟุตเตอร์หลักบัง
        pb: 'calc(96px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Button
          variant="text"
          size="small"
          component={Link}
          to="/"
          startIcon={<ArrowBackIcon />}
          sx={{ fontWeight: 800, textTransform: 'none' }}
        >
          กลับหน้าแรก
        </Button>

        <Typography variant="h5" fontWeight={900}>สินค้า</Typography>

        <Button
          variant="contained"
          component={Link}
          to="/checkout"
          startIcon={
            <Badge color="secondary" badgeContent={totals.count} max={99}>
              <ShoppingCartIcon />
            </Badge>
          }
          sx={{ borderRadius: 2, fontWeight: 900, textTransform: 'none' }}
        >
          ตะกร้า
        </Button>
      </Stack>

      {Array.isArray(visible) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Typography variant="body2" color="text.secondary">
            ทั้งหมด {totalCount} รายการ
          </Typography>
          <Typography variant="caption" color="text.secondary">
            เคล็ดลับ: แตะรูปเพื่อดูภาพถัดไป
          </Typography>
        </Stack>
      )}

      <Grid container spacing={2.2}>
        {!visible &&
          Array.from({ length: 6 }).map((_, i) => (
            <Grid key={`sk-${i}`} item xs={12} sm={6} md={4}>
              <Card sx={{ borderRadius: 3, overflow: 'hidden' }} elevation={2}>
                <Skeleton variant="rectangular" height={220} />
                <Box p={2}>
                  <Skeleton width="70%" />
                  <Skeleton width="40%" />
                  <Skeleton width="30%" />
                  <Skeleton height={40} sx={{ mt: 1 }} />
                </Box>
              </Card>
            </Grid>
          ))}

        {visible && visible.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: 'background.paper', border: '1px dashed', borderColor: 'divider' }}>
              <Typography color="text.secondary">ยังไม่มีสินค้า</Typography>
            </Box>
          </Grid>
        )}

        {Array.isArray(visible) && visible.map((p) => (
          <Grid key={p._id} item xs={12} sm={6} md={4}>
            <ProductCard product={p} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

/* ---------------- Card ---------------- */
function ProductCard({ product: p }) {
  const [idx, setIdxState] = useState(0);
  const imgs = collectImages(p);
  const img = imgs[idx] || PLACEHOLDER;

  const anyStock = Array.isArray(p.variants) && p.variants.some(v => (Number(v.stock) || 0) > 0);
  const sState = saleState(p);

  // เงื่อนไขเลือกสินค้า:
  const activeOk   = p.isActive !== false;
  const timeOk     = !hasWindow(p) || sState === 'during';
  const stockOk    = isPreorder(p) ? true : anyStock;
  const canSelect  = activeOk && timeOk && stockOk;

  /* พรีโหลดภาพก่อน/ถัดไป */
  useEffect(() => {
    if (!imgs || imgs.length <= 1) return;
    const next = imgs[(idx + 1) % imgs.length];
    const prev = imgs[(idx - 1 + imgs.length) % imgs.length];
    [next, prev].forEach((u) => {
      if (!u) return;
      const im = new Image();
      im.src = u;
    });
  }, [idx, imgs]);

  const setIdx = (next) => {
    if (!imgs || imgs.length === 0) return;
    let n = next;
    if (n < 0) n = imgs.length - 1;
    if (n >= imgs.length) n = 0;
    setIdxState(n);
  };

  /* chip สถานะ (อ่านง่าย สีไม่แรงเกิน) */
  let statusChip = null;
  if (isPreorder(p)) {
    statusChip = <Chip label="Preorder" color="warning" size="small" sx={{ fontWeight: 800 }} />;
  } else if (hasWindow(p)) {
    statusChip = (
      <Chip
        label={ sState === 'before' ? 'ยังไม่เปิดขาย' : sState === 'during' ? 'กำลังขาย' : 'ปิดการขาย' }
        color={sState === 'during' ? 'success' : 'default'}
        size="small"
        sx={{ fontWeight: 800 }}
      />
    );
  }

  const handleImgError = (e) => {
    const el = e.currentTarget;
    el.onerror = null;
    if (imgs.length > 1) setIdx(idx + 1);
    else el.src = PLACEHOLDER;
  };

  const overlayText =
    !activeOk ? 'ไม่พร้อมจำหน่าย' :
    !timeOk ? (sState === 'before' ? 'ยังไม่เปิดขาย' : 'ปิดการขาย') :
    (!stockOk ? 'หมดชั่วคราว' : '');

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #e9eef9',
        background: 'linear-gradient(180deg,#ffffff,#fbfdff)',
        transition: 'transform .15s ease, box-shadow .15s ease',
        boxShadow: '0 10px 24px rgba(23,71,187,0.08)',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 16px 36px rgba(23,71,187,0.12)' },
      }}
    >
      {/* Media */}
      <Box sx={{ position: 'relative', aspectRatio: '4 / 3', bgcolor: '#f2f6ff' }}>
        <CardMedia
          component="img"
          src={img}
          alt={p.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          srcSet={buildSrcSet(img)}
          sizes="(max-width:600px) 100vw, (max-width:900px) 50vw, 33vw"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: overlayText ? 'grayscale(10%) brightness(0.92)' : 'none' }}
          onError={handleImgError}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => { if (imgs.length > 1) setIdx(idx + 1); }}
        />

        {/* badges */}
        <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 12, left: 12 }}>
          {statusChip}
        </Stack>

        {/* image count */}
        {imgs.length > 1 && (
          <Chip
            icon={<CollectionsIcon sx={{ color: '#fff' }} />}
            label={`${idx + 1}/${imgs.length}`}
            size="small"
            sx={{
              position: 'absolute', top: 12, right: 12,
              bgcolor: 'rgba(0,0,0,.45)', color: '#fff', backdropFilter: 'blur(4px)'
            }}
          />
        )}

        {/* arrows */}
        {imgs.length > 1 && (
          <>
            <IconButton
              size="small"
              onClick={() => setIdx(idx - 1)}
              sx={{
                position: 'absolute', top: '50%', left: 6, transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,.78)', '&:hover': { bgcolor: 'rgba(255,255,255,.95)' }
              }}
            >
              <NavigateBeforeIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setIdx(idx + 1)}
              sx={{
                position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,.78)', '&:hover': { bgcolor: 'rgba(255,255,255,.95)' }
              }}
            >
              <NavigateNextIcon />
            </IconButton>
          </>
        )}

        {/* overlay สถานะ */}
        {overlayText && (
          <Box
            sx={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(2px)'
            }}
          >
            <Chip label={overlayText} sx={{ fontWeight: 800, bgcolor: 'rgba(0,0,0,0.7)', color: '#fff' }} />
          </Box>
        )}
      </Box>

      {/* Content */}
      <CardContent sx={{ flexGrow: 1, pt: 1.5, pb: 0 }}>
        <Stack spacing={1}>
          <Tooltip title={p.name}>
            <Typography variant="subtitle1" fontWeight={900} noWrap>
              {p.name}
            </Typography>
          </Tooltip>

          {p.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
              title={p.description}
            >
              {p.description}
            </Typography>
          )}

          <Typography variant="h6" color="primary" fontWeight={900} mt={0.25}>
            {priceRange(p)}
          </Typography>
        </Stack>
      </CardContent>

      {/* Action */}
      <Box px={2} py={2}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          component={Link}
          to={`/order/create?productId=${p._id}`}
          disabled={!canSelect}
          sx={{
            borderRadius: 2, py: 1.2, fontWeight: 900, textTransform: 'none',
            opacity: canSelect ? 1 : 0.75
          }}
        >
          {canSelect ? 'เลือกสินค้า' : 'ไม่พร้อมสั่งซื้อ'}
        </Button>
      </Box>
    </Card>
  );
}