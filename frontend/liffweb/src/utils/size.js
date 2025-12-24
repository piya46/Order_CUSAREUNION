// src/utils/size.js

// ลำดับไซส์มาตรฐาน (ใช้เป็น fallback เมื่อไม่มีตัวเลขรอบอก/ความยาว)
const SIZE_ORDER = [
  'XXS', 'SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
  '28','30','32','34','36','38','40','42','44','46','48','50'
];

// helper ให้ไฟล์อื่นเรียกได้
export function sizeOrderIndex(label = '') {
  const u = String(label || '').toUpperCase();
  const idx = SIZE_ORDER.indexOf(u);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/**
 * แยก "ไซส์:รอบอก,ความยาว" จากสตริง เช่น
 *   "S:36,25"  "M:38/26"  "L:40x27"  "XL: 42 28"
 * - label = ส่วนก่อน ":" (หรือทั้งสตริงถ้าไม่มี :)
 * - chest  = ตัวเลขตัวแรกหลัง ":" (นิ้ว)
 * - length = ตัวเลขตัวถัดไปหลัง ":" (นิ้ว) ถ้าไม่มี → null
 */
export function parseSizeChestLen(raw) {
  if (!raw) return { label: '', chest: null, length: null };
  const s = String(raw).trim();

  const [left, right = ''] = s.split(':').map(x => x.trim());
  const label = (left || s).toUpperCase();

  // ดึงตัวเลขจากส่วนขวาหลัง ":" รองรับ ตัวคั่น , / x × หรือเว้นวรรค
  const nums = (right.match(/(\d+(?:\.\d+)?)/g) || []).map(n => parseFloat(n));
  const chest = nums.length >= 1 ? nums[0] : null;
  const length = nums.length >= 2 ? nums[1] : null;

  return { label, chest, length };
}

/** สรุปไซส์จาก product.variants (unique ตาม label) */
export function summarizeSizes(product) {
  const map = new Map();
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  variants.forEach(v => {
    const { label, chest, length } = parseSizeChestLen(v?.size);
    if (!label) return;
    const prev = map.get(label);
    if (!prev) map.set(label, { label, chest, length });
    else {
      // อัปเดตข้อมูลที่ขาดหาย: เก็บค่าที่ "มีข้อมูล" ทับค่า null
      map.set(label, {
        label,
        chest: prev.chest ?? chest ?? null,
        length: prev.length ?? length ?? null
      });
    }
  });
  return Array.from(map.values());
}

/** เรียงไซส์เล็ก→ใหญ่: chest มาก่อน, ถ้าเท่ากันใช้ length, ถ้ายังไม่มีเลขใช้ลำดับ SIZE_ORDER */
export function sortSizes(rows) {
  return [...rows].sort((a, b) => {
    const ac = a.chest, bc = b.chest;
    if (ac != null && bc != null && ac !== bc) return ac - bc;
    const al = a.length, bl = b.length;
    if (ac != null && bc != null && al != null && bl != null && al !== bl) return al - bl;

    const ai = sizeOrderIndex(a.label);
    const bi = sizeOrderIndex(b.label);
    if (ai !== bi) return ai - bi;

    return String(a.label).localeCompare(String(b.label), 'th');
  });
}