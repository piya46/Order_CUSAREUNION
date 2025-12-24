// src/pages/UploadSlip.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadSlip, getOrderDetail } from '../api/orderApi';
import {
  Box, Typography, Button, Paper, Fade, Avatar, CircularProgress, Stack,
  IconButton, Tooltip, Divider, LinearProgress, Alert, Chip,
  Dialog, DialogContent, DialogActions, Link as MuiLink
} from '@mui/material';
import Swal from 'sweetalert2';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

/* ====== CONFIG ====== */
const PROMPTPAY_ID = (import.meta.env.VITE_PROMPTPAY_ID || '').trim();
const ALLOW_SCREENSHOT = String(import.meta.env.VITE_ALLOW_SCREENSHOT || '') === '1';

const BANK_INFO = {
  logo: "/kbank.jpg",
  name: "ธนาคารกสิกรไทย",
  accountNumber: "213-3-26925-0",
  accountName: "นาง นันทิยา ชุ่มเสนา และ น.ส. ณีนวรรณ์ ศุภกำเนิด",
};

const MERCHANT_NAME = (import.meta.env.VITE_MERCHANT_NAME || BANK_INFO.accountName || 'ชื่อร้าน/องค์กร').trim();
const MERCHANT_NOTE = (import.meta.env.VITE_MERCHANT_NOTE || 'เพื่อชำระค่าสินค้า/บริการ').trim();
const THAIQR_LOGO = '/thaiqr-white.png';
const PROMPTPAY_LOGO = '/promptpay-logo.png';

const MAX_FILE_MB = 5;
const ACCEPT_MIMES = ['image/jpeg','image/png','image/webp','application/pdf'];

/* ===== Platform detection ===== */
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const IS_IOS =
  /iP(ad|hone|od)/.test(UA) ||
  (typeof navigator !== 'undefined' && /Macintosh/.test(UA) && typeof document !== 'undefined' && 'ontouchend' in document);
const IS_ANDROID = /Android/i.test(UA);
const IS_SAFARI = /Safari/.test(UA) && !/Chrome|Chromium|Edg/.test(UA);

const SUPPORTS_SHARE_FILES = (() => {
  try {
    if (!navigator?.canShare) return false;
    const f = new File(['x'], 'x.png', { type: 'image/png' });
    return navigator.canShare({ files: [f] });
  } catch { return false; }
})();

const SUPPORTS_SAVE_PICKER = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

/* ====== Thai QR PromptPay helpers (EMVCo) ====== */
function tlv(id, value) { const len = value.length.toString().padStart(2, '0'); return `${id}${len}${value}`; }
function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1), crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function normalizeProxy(id) {
  const digits = String(id).replace(/\D+/g, '');
  if (!digits) return { type: '01', value: '' };
  if (digits.length === 13) return { type: '02', value: digits };
  if (digits.length === 10 && digits.startsWith('0')) return { type: '01', value: `66${digits.slice(1)}` };
  if (digits.length === 11 && digits.startsWith('66')) return { type: '01', value: digits };
  if (digits.length >= 15) return { type: '03', value: digits };
  return { type: '01', value: digits };
}
function buildPromptPayPayload(promptpayId, amount) {
  const proxy = normalizeProxy(promptpayId);
  if (!proxy.value) return '';
  const payloadFormat = tlv('00', '01');
  const initiation    = tlv('01', '12');
  const aid           = tlv('00', 'A000000677010111');
  const proxyTLV      = tlv(proxy.type, proxy.value);
  const mai29         = tlv('29', `${aid}${proxyTLV}`);
  const currency      = tlv('53', '764');
  const amountTLV     = tlv('54', Number(amount || 0).toFixed(2));
  const country       = tlv('58', 'TH');
  const noCrc = `${payloadFormat}${initiation}${mai29}${currency}${amountTLV}${country}6304`;
  return `${noCrc}${crc16(noCrc)}`;
}

export default function UploadSlip() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ❗ ให้ผู้ใช้ "เลือกก่อน" เสมอ — ไม่ default ไปพร้อมเพย์
  const promptpayAvailable = !!PROMPTPAY_ID;
  const [payMethod, setPayMethod] = useState(null); // null | 'PROMPTPAY' | 'BANK'

  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState(null);
  const [orderNo, setOrderNo] = useState('');
  const [createdAt, setCreatedAt] = useState(null);

  const [slipReviewCount, setSlipReviewCount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // ⏱️ นับถอยหลัง 30 นาที จากเวลาสร้างออเดอร์
  const [timeLeftStr, setTimeLeftStr] = useState('');

  const dropRef = useRef(null);
  const canvasRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const qrBoxRef = useRef(null);
  const objectUrlRef = useRef('');
  const uploadBtnRef = useRef(null);

  // QR state
  const [qrLoading, setQrLoading] = useState(false);
  const [qrReady, setQrReady] = useState(false);

  const promptKey = useMemo(() => `qrPromptShown:${orderNo || id}`, [orderNo, id]);

  /* -------- Load order -------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const o = await getOrderDetail(id);
        setAmount(Number(o?.totalAmount ?? 0));
        setSlipReviewCount(Number(o?.slipReviewCount ?? 0));
        setPaymentStatus(String(o?.paymentStatus ?? ""));
        setOrderStatus(String(o?.orderStatus ?? ""));
        setCreatedAt(o?.createdAt ?? null);
        setOrderNo(o?.orderNo || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* -------- ตั้งตัวนับเวลาถอยหลัง (30 นาที) -------- */
  useEffect(() => {
    if (!createdAt) { setTimeLeftStr(''); return; }
    const deadline = new Date(createdAt).getTime() + 30 * 60 * 1000;
    const fmt = (ms) => {
      if (ms <= 0) return 'หมดเวลา';
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const tick = () => setTimeLeftStr(fmt(deadline - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [createdAt]);

  /* -------- เด้งถาม “เลือกช่องทางชำระเงินแบบไหน” (เมื่อมี 2 ทางเลือก) -------- */
  useEffect(() => {
    if (!promptpayAvailable) return;
    if (payMethod !== null) return;

    Swal.fire({
      icon: 'question',
      title: 'ชำระเงิน',
      text: 'เลือกช่องทางชำระเงินแบบไหน',
      showDenyButton: true,
      confirmButtonText: 'พร้อมเพย์ (QR)',
      denyButtonText: 'โอนเข้าบัญชีธนาคาร',
      confirmButtonColor: '#2563eb',
      denyButtonColor: '#16a34a',
      allowOutsideClick: false,
      allowEscapeKey: false,
      reverseButtons: true,
      footer: '<small style="display:block;margin-top:6px;color:#64748b">หลังชำระแล้ว อย่าลืมกลับมาอัปโหลดสลิป <b>ภายใน 30 นาที</b></small>'
    }).then(r => {
      if (r.isConfirmed) setPayMethod('PROMPTPAY');
      else if (r.isDenied) setPayMethod('BANK');
      else setPayMethod(null);
    });
  }, [promptpayAvailable, payMethod]);

  /* -------- Render QR (เฉพาะตอนเลือก PROMPTPAY) -------- */
  useEffect(() => {
    setQrReady(false);
    if (payMethod !== 'PROMPTPAY') return;
    if (!qrCanvasRef.current || !Number.isFinite(amount) || amount <= 0 || !PROMPTPAY_ID) return;

    (async () => {
      try {
        setQrLoading(true);
        const payload = buildPromptPayPayload(PROMPTPAY_ID, amount);
        if (!payload) throw new Error('empty payload');
        await QRCode.toCanvas(qrCanvasRef.current, payload, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
        setQrReady(true);
      } catch (err) {
        console.error('QR render error:', err);
        setQrReady(false);
      } finally {
        setQrLoading(false);
      }
    })();
  }, [amount, payMethod]);

  /* -------- Anti copy/drag -------- */
  useEffect(() => {
    const el = document.getElementById('anti-capture-root');
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    el.addEventListener('copy', prevent);
    el.addEventListener('dragstart', prevent);
    const onKey = (e) => {
      if (!ALLOW_SCREENSHOT && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        el.style.filter = 'blur(4px)';
        setTimeout(() => { el.style.filter = 'none'; }, 800);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('contextmenu', prevent);
      el.removeEventListener('copy', prevent);
      el.removeEventListener('dragstart', prevent);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const copyText = (txt) => {
    navigator.clipboard.writeText(txt);
    setCopyOk(true);
    setTimeout(() => setCopyOk(false), 1300);
  };

  const validateFile = (f) => {
    if (!f) return { ok: false, msg: 'ไม่พบไฟล์' };
    if (!ACCEPT_MIMES.includes(f.type)) return { ok: false, msg: 'ไฟล์ต้องเป็นรูปภาพ (JPG/PNG/WebP) หรือ PDF เท่านั้น' };
    if (f.size > MAX_FILE_MB * 1024 * 1024) return { ok: false, msg: `ขนาดไฟล์เกิน ${MAX_FILE_MB}MB` };
    return { ok: true };
  };

  // Preview + watermark
  const drawWatermark = async (f) => {
    if (!canvasRef.current) return;
    const isMobile = window.innerWidth < 600;
    const MAX_W = isMobile ? 360 : 520;
    const MAX_H = isMobile ? 560 : 780;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(f);
    objectUrlRef.current = url;

    const img = await createImageBitmap(f);
    let w = img.width, h = img.height;
    const r = Math.min(MAX_W / w, MAX_H / h, 1);
    w = Math.round(w * r); h = Math.round(h * r);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const wm = `ORDER ${orderNo || id} • ${new Date().toLocaleString('th-TH')}`;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.translate(w/2, h/2);
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px system-ui, -apple-system, "Segoe UI", Roboto';
    const step = 80;
    for (let y = -h; y <= h; y += step) for (let x = -w; x <= w; x += step) ctx.fillText(wm, x, y);
    ctx.restore();

    try { setPreviewUrl(canvas.toDataURL('image/png')); } catch {}
    URL.revokeObjectURL(url);
    objectUrlRef.current = '';
  };

  const setSelectedFile = async (f) => {
    const v = validateFile(f);
    if (!v.ok) { Swal.fire('ไฟล์ไม่ถูกต้อง', v.msg, 'warning'); return; }
    setFile(f);
    setPreviewUrl('');
    if (f.type.startsWith('image/')) await drawWatermark(f);
    setTimeout(() => {
      uploadBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  const onInputChange = (e) => {
    const f = e.target.files?.[0] || null;
    if (f) setSelectedFile(f);
    e.target.value = '';
  };

  // Drag & Drop
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const f = e.dataTransfer.files?.[0] || null;
    if (f) setSelectedFile(f);
    dropRef.current?.classList.remove('dragging');
  };
  const onDragOver = (e) => { e.preventDefault(); dropRef.current?.classList.add('dragging'); };
  const onDragLeave = (e) => { e.preventDefault(); dropRef.current?.classList.remove('dragging'); };

  const hideAllActions =
    slipReviewCount >= 3 ||
    paymentStatus === "PAYMENT_CONFIRMED" ||
    orderStatus === "CANCELLED" ||
    paymentStatus === "EXPIRED";

  let errorMessage = "";
  if (slipReviewCount >= 3) errorMessage = "คุณอัปโหลดผิดเกิน 3 ครั้ง กรุณาติดต่อเจ้าหน้าที่";
  else if (paymentStatus === "PAYMENT_CONFIRMED") errorMessage = "รายการนี้ได้รับการยืนยันการชำระเงินแล้ว";
  else if (orderStatus === "CANCELLED") errorMessage = "รายการนี้ถูกยกเลิกแล้ว";
  else if (paymentStatus === "EXPIRED") errorMessage = "รายการนี้หมดอายุแล้ว";

  // สร้างรูปจากการ์ด QR เพื่อบันทึก/แชร์
  const buildQrImage = async () => {
    if (!qrReady) {
      Swal.fire('ยังไม่มี QR', 'โปรดเลือก “พร้อมเพย์ (QR)” และรอให้ QR ปรากฏก่อน', 'info');
    }
    const el = qrBoxRef.current;
    if (!el) throw new Error('QR container not found');
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2, useCORS: true });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    const filename = `promptpay-${orderNo || id}-${Number(amount || 0).toFixed(2)}.png`;
    const file = new File([blob], filename, { type: 'image/png' });
    const dataUrl = canvas.toDataURL('image/png');
    return { blob, file, dataUrl, filename };
  };

  const saveQrToGallery = async () => {
    try {
      const { blob, file, dataUrl, filename } = await buildQrImage();
      if (SUPPORTS_SHARE_FILES) {
        await navigator.share({
          files: [file],
          title: `QR PromptPay ${orderNo || id}`,
          text: `ยอดชำระ ${Number(amount || 0).toFixed(2)} บาท`,
        });
        return true;
      }
      if (IS_IOS || IS_SAFARI) {
        const win = window.open();
        if (win) {
          win.document.write(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${filename}</title></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;"><img src="${dataUrl}" style="max-width:100vw;max-height:100vh;object-fit:contain"/></body></html>`);
          win.document.close();
        }
        Swal.fire('วิธีบันทึก', 'แตะค้างที่รูป → เลือก “บันทึกรูปภาพ”', 'info');
        return true;
      }
      if (SUPPORTS_SAVE_PICKER) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {
      return false;
    }
  };

  // Prompt บันทึก QR — แสดงหลังเลือก PROMPTPAY และ QR พร้อม (ครั้งเดียว/ออเดอร์)
  useEffect(() => {
    if (payMethod !== 'PROMPTPAY') return;
    if (!qrReady) return;
    if (localStorage.getItem(promptKey) === '1') return;

    (async () => {
      const r = await Swal.fire({
        icon: 'question',
        title: 'ต้องการเก็บ QR สำหรับการจ่ายเงิน ไว้ไหม?',
        text: 'ระบบจะช่วยบันทึกรูป QR ลงรูปภาพ/แกลเลอรี่ให้ (ภายหลังแตะค้างที่รูป QR แล้วเลือก “บันทึกรูปภาพ”)',
        showCancelButton: false,
        confirmButtonText: 'บันทึก QR',
        allowOutsideClick: true,
      });
      localStorage.setItem(promptKey, '1');
      if (r.isConfirmed) saveQrToGallery();
    })();
  }, [payMethod, qrReady, promptKey]);

  const onSubmit = async () => {
    if (hideAllActions) { Swal.fire('ไม่สามารถดำเนินการได้', errorMessage, 'error').then(() => navigate('/orders')); return; }
    if (!file) { Swal.fire('กรุณาเลือกไฟล์', 'โปรดแนบไฟล์สลิปก่อนอัปโหลด', 'warning'); return; }
    const v = validateFile(file); if (!v.ok) { Swal.fire('ไฟล์ไม่ถูกต้อง', v.msg, 'warning'); return; }

    try {
      setSubmitting(true);
      const result = await uploadSlip(id, file);
      const code = result?.slipOkResult?.code ?? null;
      const newSlipReviewCount = result?.order?.slipReviewCount ?? 0;
      const newPaymentStatus = result?.order?.paymentStatus || "";
      const newOrderStatus = result?.order?.orderStatus || "";
      setSlipReviewCount(newSlipReviewCount);
      setPaymentStatus(newPaymentStatus);
      setOrderStatus(newOrderStatus);

      if (newSlipReviewCount >= 3) {
        await Swal.fire('สลิปไม่ผ่าน', 'คุณอัปโหลดสลิปผิดเกิน 3 ครั้ง กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบรายการผ่าน LineOA', 'error');
        navigate('/orders');
        return;
      }
      if (code && code !== 0) {
        await Swal.fire('สลิปไม่ผ่าน', result.slipOkResult.message || result.slipOkResult.data?.message || 'โปรดส่งสลิปใหม่อีกครั้ง', 'error');
        return;
      }

      setSuccessOpen(true);
    } catch (e) {
      const data = e?.response?.data || {};
      Swal.fire('ผิดพลาด', data.error || data.message || 'อัปโหลดไม่สำเร็จ', 'error');
    } finally { setSubmitting(false); }
  };

  const onRemoveFile = () => {
    setFile(null);
    setPreviewUrl('');
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const saveBtnLabel = IS_IOS ? 'บันทึกรูป QR ลง “รูปภาพ”'
                    : IS_ANDROID ? 'บันทึกรูป QR ลงแกลเลอรี่'
                    : 'บันทึกรูป QR';

  return (
    <Box
      id="anti-capture-root"
      tabIndex={-1}
      sx={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, py: 4,
        background:
          'radial-gradient(1200px 600px at 8% -10%, rgba(245,158,11,.08), transparent 55%),' +
          'radial-gradient(1200px 600px at 92% 110%, rgba(251,191,36,.10), transparent 55%), #FFFEF5',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%', maxWidth: 600, borderRadius: 4, p: { xs: 2.5, sm: 3 },
          border: '1px solid #FDE68A',
          background: 'linear-gradient(180deg, #FFFFFF, #FFFEF5)',
          boxShadow: '0 10px 26px rgba(245,158,11,.12)',
        }}
      >
        {submitting && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} />}

        <Stack spacing={0.5} alignItems="center" mb={2}>
          <Typography variant="h5" fontWeight={800} color="warning.main" sx={{ letterSpacing: 0.2 }}>
            ชำระเงิน
          </Typography>
          <Typography variant="body2" color="text.secondary">
            เลือกช่องทางชำระเงินแบบไหน
          </Typography>
          {createdAt && (
            <Chip
              size="small"
              icon={<InfoOutlinedIcon fontSize="small" />}
              variant="outlined"
              label={`สั่งซื้อเมื่อ: ${new Date(createdAt).toLocaleString('th-TH')}`}
              sx={{ mt: 0.5, borderColor: '#FDE68A' }}
            />
          )}
        </Stack>

        {/* 🔔 แจ้งเตือนให้กลับมาอัปโหลดสลิป + แจ้ง 30 นาที + ตัวนับเวลา */}
        {!hideAllActions && createdAt && (
          <Alert severity={timeLeftStr === 'หมดเวลา' ? 'error' : 'warning'} sx={{ mb: 2.5, borderRadius: 2 }}>
            โปรดชำระเงินและกลับมา <b>อัปโหลดสลิปภายใน 30 นาที</b> หลังจากสร้างออเดอร์
            {timeLeftStr && (
              <Typography component="span" sx={{ ml: .75 }}>
                (เวลาที่เหลือ: <b>{timeLeftStr}</b>)
              </Typography>
            )}
            <Typography variant="caption" sx={{ display: 'block', mt: .5 }}>
              หากออกจากหน้านี้ไปแอปธนาคาร อย่าลืมกลับมาแนบสลิปด้านล่างเพื่อยืนยันการชำระเงิน
            </Typography>
          </Alert>
        )}

        {/* เลือกวิธีชำระเงิน */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mb: 2 }} justifyContent="center">
          <Tooltip title={promptpayAvailable ? '' : 'ยังไม่ได้ตั้งค่า PromptPay'}>
            <span>
              <Button
                size="large"
                onClick={() => setPayMethod('PROMPTPAY')}
                startIcon={<QrCode2Icon />}
                variant={payMethod === 'PROMPTPAY' ? 'contained' : 'outlined'}
                color="primary"
                disabled={!promptpayAvailable}
                sx={{ fontWeight: 900, px: 2.5, py: 1.25, borderRadius: 3, fontSize: 16 }}
              >
                พร้อมเพย์ (QR)
              </Button>
            </span>
          </Tooltip>

          <Button
            size="large"
            onClick={() => setPayMethod('BANK')}
            startIcon={<AccountBalanceIcon />}
            variant={payMethod === 'BANK' ? 'contained' : 'outlined'}
            color="success"
            sx={{ fontWeight: 900, px: 2.5, py: 1.25, borderRadius: 3, fontSize: 16 }}
          >
            โอนเข้าบัญชีธนาคาร
          </Button>
        </Stack>

        {/* ยอดเงิน */}
        <Box
          sx={{
            borderRadius: 3, px: 2, py: 1.5, mb: 2, textAlign: 'center',
            border: '1px dashed #FDE68A',
            background: 'linear-gradient(180deg, #FFFDF3, #FFF9E6)'
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: 'warning.dark' }}>
            {loading
              ? <CircularProgress size={18} sx={{ verticalAlign: 'middle' }} />
              : (Number.isFinite(amount) && amount > 0 ? `ยอดที่ต้องชำระ: ${amount.toLocaleString()} บาท` : 'ไม่พบยอดเงิน')}
          </Typography>
        </Box>

        {/* Guard */}
        {(slipReviewCount >= 3 || paymentStatus === "PAYMENT_CONFIRMED" || orderStatus === "CANCELLED" || paymentStatus === "EXPIRED") && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
            {slipReviewCount >= 3 ? 'คุณอัปโหลดผิดเกิน 3 ครั้ง กรุณาติดต่อเจ้าหน้าที่ผ่านทาง LineOA'
              : paymentStatus === 'PAYMENT_CONFIRMED' ? 'รายการนี้ได้รับการยืนยันการชำระเงินแล้ว'
              : orderStatus === 'CANCELLED' ? 'รายการนี้ถูกยกเลิกแล้ว' : 'รายการนี้หมดอายุแล้ว'}
          </Alert>
        )}

        {/* การ์ด THAI QR PAYMENT */}
        {payMethod === 'PROMPTPAY' && !(slipReviewCount >= 3 || paymentStatus === "PAYMENT_CONFIRMED" || orderStatus === "CANCELLED" || paymentStatus === "EXPIRED") && (
          <Box
            ref={qrBoxRef}
            sx={{
              mb: 2.5,
              width: '100%',
              maxWidth: 420,
              mx: 'auto',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 8px 22px rgba(0,0,0,.06)',
              border: '1px solid #E3E8F0',
              bgcolor: '#fff'
            }}
          >
            <Box sx={{ bgcolor: '#114b8a', color: '#fff', px: 2, py: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="img" src={THAIQR_LOGO} alt="" onError={(e)=>{ e.currentTarget.style.display='none'; }} sx={{ width: 28, height: 28, objectFit: 'contain' }} />
              <Typography sx={{ fontWeight: 900, letterSpacing: .5 }}>THAI QR PAYMENT</Typography>
            </Box>

            <Box sx={{ p: 2.2, textAlign: 'center' }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.2, py: .4, border: '1px solid #CBD5E1', borderRadius: 1, mb: 1.2 }}>
                <Box component="img" src={PROMPTPAY_LOGO} alt="PromptPay"
                     onError={(e)=>{ e.currentTarget.replaceWith(Object.assign(document.createElement('span'),{innerText:'PromptPay',style:'font-weight:800'}) ); }}
                     sx={{ height: 18, objectFit: 'contain' }} />
                <Typography variant="caption" sx={{ opacity: .75 }}>พร้อมเพย์</Typography>
              </Box>

              <Box sx={{ display:'inline-block', border: '6px solid #F1F5F9', borderRadius: 2, background: '#fff', position:'relative' }}>
                {!qrReady && (
                  <Stack alignItems="center" justifyContent="center" sx={{ position:'absolute', inset:0 }}>
                    {qrLoading ? <CircularProgress size={28} /> : <Typography variant="caption" color="text.secondary">ยังไม่มี QR</Typography>}
                  </Stack>
                )}
                <canvas
                  ref={qrCanvasRef}
                  style={{ width: 260, height: 260, display: 'block', opacity: qrReady ? 1 : 0.2 }}
                  onContextMenu={(e)=>e.preventDefault()}
                  title="แตะค้างเพื่อบันทึกรูป QR"
                />
              </Box>

              <Box sx={{ mt: 1.3, lineHeight: 1.2 }}>
                <Typography sx={{ fontWeight: 800 }}>{MERCHANT_NAME}</Typography>
                <Typography variant="caption" color="text.secondary">{MERCHANT_NOTE}</Typography>
              </Box>

              <Stack direction="row" spacing={1} mt={1.2} justifyContent="center">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={saveQrToGallery}
                  disabled={!qrReady}
                >
                  {saveBtnLabel}
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display:'block', mt: .8 }}>
                ถ้าต้องการภายหลัง: แตะค้างที่รูป QR แล้วเลือก “บันทึกรูปภาพ”
              </Typography>
            </Box>
          </Box>
        )}

        {/* การ์ดเลขบัญชี */}
        {payMethod === 'BANK' && (
          <Box
            sx={{
              mb: 2.5, p: 2, borderRadius: 2, border: '1px solid #E3E8F0',
              bgcolor: '#fff', boxShadow: '0 8px 22px rgba(0,0,0,.04)'
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" mb={1}>
              <Avatar src={BANK_INFO.logo} sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
              <Typography fontWeight={800} color="success.main">{BANK_INFO.name}</Typography>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: .5 }}>ชื่อบัญชี: {BANK_INFO.accountName}</Typography>

            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Chip label={BANK_INFO.accountNumber} variant="outlined" sx={{ fontWeight: 900, letterSpacing: 1 }} />
              <Tooltip title="คัดลอกเลขที่บัญชี">
                <IconButton size="small" onClick={() => copyText(BANK_INFO.accountNumber)}>
                  <ContentCopyIcon fontSize="small" color={copyOk ? 'success' : 'inherit'} />
                </IconButton>
              </Tooltip>
              {copyOk && <Chip size="small" color="success" icon={<CheckCircleIcon />} label="คัดลอกแล้ว" sx={{ ml: 0.5 }} />}
            </Stack>

            <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
              โอนแล้วโปรดแนบสลิปด้านล่างเพื่อยืนยันการชำระเงิน
            </Alert>
          </Box>
        )}

        {/* ถ้ายังไม่เลือกช่องทาง — แสดงคำแนะนำ และซ่อนส่วนอัปโหลด */}
        {payMethod === null && (
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
            กรุณาเลือกช่องทางชำระเงินก่อน
          </Alert>
        )}

        {/* Drop Zone / Preview / Upload — แสดงเมื่อเลือกช่องทางแล้วเท่านั้น */}
        {payMethod !== null && (
          <>
            <Box
              ref={dropRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              sx={{
                p: 2.2, textAlign: 'center', mb: 2.5, borderRadius: 3, transition: 'all .15s ease',
                border: '2px dashed rgba(245,158,11,0.55)',
                background: 'repeating-linear-gradient(45deg, #FFFCF0, #FFFCF0 12px, #FFF6D9 12px, #FFF6D9 24px)',
                '&.dragging': { borderColor: '#2e7d32', background: 'linear-gradient(180deg, #e8f5e9, #f1fff4)' },
              }}
            >
              <CloudUploadIcon />
              <Typography mt={0.5} sx={{ fontWeight: 800 }}>ลากไฟล์มาวาง หรือกดเลือกไฟล์</Typography>
              <Typography variant="body2" color="text.secondary">
                รองรับ JPG / PNG / WebP / PDF (ไม่เกิน {MAX_FILE_MB}MB)
              </Typography>

              <input
                id="slip-file-input"
                type="file"
                accept="image/*,application/pdf"
                onChange={onInputChange}
                style={{ position:'absolute', width:1, height:1, padding:0, margin:-1, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap', border:0 }}
              />
              <label htmlFor="slip-file-input">
                <Button variant="outlined" sx={{ mt: 1.4, borderRadius: 2 }} component="span">
                  เลือกไฟล์สลิป
                </Button>
              </label>
            </Box>

            <Fade in={!!file}>
              <Box mb={2} textAlign="center">
                {file?.type?.startsWith('image/') ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      style={{
                        width: '100%', height: 'auto', maxWidth: 520,
                        borderRadius: 12, border: '1.5px solid #F3F4F6',
                        boxShadow: '0 8px 20px rgba(245,158,11,.12)', display: 'block', margin: '0 auto', pointerEvents: 'none',
                      }}
                    />
                    {previewUrl && (
                      <MuiLink component="button" type="button" onClick={() => setPreviewOpen(true)} underline="hover" sx={{ mt: 1, fontWeight: 700 }}>
                        ดูภาพเต็ม
                      </MuiLink>
                    )}
                  </>
                ) : file ? (
                  <Chip label={`ไฟล์ PDF: ${file.name}`} variant="outlined" color="warning" />
                ) : null}

                {file && (
                  <Stack alignItems="center" spacing={1} mt={1}>
                    <Typography variant="body2">{file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB</Typography>
                    <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineIcon />} onClick={onRemoveFile}>
                      เอาไฟล์ออก
                    </Button>
                  </Stack>
                )}
              </Box>
            </Fade>

            <Button
              ref={uploadBtnRef}
              variant="contained" color="warning" onClick={onSubmit}
              disabled={!file || loading || submitting}
              fullWidth size="large"
              sx={{ mt: 0.5, borderRadius: 3, fontWeight: 800, fontSize: 18, letterSpacing: 0.2, py: 1.1 }}
            >
              {submitting ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
            </Button>
          </>
        )}

        <Divider sx={{ my: 2.5, borderColor: '#FDE68A' }} />
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          มีการป้องกันการคัดลอก/ลากรูปภาพออกจากหน้านี้
          {ALLOW_SCREENSHOT ? '' : ' (เปิดเอฟเฟกต์กันแคปหน้าจอ)'}
        </Typography>
      </Paper>

      {/* Full preview */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 0, background: '#000' }}>
          {previewUrl && (
            <img src={previewUrl} alt="สลิป (ขนาดเต็ม)" style={{ width: '100%', height: 'auto', display: 'block' }} draggable={false} onContextMenu={(e)=>e.preventDefault()} />
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setPreviewOpen(false)}>ปิด</Button></DialogActions>
      </Dialog>

      {/* Success */}
      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', pt: 3 }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h6" fontWeight={800} gutterBottom>อัปโหลดสลิปเรียบร้อย</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            ขอบคุณสำหรับการสั่งซื้อค่ะ! ระบบได้รับคำสั่งซื้อเรียบร้อยค่ะ
          </Typography>
          {!!orderNo && <Chip variant="outlined" color="success" label={`เลขออเดอร์: ${orderNo}`} sx={{ mb: 2 }} />}
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button variant="outlined" onClick={() => setSuccessOpen(false)}>ปิด</Button>
            <Button variant="contained" color="warning" onClick={() => navigate('/orders')}>ไปดูสถานะออเดอร์</Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}