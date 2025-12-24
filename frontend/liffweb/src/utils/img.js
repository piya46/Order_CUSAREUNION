// utils/img.js
import { toBackendURL } from '../api/axios';

const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|avif)$/i;

// แปลงให้เป็น URL รูป public uploads เท่านั้น
export function toPublicUpload(u) {
  if (!u) return null;
  let s = typeof u === 'object' && u.url ? String(u.url) : String(u).trim();

  // 0) ไม่เอา private signed (/api/files) มาแสดงในแคตตาล็อก
  if (/\/api\/files\b/i.test(s)) return null;

  // 1) ถ้าเป็น absolute URL
  try {
    const url = new URL(s);
    // 1.1) อนุญาตเฉพาะ path ที่อยู่ใต้ /public_uploads → เก็บแค่ path+query
    if (url.pathname.includes('/public_uploads/')) {
      s = url.pathname + (url.search || '');
    } else {
      return null; // absolute อื่นๆ ไม่อนุญาต
    }
  } catch {
    // ไม่ใช่ absolute → ไปเช็คกรณีถัดไป
  }

  // 2) ถ้าเป็น “ชื่อไฟล์ล้วนๆ” ให้ map ไป /public_uploads/<file>
  if (/^[\w.-]+\.(png|jpe?g|gif|webp|avif)$/i.test(s)) {
    s = `/public_uploads/${s}`;
  }

  // 3) ถ้ามีคำว่า public_uploads อยู่ในสตริง บังคับให้ขึ้นต้นด้วย /
  const idx = s.indexOf('public_uploads/');
  if (idx !== -1) s = '/' + s.slice(idx);

  // 4) สุดท้าย: ต้องขึ้นต้นด้วย /public_uploads/ และเป็นไฟล์รูปเท่านั้น
  if (!s.startsWith('/public_uploads/')) return null;
  if (!IMG_EXT_RE.test(s)) return null;

  // 5) แปลงเป็น absolute ให้เหมาะกับ env (proxy/dev หรือ prod)
  try {
    return toBackendURL(s);
  } catch {
    // เผื่อกรณี dev บางแบบ ให้คืน path ตรง ๆ
    return s;
  }
}

// รวมรูปจากฟิลด์ต่าง ๆ แล้วแปลงเป็น absolute URL
export function collectImages(p = {}) {
  const raw = [
    ...(Array.isArray(p.imageUrls) ? p.imageUrls : []),
    ...(Array.isArray(p.images) ? p.images : []),
    p.thumbnail,
    p.imageUrl,
  ];

  // ✅ เก็บรูปที่มากับ variants ด้วย
  if (Array.isArray(p.variants)) {
    p.variants.forEach(v => {
      if (v?.image) raw.push(v.image);
      if (Array.isArray(v?.images)) raw.push(...v.images);
    });
  }

  const out = raw.map(toPublicUpload).filter(Boolean);
  return [...new Set(out)];
}

// ภาพแรกของสินค้า (absolute URL) ถ้าไม่มี คืน null
export function firstImageUrl(product) {
  return collectImages(product)[0] || null;
}