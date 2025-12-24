// src/pages/Home.jsx
import { useContext, useEffect, useMemo, useState } from "react";
import { LiffContext } from "../context/LiffContext";
import {
  Avatar, Box, Button, Chip, Divider, Grid, Paper, Skeleton, Stack, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, List, ListItem, ListItemIcon, ListItemText,
  Checkbox, useMediaQuery, Portal, Tooltip
} from "@mui/material";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

import Logo from "../components/Logo";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import useElementHeight from "../hooks/useElementHeight";

const TERMS_KEY = 'aw_terms_agreed_v1';
const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

export default function Home() {
  const { profile, ready } = useContext(LiffContext);
  const [open, setOpen] = useState(false);              // dialog ข้อตกลง
  const [checked, setChecked] = useState(false);        // เช็คยอมรับ (ครั้งแรกเท่านั้น)
  const [agreed, setAgreed] = useState(false);          // เคยยอมรับแล้วหรือยัง
  const needAccept = !agreed && !checked;               // ต้องยอมรับก่อนหรือไม่ (ใช้ควบคุม UI)

  const navigate = useNavigate();
  const location = useLocation();
  const upSm = useMediaQuery('(min-width:600px)');

  // วัดความสูงฟุตเตอร์หลัก + CTA หน้านี้ เพื่อกันไม่ให้บัง
  const appFooterH  = useElementHeight('#app-footer-nav', 64);
  const pageFooterH = useElementHeight('#home-cta-footer', 64);

  useEffect(() => {
    const ok = localStorage.getItem(TERMS_KEY) === '1';
    setAgreed(ok);
    if (location.state?.needAgree) setOpen(true);
  }, [location.state]);

  const displayName = useMemo(
    () => (ready ? (profile?.displayName || 'สวัสดี') : ''),
    [ready, profile?.displayName]
  );

  const goProducts = () => { navigate('/products'); };

  // เริ่มสั่ง: ถ้าเคยยอมรับแล้วไปต่อได้เลย; ถ้ายังไม่เคย ให้ติ๊กก่อนหรือเปิด dialog
  const startOrder = () => {
    if (agreed) { vibe(); goProducts(); return; }
    if (checked) {
      try { localStorage.setItem(TERMS_KEY, '1'); } catch {}
      setAgreed(true);
      vibe(); goProducts(); return;
    }
    setOpen(true);
  };

  const agreeAndGo = () => {
    try { localStorage.setItem(TERMS_KEY, '1'); } catch {}
    setAgreed(true);
    setOpen(false);
    vibe();
    goProducts();
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 2.2, md: 4 },
        px: { xs: 1.2, md: 3 },
        background:
          "radial-gradient(1200px 600px at 5% -10%, rgba(245,158,11,.10), transparent 60%)," +
          "radial-gradient(1200px 600px at 95% 110%, rgba(251,191,36,.12), transparent 60%), #FFFEF5",
        pb: `${appFooterH}px` // กันพื้นที่ล่างให้ไม่ทับฟุตเตอร์หลัก
      }}
    >
      {/* HERO */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          mb: 2,
          border: "1px solid #FFE5A3",
          background: "linear-gradient(180deg, #FFFFFF, #FFF9E6)",
          maxWidth: 980, mx: "auto",
          position: "relative", overflow: "hidden",
        }}
      >
        <Box sx={{ position: "absolute", right: 12, top: 12, opacity: 0.08, display: { xs: "none", sm: "block" }, pointerEvents: "none" }}>
          <Logo size={88} />
        </Box>

        <Stack direction="row" alignItems="center" spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
          {ready ? (
            <Avatar
              src={profile?.pictureUrl || ""}
              alt={profile?.displayName || "LINE user"}
              sx={{ width: 76, height: 76, bgcolor: "#FFF7D6", border: "2px solid #fff" }}
              imgProps={{ draggable: false }}
            />
          ) : (
            <Skeleton variant="circular" width={76} height={76} />
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant={upSm ? "h5" : "h6"} fontWeight={900} noWrap sx={{ lineHeight: 1.25 }}>
              {ready ? `สวัสดี, ${displayName}` : <Skeleton width={140} />}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" mt={0.75} flexWrap="wrap">
              <Chip size="small" color="warning" label="เข้าสู่ระบบผ่าน LINE" sx={{ fontWeight: 800 }} />
              <Chip size="small" component={RouterLink} to="/orders" clickable label="ดูออร์เดอร์ของฉัน" />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* ขั้นตอนสั่งซื้อแบบอ่านง่าย */}
      <Grid container spacing={1.5} justifyContent="center">
        <Grid item xs={12} md={11} lg={10} sx={{ display: "flex", justifyContent: "center" }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.2, sm: 3 },
              borderRadius: 3,
              border: "1px solid #FFE5A3",
              background: "#FFFFFF",
              width: "100%",
              maxWidth: 980,
            }}
          >
            <Typography variant="h6" fontWeight={900} mb={1}>
              สั่งซื้อเสื้อใน 3 ขั้นตอน
            </Typography>

            <Grid container spacing={1.2}>
              <Grid item xs={12} sm={4}>
                <StepCard no={1} icon={<Inventory2RoundedIcon />} title="เลือกสินค้าและกดเพิ่มลงตะกร้า"
                  desc="กดเข้า 'เริ่มสั่งจอง' แล้วเลือกแบบ ระบุไซส์ และจำนวน" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StepCard no={2} icon={<AssignmentTurnedInRoundedIcon />} title="กรอกข้อมูล"
                  desc="กรอกชื่อ-เบอร์ เลือกวิธีรับสินค้า: จัดส่งหรือรับเอง" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <StepCard no={3} icon={<UploadFileRoundedIcon />}
                  title="โอน & อัปโหลดสลิป"
                  desc="โอนแล้วแนบสลิปภายใน 30 นาที จากนั้นติดตามสถานะได้" />
              </Grid>
            </Grid>

            {/* เงื่อนไขสำคัญ (สรุปสั้น) */}
            <Alert severity="info" sx={{ my: 1.4 }}>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                • ออเดอร์สำเร็จเมื่อชำระเงินและอัปโหลดสลิปภายใน <b>30 นาที</b><br/>
                • เลือกรับสินค้าได้ 2 แบบ: <b>จัดส่งไปรษณีย์ (จัดส่งฟรี)</b> หรือ <b>รับเอง</b> ตามจุดที่กำหนด<br/>
                • หากรับเอง โปรดแสดง <b>บัตรประชาชน</b> และ <b>สลิปเงินโอน</b> เมื่อมารับสินค้า
              </Typography>
              <Button onClick={()=>setOpen(true)} size="small" color="inherit" startIcon={<HelpOutlineRoundedIcon />} sx={{ mt: .5 }}>
                อ่านเงื่อนไขฉบับเต็ม
              </Button>
            </Alert>

            <Divider sx={{ my: 1.6, borderColor: "#FFE5A3" }} />

            {/* เตือนให้ยอมรับก่อน */}
            {needAccept && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                ต้องยอมรับเงื่อนไขก่อนจึงจะไปต่อได้
              </Alert>
            )}

            {/* โซนยอมรับเงื่อนไข + ปุ่มเริ่ม */}
            {agreed ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip color="success" icon={<CheckCircleIcon />} label="คุณยอมรับเงื่อนไขแล้ว" sx={{ fontWeight: 800 }} />
                  <Button size="small" color="inherit" onClick={()=>setOpen(true)} startIcon={<HelpOutlineRoundedIcon />}>
                    ดูเงื่อนไข
                  </Button>
                </Stack>
                <Button variant="contained" color="warning" endIcon={<ArrowForwardIcon />} onClick={startOrder} sx={{ fontWeight: 900, px: 2.5, py: 1.2 }}>
                  เริ่มสั่งจอง
                </Button>
              </Stack>
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center">
                  <Checkbox checked={checked} onChange={(e)=>setChecked(e.target.checked)} inputProps={{ 'aria-label': 'ยอมรับข้อตกลง' }} />
                  <Typography variant="body2">
                    ฉันได้อ่านและยอมรับข้อตกลงแล้ว
                    <Button onClick={()=>setOpen(true)} size="small" color="inherit" startIcon={<HelpOutlineRoundedIcon />} sx={{ ml: .5 }}>
                      อ่านรายละเอียด
                    </Button>
                  </Typography>
                </Stack>
                <Button
                  variant="contained"
                  color="warning"
                  endIcon={<ArrowForwardIcon />}
                  onClick={startOrder}
                  disabled={!checked}
                  sx={{ fontWeight: 900, px: 2.5, py: 1.2 }}
                >
                  {checked ? 'เริ่มสั่งจอง' : 'ติ๊กยอมรับเพื่อไปต่อ'}
                </Button>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Spacer กันไม่ให้ CTA ล่างบังคอนเทนต์ */}
      <Box id="home-cta-footer-spacer" aria-hidden sx={{ height: `${appFooterH + pageFooterH}px` }} />

      {/* Dialog ข้อตกลง (ฉบับเต็มและชัดเจนขึ้น) */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>ข้อตกลงและเงื่อนไขการสั่งจอง</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" gutterBottom>1) การสร้างออร์เดอร์</Typography>
          <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.8 }}>
            • เมื่อยืนยันรายการในตะกร้า ระบบจะสร้างออร์เดอร์ให้ และเริ่มจับเวลา <b>ชำระเงินภายใน 30 นาที</b><br/>
            • กรุณาตรวจสอบ <b>แบบ/ไซส์/จำนวน</b> ให้ถูกต้องก่อนยืนยัน เนื่องจากยืนยันแล้ว <b>แก้ไขไม่ได้</b> ต้องสร้างออร์เดอร์ใหม่เท่านั้น<br/>
            • กรณีที่มีการสร้างออร์เดอร์หลายรายการพร้อมกัน ขอสงวนสิทธิ์ในการจัดลำดับการดำเนินการตามเวลาที่ได้รับออร์เดอร์<br/>
            • หากมีข้อสงสัยหรือต้องการเปลี่ยนแปลง กรุณาติดต่อเจ้าหน้าที่ผ่าน LINEOA ก่อนยืนยันออร์เดอร์
          </Typography>

          <Typography variant="subtitle2" gutterBottom>2) การชำระเงินและอัปโหลดสลิป</Typography>
          <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.8 }}>
            • ชำระเงินผ่านช่องทางที่ระบุ แล้ว <b>อัปโหลดสลิปภายใน 30 นาที</b> หลังออร์เดอร์ถูกสร้าง<br/>
            • หาก <b>ไม่ชำระ/ไม่อัปโหลดสลิปทันเวลา</b> ระบบจะยกเลิกออร์เดอร์โดยอัตโนมัติ<br/>
            • อัปโหลดสลิป <b>1 ออร์เดอร์ ต่อ 1 สลิป</b> เพื่อความถูกต้องในการตรวจสอบ
          </Typography>

          <Typography variant="subtitle2" gutterBottom>3) วิธีการรับสินค้า</Typography>
          <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.8 }}>
            • <b>จัดส่งไปรษณีย์</b>: จัดส่งฟรีทั่วไทย ใช้ชื่อ-ที่อยู่ตามที่กรอกในขั้นตอนชำระเงิน โปรดกรอกให้ครบถ้วนและถูกต้อง<br/>
            • <b>รับเอง</b>: โปรดแสดง <b>บัตรประชาชน</b> และ <b>สลิปเงินโอน</b> เพื่อยืนยันตัวตน ณ จุดรับสินค้า
          </Typography>

          <Typography variant="subtitle2" gutterBottom>4) การเปลี่ยนแปลง/ยกเลิก</Typography>
          <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.8 }}>
            • การจะแก้ไขหรือเปลี่ยนแปลงออร์เดอร์ ไม่สามารถทำได้หากชำระเงินแล้ว<br/>
            • หลังยืนยันออร์เดอร์ ไม่สามารถแก้ไขแบบ/ไซส์/จำนวนได้ <br/>
            • กรณีชำระเงินแล้ว การเปลี่ยนแปลงหรือยกเลิกจะพิจารณาเป็นรายกรณีตามเงื่อนไขของผู้ขาย โปรดติดต่อเจ้าหน้าที่ผ่าน LINEOA
          </Typography>

          <Typography variant="subtitle2" gutterBottom>5) การติดตามสถานะ</Typography>
          <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.8 }}>
            • หลังอัปโหลดสลิปแล้ว สามารถตรวจดูความคืบหน้าได้ที่เมนู <b>“ออร์เดอร์”</b> ในแอป<br/>
            • เมื่อจัดส่ง จะมีการอัปเดตสถานะและ/หรือเลขพัสดุให้ทราบทางออร์เดอร์นั้นๆและทางไลน์<br/>
            • กรณีมีปัญหาหรือข้อสงสัย กรุณาติดต่อเจ้าหน้าที่ผ่าน LINEOA
          </Typography>

          <Typography variant="subtitle2" gutterBottom>6) การติดต่อเจ้าหน้าที่</Typography>
          <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.8 }}>
            • หากมีปัญหาในการชำระเงิน การอัปโหลดสลิป หรือการกรอกข้อมูล กรุณาแจ้งผ่านแชต LINEOA
          </Typography>

          <Typography variant="subtitle2" gutterBottom>7) ข้อมูลส่วนบุคคล</Typography>
          <Typography variant="body2" sx={{ mb: 0.5, lineHeight: 1.8 }}>
            • ข้อมูลชื่อ-ที่อยู่-เบอร์โทร จะถูกใช้เพื่อยืนยันตัวตนและจัดส่งสินค้าเท่านั้น และจะเก็บรักษาอย่างเหมาะสม
          </Typography>
        </DialogContent>
        <DialogActions>
          {/* ปุ่มยอมรับ: ถ้าเคยยอมรับแล้ว ไม่ต้องติ๊กให้ใหม่ */}
          {agreed ? (
            <>
              <Button onClick={() => setOpen(false)}>ปิด</Button>
              <Button variant="contained" color="warning" onClick={goProducts} startIcon={<ArrowForwardIcon />}>
                ไปเลือกสินค้า
              </Button>
            </>
          ) : (
            <>
              <Stack direction="row" alignItems="center" sx={{ mr: 'auto', pl: 1 }}>
                <Checkbox checked={checked} onChange={(e)=>setChecked(e.target.checked)} />
                <Typography variant="body2">ฉันยอมรับข้อตกลง</Typography>
              </Stack>
              <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button variant="contained" color="warning" onClick={agreeAndGo} disabled={!checked} startIcon={<CheckCircleIcon />}>
                ยอมรับและเริ่มเลือกสินค้า
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* CTA ล่าง (ยกเหนือฟุตเตอร์หลักเสมอ) */}
      <Portal>
        <Paper
          id="home-cta-footer"
          elevation={0}
          sx={(t)=>({
            position: 'fixed',
            left: 0, right: 0,
            bottom: `${appFooterH}px`,
            zIndex: t.zIndex.appBar + 11,
            backdropFilter: 'saturate(160%) blur(12px)',
            background: `linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.98))`,
            borderTop: '1px solid rgba(253, 230, 138, .8)',
          })}
        >
          <Box sx={{ maxWidth: 1080, mx: 'auto', minHeight: 64, px: 1.5,
                     display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack spacing={0}>
              <Typography fontWeight={900}>พร้อมเริ่มสั่งจองหรือยัง</Typography>
              <Typography variant="caption" color="text.secondary">
                กดปุ่มสีส้มด้านขวาเพื่อไปเลือกสินค้า
              </Typography>
              {needAccept && (
                <Chip size="small" color="warning" label="ต้องยอมรับเงื่อนไขก่อน" sx={{ mt: .5, fontWeight: 800 }} />
              )}
            </Stack>

            <Tooltip title={needAccept ? 'กรุณาติ๊ก “ฉันได้อ่านและยอมรับข้อตกลงแล้ว” ก่อน' : ''}>
              <span>
                <Button
                  size="large"
                  variant="contained"
                  color="warning"
                  endIcon={<ArrowForwardIcon />}
                  onClick={startOrder}
                  disabled={needAccept}
                  sx={{ fontWeight: 900 }}
                >
                  เริ่มสั่งจอง
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Paper>
      </Portal>
    </Box>
  );
}

/* ========== components ========== */
function StepCard({ no, icon, title, desc }) {
  return (
    <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2, border: '1px solid #F3F4F6', background: 'linear-gradient(180deg,#FFFFFF,#FBFDFE)' }}>
      <Stack direction="row" spacing={1.2} alignItems="center">
        <NumberBadge no={no} />
        <Typography variant="subtitle1" fontWeight={900}>{title}</Typography>
      </Stack>
      <Stack direction="row" spacing={1.2} alignItems="flex-start" mt={1}>
        <Box sx={{ mt: .2 }}>{icon}</Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {desc}
        </Typography>
      </Stack>
    </Paper>
  );
}
function NumberBadge({ no }) {
  return (
    <Box aria-hidden sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#FFEDD5', color: '#D97706',
                           display: 'grid', placeItems: 'center', fontWeight: 900 }}>
      {no}
    </Box>
  );
}