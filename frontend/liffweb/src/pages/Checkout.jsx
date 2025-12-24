// src/pages/Checkout.jsx
import { useContext, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Divider, IconButton, TextField, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody, Button, Alert, Chip,
  useMediaQuery, ButtonGroup, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Portal, Grid
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LocalPhoneRoundedIcon from '@mui/icons-material/LocalPhoneRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ShoppingCartCheckoutRoundedIcon from '@mui/icons-material/ShoppingCartCheckoutRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';

import { useCart } from '../context/CartContext';
import { createOrderFromCart } from '../api/orderApi';
import { LiffContext } from '../context/LiffContext';
import { Link, useNavigate } from 'react-router-dom';
import { isProfileCacheAllowed, getSavedProfile } from '../utils/profileCache';
import useElementHeight from '../hooks/useElementHeight';
import useKeyboardOpen from '../hooks/useKeyboardOpen';

/* -------- helpers -------- */
const money = (n) => Number(n || 0).toLocaleString('th-TH');
const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

// ความสูงโดยประมาณของแถบสรุป (fallback)
const PAGE_FOOTER_FALLBACK = 72;

/* ===== สร้างสตริงที่อยู่จากช่องย่อย ===== */
function buildAddressString(parts) {
  const {
    addrNo, addrMoo, addrVillage, addrBuilding, addrFloorRoom,
    addrSoi, addrRoad, addrSubdistrict, addrDistrict, addrProvince, addrPostcode
  } = parts;

  const line1 = [
    addrNo && `เลขที่ ${addrNo}`,
    addrMoo && `หมู่ ${addrMoo}`,
    addrVillage && `${addrVillage}`,
    addrBuilding && `${addrBuilding}`,
    addrFloorRoom && `${addrFloorRoom}`,
    addrSoi && `ซ.${addrSoi}`,
    addrRoad && `ถ.${addrRoad}`,
  ].filter(Boolean).join(' ');

  const line2 = [
    addrSubdistrict && `แขวง/ตำบล ${addrSubdistrict}`,
    addrDistrict && `เขต/อำเภอ ${addrDistrict}`,
    addrProvince && `จังหวัด ${addrProvince}`,
    addrPostcode && `${addrPostcode}`,
  ].filter(Boolean).join('  •  ');

  return [line1, line2].filter(s => s && s.trim()).join(' | ');
}

export default function Checkout() {
  const { items, setQty, removeAt, clear, totals, toOrderItems } = useCart();
  const { profile } = useContext(LiffContext);

  const [shippingType, setShippingType] = useState('DELIVERY');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // ที่อยู่แบบ “แยกช่อง”
  const [addrNo, setAddrNo] = useState('');
  const [addrMoo, setAddrMoo] = useState('');
  const [addrVillage, setAddrVillage] = useState('');
  const [addrBuilding, setAddrBuilding] = useState('');
  const [addrFloorRoom, setAddrFloorRoom] = useState('');
  const [addrSoi, setAddrSoi] = useState('');
  const [addrRoad, setAddrRoad] = useState('');
  const [addrSubdistrict, setAddrSubdistrict] = useState('');
  const [addrDistrict, setAddrDistrict] = useState('');
  const [addrProvince, setAddrProvince] = useState('');
  const [addrPostcode, setAddrPostcode] = useState('');

  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const navigate = useNavigate();
  const canCheckout = items.length > 0;
  const isDesktop = useMediaQuery('(min-width:900px)');

  const summary = useMemo(() => ({
    lines: items.length,
    qty: totals.count,
    amount: totals.amount
  }), [items, totals]);

  // วัดความสูงฟุตเตอร์หลัก + แถบสรุปของหน้านี้แบบเรียลไทม์
  const appFooterH  = useElementHeight('#app-footer-nav', 64);
  const pageFooterH = useElementHeight('#checkout-footer', PAGE_FOOTER_FALLBACK);

  // ตรวจคีย์บอร์ด (iOS) เพื่อเลื่อน/ซ่อนแถบสรุป
  const keyboardOpen = useKeyboardOpen();

  /* --- เติมข้อมูลจากหน้า "ฉัน" --- */
  const autofillFromMe = () => {
    if (!isProfileCacheAllowed()) return;
    const p = getSavedProfile();
    setCustomerName([p.firstName, p.lastName].filter(Boolean).join(' ').trim());
    if (p.phone) setCustomerPhone(p.phone);
    // ถ้ามี address เดิม (แบบสตริง) จะวางลง “ถนน” เป็นค่าเริ่มต้นให้ผู้ใช้แยกกรอกต่อ
    if (p.address && shippingType === 'DELIVERY') setAddrRoad(p.address);
    vibe();
  };

  /* --- validation (อัปเดต) --- */
  const digitsPhone = customerPhone.replace(/\D+/g, '');
  const validPhone = /^\d{9,10}$/.test(digitsPhone);
  const validName  = customerName.trim().length >= 2;

  // ✅ ต้องมี "เลขที่" และอย่างน้อย 1 ช่องใน {หมู่, หมู่บ้าน, ถนน, อาคาร}
  const groupOk = [addrMoo, addrVillage, addrRoad, addrBuilding, addrSoi]
    .some(v => (v || '').trim().length > 0);

  const baseOk     = addrNo.trim().length >= 1 && groupOk;
  const localityOk = [addrSubdistrict, addrDistrict, addrProvince]
    .every(s => (s || '').trim().length > 0);
  const postcodeOk = /^\d{5}$/.test(addrPostcode);

  const validAddr  = shippingType !== 'DELIVERY' || (baseOk && localityOk && postcodeOk);

  /* --- สั่งซื้อ (อัปเดตข้อความแจ้งเตือนระบุช่องที่ขาด) --- */
  const onPlaceOrderClick = () => {
    setErr(null);
    if (!validName)  { setErr('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (!validPhone) { setErr('กรุณากรอกเบอร์โทรศัพท์ (9–10 หลัก)'); return; }

    if (shippingType === 'DELIVERY') {
      const missing = [];
      if (addrNo.trim()==='')           missing.push('เลขที่');
      if (!groupOk)                     missing.push('อย่างน้อย 1 ช่องใน: หมู่/หมู่บ้าน/ถนน/อาคาร');
      if (addrSubdistrict.trim()==='')  missing.push('แขวง/ตำบล');
      if (addrDistrict.trim()==='')     missing.push('เขต/อำเภอ');
      if (addrProvince.trim()==='')     missing.push('จังหวัด');
      if (!postcodeOk)                  missing.push('รหัสไปรษณีย์ 5 หลัก');
      if (missing.length) { setErr('กรุณากรอก: ' + missing.join(' , ')); return; }
    }

    setConfirmOpen(true);
  };

  const doCreateOrder = async () => {
    const addressStr = shippingType === 'DELIVERY'
      ? buildAddressString({
          addrNo, addrMoo, addrVillage, addrBuilding, addrFloorRoom,
          addrSoi, addrRoad, addrSubdistrict, addrDistrict, addrProvince, addrPostcode
        })
      : '';

    const payload = {
      lineId: profile?.userId,
      displayName: profile?.displayName ? `${customerName} (${profile.displayName})` : customerName,
      shippingType,
      customerAddress: addressStr,
      customerPhone: digitsPhone,
      items: toOrderItems(),
    };

    setBusy(true);
    try {
      const order = await createOrderFromCart(payload);
      clear();
      navigate(`/orders/${order._id}/upload-slip`);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'สั่งซื้อไม่สำเร็จ');
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const pickupSelected =
    shippingType === 'PICKUP_SMAKHOM' || shippingType === 'PICKUP_EVENT';

  /* --- Qty Stepper --- */
  function QtyStepper({ value, onChange, min = 0, max = 999 }) {
    const dec = () => { const v = Math.max(min, Number(value || 0) - 1); onChange(v); vibe(); };
    const inc = () => { const v = Math.min(max, Number(value || 0) + 1); onChange(v); vibe(); };
    return (
      <ButtonGroup variant="outlined" size="large" aria-label="ปรับจำนวน">
        <Button onClick={dec} aria-label="ลดจำนวน" sx={{ minWidth: 44 }}><RemoveRoundedIcon /></Button>
        <TextField
          type="number"
          value={value}
          onChange={(e)=>onChange(Math.max(min, Math.min(max, parseInt(e.target.value || '0'))))}
          inputProps={{ min, max, inputMode: 'numeric', pattern: '[0-9]*', style: { textAlign: 'center', fontWeight: 700, width: 76, fontSize: 18 } }}
        />
        <Button onClick={inc} aria-label="เพิ่มจำนวน" sx={{ minWidth: 44 }}><AddRoundedIcon /></Button>
      </ButtonGroup>
    );
  }

  /* --- การ์ดสินค้า (มือถือ) — เอารูปสินค้าออกตามที่ขอ --- */
  function CartCard({ it, index }) {
    const subtotal = Number(it.price || 0) * Number(it.qty || 0);
    return (
      <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, mb: 1, border: '1px solid #F3F4F6', background: 'linear-gradient(180deg,#FFFFFF,#FBFDFE)' }}>
        <Stack spacing={0.5}>
          <Typography fontWeight={800} sx={{ fontSize: 16 }} noWrap title={it.productName}>{it.productName}</Typography>
          <Typography variant="body2" color="text.secondary">ไซส์: {it.size || '-'} • สี: {it.color || '-'}</Typography>

          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
            <Typography color="primary" fontWeight={900}>{money(it.price)} บาท</Typography>
            <Typography fontWeight={900}>รวม: {money(subtotal)} บาท</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" mt={1}>
            <QtyStepper value={it.qty} onChange={(v)=>setQty(index, v)} min={0} max={999} />
            <Tooltip title="ลบรายการนี้">
              <IconButton color="error" onClick={() => removeAt(index)} aria-label="ลบรายการ"><DeleteIcon /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box
      p={{ xs: 1.5, md: 3 }}
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 8% -10%, rgba(245,158,11,.08), transparent 55%),' +
          'radial-gradient(1200px 600px at 92% 110%, rgba(251,191,36,.10), transparent 55%), #FFFDF6',
        pb: `${appFooterH}px`
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 4,
          maxWidth: 1024,
          mx: 'auto',
          border: '1px solid #FDE68A',
          background: 'linear-gradient(180deg, #FFFFFF, #FFFEF5)',
          boxShadow: '0 12px 28px rgba(245,158,11,.12)',
        }}
      >
        {/* Header + สรุปเร็ว */}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h5" fontWeight={900} color="warning.main">ตะกร้าสินค้า</Typography>
            <Chip size="small" label={`${summary.lines} รายการ / ${summary.qty} ชิ้น`} />
            <Chip size="small" color="primary" variant="outlined" icon={<InfoOutlinedIcon />} label="กด + / − ปรับจำนวนได้" />
          </Stack>
          <Typography variant="h6" color="primary" fontWeight={900}>
            รวม {money(summary.amount)} บาท
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Cart */}
        {items.length === 0 ? (
          <Alert
            severity="info" variant="outlined"
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
            action={
              <Button component={Link} to="/products" variant="contained" color="warning" size="large"
                      sx={{ fontWeight: 900 }} startIcon={<ShoppingCartCheckoutRoundedIcon />} onClick={()=>vibe()}>
                ไปเลือกสินค้า
              </Button>
            }>
            ยังไม่มีสินค้าในตะกร้า
          </Alert>
        ) : (
          <>
            {!isDesktop && <Box>{items.map((it, i) => <CartCard key={`${it.productId}-${it.variantId}-${i}`} it={it} index={i} />)}</Box>}
            {isDesktop && (
              <Table size="medium" sx={{ '& th, & td': { fontSize: 16 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>สินค้า</TableCell>
                    <TableCell>ตัวเลือก</TableCell>
                    <TableCell align="right">ราคา</TableCell>
                    <TableCell align="center">จำนวน</TableCell>
                    <TableCell align="right">ยอดย่อย</TableCell>
                    <TableCell align="center">ลบ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it, i) => (
                    <TableRow key={`${it.productId}-${it.variantId}-${i}`}>
                      <TableCell>
                        <Typography fontWeight={800}>{it.productName}</Typography>
                      </TableCell>
                      <TableCell>{it.size || '-'} • {it.color || '-'}</TableCell>
                      <TableCell align="right">{money(it.price)}</TableCell>
                      <TableCell align="center">
                        <QtyStepper value={it.qty} onChange={(v)=>setQty(i, v)} min={0} max={999} />
                      </TableCell>
                      <TableCell align="right">{money(Number(it.price||0) * Number(it.qty||0))}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="ลบรายการนี้"><IconButton color="error" onClick={() => removeAt(i)} aria-label="ลบรายการ"><DeleteIcon /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Customer info */}
        <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>ข้อมูลลูกค้า</Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <TextField
            label="ชื่อ-นามสกุล" fullWidth value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            error={customerName !== '' && !validName}
            helperText={customerName !== '' && !validName ? 'ชื่อสั้นเกินไป' : ' '}
            inputProps={{ autoCapitalize: 'words', style: { fontSize: 18 } }}
            InputProps={{ startAdornment: <PersonRoundedIcon sx={{ mr: 1, color: 'text.disabled' }} /> }}
          />
          <TextField
            label="เบอร์โทรศัพท์" fullWidth value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="0xx xxx xxxx"
            error={customerPhone !== '' && !validPhone}
            helperText={customerPhone !== '' && !validPhone ? 'ใส่เฉพาะตัวเลข 9–10 หลัก' : ' '}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9 ]*', style: { fontSize: 18 } }}
            InputProps={{ startAdornment: <LocalPhoneRoundedIcon sx={{ mr: 1, color: 'text.disabled' }} /> }}
          />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ mt: 1 }}>
          <TextField
            select label="ประเภทการรับสินค้า" fullWidth value={shippingType}
            onChange={(e) => setShippingType(e.target.value)} InputProps={{ style: { fontSize: 18 } }}
          >
            <MenuItem value="DELIVERY">จัดส่งตามที่อยู่ (ไม่มีค่าจัดส่ง)</MenuItem>
            <MenuItem value="PICKUP_SMAKHOM">รับเองที่สมาคม</MenuItem>
            <MenuItem value="PICKUP_EVENT">รับเองที่หน้างาน</MenuItem>
          </TextField>
        </Stack>

        {/* ====== ที่อยู่จัดส่ง (โครงสร้างชัดเจน/ตัวอักษรใหญ่) ====== */}
        {shippingType === 'DELIVERY' && (
          <>
            <Typography variant="subtitle1" fontWeight={900} sx={{ mt: 2, mb: .75 }}>
              ที่อยู่จัดส่ง
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.5, md: 2 },
                borderRadius: 2,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.85), #fff)',
                borderColor: '#F3F4F6'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip size="small" label="กรอกให้ครบถ้วน" />
                <Chip size="small" color="warning" variant="outlined" label="ช่อง * จำเป็นต้องกรอก" />
              </Stack>

              {(() => {
                const labelSx = { fontWeight: 800, fontSize: 15 };
                const inputStyle = { fontSize: 18 };

                return (
                  <Grid container spacing={1.2}>
                    {/* แถว 1 */}
                    <Grid item xs={6} md={3}>
                      <TextField label="เลขที่ *" value={addrNo} onChange={e=>setAddrNo(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle, autoComplete: 'address-line1' }}
                                 error={addrNo.trim()===''}/>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <TextField label="หมู่" value={addrMoo} onChange={e=>setAddrMoo(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField label="หมู่บ้าน/โครงการ" value={addrVillage} onChange={e=>setAddrVillage(e.target.value)}
                                 placeholder="เช่น หมู่บ้านสุขใจ" fullWidth
                                 InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle, autoComplete: 'address-line2' }} />
                    </Grid>

                    {/* แถว 2 */}
                    <Grid item xs={12} md={4}>
                      <TextField label="อาคาร/ตึก/คอนโด" value={addrBuilding} onChange={e=>setAddrBuilding(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle }} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField label="ชั้น/ห้อง" value={addrFloorRoom} onChange={e=>setAddrFloorRoom(e.target.value)}
                                 fullWidth placeholder="เช่น ชั้น 5 ห้อง 502"
                                 InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle }} />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField label="ซอย" value={addrSoi} onChange={e=>setAddrSoi(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle }} />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField label="ถนน" value={addrRoad} onChange={e=>setAddrRoad(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle }} />
                    </Grid>

                    <Grid item xs={12}><Divider sx={{ my: .5 }} /></Grid>

                    {/* แถว 3 (จำเป็น) */}
                    <Grid item xs={12} md={3}>
                      <TextField label="แขวง/ตำบล *" value={addrSubdistrict} onChange={e=>setAddrSubdistrict(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle, autoComplete: 'address-level4' }}
                                 error={addrSubdistrict.trim()===''}
                                 helperText={addrSubdistrict.trim()==='' ? 'โปรดกรอกแขวง/ตำบล' : ' '} />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField label="เขต/อำเภอ *" value={addrDistrict} onChange={e=>setAddrDistrict(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle, autoComplete: 'address-level3' }}
                                 error={addrDistrict.trim()===''}
                                 helperText={addrDistrict.trim()==='' ? 'โปรดกรอกเขต/อำเภอ' : ' '} />
                    </Grid>
                    <Grid item xs={8} md={4}>
                      <TextField label="จังหวัด *" value={addrProvince} onChange={e=>setAddrProvince(e.target.value)}
                                 fullWidth InputLabelProps={{ sx: labelSx }} inputProps={{ style: inputStyle, autoComplete: 'address-level1' }}
                                 error={addrProvince.trim()===''}
                                 helperText={addrProvince.trim()==='' ? 'โปรดกรอกจังหวัด' : ' '} />
                    </Grid>
                    <Grid item xs={4} md={2}>
                      <TextField label="รหัสไปรษณีย์ *" value={addrPostcode}
                                 onChange={(e)=>setAddrPostcode(e.target.value.replace(/\D+/g,''))}
                                 fullWidth placeholder="เช่น 10230"
                                 inputProps={{ style: inputStyle, inputMode: 'numeric', pattern: '[0-9]*', maxLength: 5, autoComplete: 'postal-code' }}
                                 InputLabelProps={{ sx: labelSx }}
                                 error={addrPostcode !== '' && !/^\d{5}$/.test(addrPostcode)}
                                 helperText={addrPostcode !== '' && !/^\d{5}$/.test(addrPostcode) ? 'ใส่ 5 หลัก' : ' '} />
                    </Grid>

                    {/* ✅ บอกผู้ใช้ว่าต้องมีอย่างน้อย 1 ช่องในกลุ่มนี้ */}
                    <Grid item xs={12}>
                      <Typography variant="caption" color={groupOk ? 'text.secondary' : 'error'}>
                        ต้องกรอกอย่างน้อย 1 ช่องใน: <b>หมู่</b> / <b>หมู่บ้าน</b> / <b>ถนน</b> / <b>อาคาร</b>
                      </Typography>
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        ตัวอย่าง: เลขที่ 99 หมู่ 3 หมู่บ้านสุขใจ ซอย 5 ถนนสุขสบาย • แขวง/ตำบล สุขใจ • เขต/อำเภอ เมือง • จังหวัด กรุงเทพมหานคร • 10500
                      </Typography>
                    </Grid>
                  </Grid>
                );
              })()}
            </Paper>
          </>
        )}

        {pickupSelected && (
          <Alert severity="warning" sx={{ mt: 1.25, borderRadius: 2, borderColor: '#F59E0B' }} variant="outlined">
            โปรดแสดง<b>บัตรประจำตัวประชาชน</b> และ <b>สลิปเงินโอน</b> เพื่อยืนยันตัวตนของท่านเมื่อมารับสินค้า
          </Alert>
        )}

        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} role="alert" aria-live="assertive">{err}</Alert>}

        {/* Quick actions */}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }} alignItems="center" flexWrap="wrap" gap={1}>
          <Button variant="outlined" startIcon={<AutoFixHighRoundedIcon />} onClick={autofillFromMe}
                  disabled={!isProfileCacheAllowed()} sx={{ borderRadius: 2, fontWeight: 800 }}>
            เติมข้อมูลจากระบบ
          </Button>
          <Button variant="outlined" color="inherit" onClick={clear} disabled={items.length === 0}>ล้างตะกร้า</Button>
        </Stack>
      </Paper>

      {/* Spacer ป้องกัน footer บัง */}
      <Box id="checkout-footer-spacer" aria-hidden
           sx={{ height: `calc(${appFooterH + pageFooterH}px + env(safe-area-inset-bottom, 0px))` }} />

      {/* Page Footer (ยกเหนือฟุตเตอร์หลัก) */}
      <Portal>
        <Paper
          id="checkout-footer"
          component="section"
          elevation={0}
          aria-label="สรุปยอดและสั่งซื้อ"
          sx={(t)=>({
            position: 'fixed',
            left: 0, right: 0,
            bottom: `${appFooterH}px`,
            zIndex: t.zIndex.appBar + 11,
            backdropFilter: 'saturate(160%) blur(12px)',
            background: `linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.98))`,
            borderTop: '1px solid rgba(253, 230, 138, .8)',
            transform: keyboardOpen ? 'translateY(110%)' : 'translateY(0)',
            transition: 'transform .18s ease-out',
          })}
        >
          <Box sx={{ maxWidth: 1080, mx: 'auto', minHeight: 72, px: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography fontWeight={900} color="primary" sx={{ fontSize: 18 }}>
              รวม: {money(summary.amount)} บาท
            </Typography>
            <Button
              size="large" variant="contained" color="warning"
              onClick={onPlaceOrderClick} disabled={!canCheckout || busy}
              sx={{ fontWeight: 900, px: 2.5 }} startIcon={<ShoppingCartCheckoutRoundedIcon />}
            >
              {busy ? 'กำลังสร้างออเดอร์…' : 'สั่งซื้อสินค้า'}
            </Button>
          </Box>
        </Paper>
      </Portal>

      {/* Dialog ยืนยันก่อนสั่งซื้อ */}
      <Dialog open={confirmOpen} onClose={()=>setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>ยืนยันการสั่งซื้อ</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography>ยอดรวมทั้งสิ้น: <b style={{ color:'#1976d2' }}>{money(summary.amount)} บาท</b></Typography>
            <Typography>ผู้สั่งซื้อ: <b>{customerName || '-'}</b></Typography>
            <Typography>เบอร์โทร: <b>{digitsPhone || '-'}</b></Typography>
            <Typography>การรับสินค้า: <b>
              {shippingType === 'DELIVERY' ? 'จัดส่งตามที่อยู่' :
               shippingType === 'PICKUP_SMAKHOM' ? 'รับเองที่สมาคม' : 'รับเองที่หน้างาน'}
            </b></Typography>
            {shippingType === 'DELIVERY' && (
              <Typography>ที่อยู่: <b>{
                buildAddressString({
                  addrNo, addrMoo, addrVillage, addrBuilding, addrFloorRoom,
                  addrSoi, addrRoad, addrSubdistrict, addrDistrict, addrProvince, addrPostcode
                }) || '-'
              }</b></Typography>
            )}

            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary"
              sx={{ display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              รายการสินค้า ({summary.lines} รายการ / {summary.qty} ชิ้น)
            </Typography>
            <Box sx={{ maxHeight: 220, overflow: 'auto', pr: .5 }}>
              {items.map((it, i)=>(
                <Typography key={`${it.productId}-${it.variantId}-${i}`} variant="body2">
                  • {it.productName} | {it.size || '-'} • {it.color || '-'} | {money(it.price)} x {it.qty} = {money(Number(it.price||0)*Number(it.qty||0))} บาท
                </Typography>
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setConfirmOpen(false)}>ตรวจอีกครั้ง</Button>
          <Button variant="contained" color="warning" onClick={doCreateOrder} disabled={busy}>ยืนยันสั่งซื้อ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}