// backend/src/utils/validate.js
'use strict';

/* ======================== Basic validators ======================== */
function isPhoneNumber(input) {
  if (typeof input !== 'string') return false;
  const s = input.replace(/[\s-]/g, '');
  // รองรับ 09XXXXXXXX (9–10 หลัก) และ +66xxxxxxxx
  if (s.startsWith('+66')) {
    const rest = s.slice(3).replace(/^0/, '');
    return /^\d{8,9}$/.test(rest);
  }
  return /^\d{9,10}$/.test(s);
}

function isEmail(input) {
  if (typeof input !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input);
}

function isLineId(input) {
  // LINE LIFF userId: 'U' + 32 hex chars
  if (typeof input !== 'string') return false;
  return /^U[a-fA-F0-9]{32}$/.test(input);
}

/* ======================== Normalizers ======================== */
function toNumber(n, def = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}
function toStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * ทำให้ items อยู่ในรูปแบบเดียวกัน และ “บังคับ” ให้มี product เสมอ
 * - รองรับ payload เก่า (มี productId ระดับบน)
 * - ใส่ทั้ง qty และ quantity ให้เท่ากัน
 */
function normalizeOrderItems(items, fallbackProductId) {
  const list = Array.isArray(items) ? items : [];
  return list.map((it) => {
    const qty = toNumber(it.qty ?? it.quantity ?? 0, 0);
    const price = toNumber(it.price ?? 0, 0);
    const product =
      toStr(it.product) ||
      toStr(it.productId) ||        // เผื่อ front เก่าส่งชื่อคีย์ productId
      toStr(fallbackProductId);     // เผื่อ legacy payload ใส่ productId ไว้ระดับบน

    return {
      ...it,
      product,
      size: toStr(it.size),
      color: toStr(it.color),
      price,
      qty,
      quantity: qty,
    };
  });
}

/* ======================== Middlewares ======================== */
/** เพิ่มสินค้า: ต้องมี name และ variants อย่างน้อย 1 */
function validateProduct(req, res, next) {
  const { name, variants } = req.body || {};

  if (!toStr(name)) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อสินค้า' });
  }
  if (!Array.isArray(variants) || variants.length === 0) {
    return res.status(400).json({ error: 'ต้องมีไซซ์/สีสินค้าอย่างน้อย 1 แบบ' });
  }

  for (const v of variants) {
    if (!toStr(v.size))  return res.status(400).json({ error: 'กรุณาระบุไซซ์สินค้า' });
    if (!toStr(v.color)) return res.status(400).json({ error: 'กรุณาระบุสีสินค้า' });

    const price = toNumber(v.price, NaN);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'กรุณากรอกราคาสินค้าให้ถูกต้อง' });
    }

    const stock = toNumber(v.stock, NaN);
    if (!Number.isFinite(stock) || stock < 0) {
      return res.status(400).json({ error: 'กรุณากรอกจำนวนสต๊อกให้ถูกต้อง' });
    }
  }

  next();
}

/**
 * สร้างออเดอร์:
 * - อ่าน lineId จาก token เมื่อเป็น LIFF user (กันปลอม)
 * - ตรวจ displayName
 * - ตรวจ items ทุกชิ้น: product/size/color/price/qty
 * - ตรวจ shipping/phone (ถ้ามี)
 */
function validateOrder(req, res, next) {
  const b = req.body || {};
  const isCustomer = req.user?.type === 'liff';

  // ถ้าลูกค้าจริง ให้อิง LINE ID จาก token เท่านั้น
  const lineId = isCustomer ? req.user?.lineId : toStr(b.lineId);
  if (!isLineId(lineId)) {
    return res.status(400).json({ error: 'LINE ID ลูกค้าไม่ถูกต้อง' });
  }

  if (!toStr(b.displayName)) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อ (display name) ลูกค้า' });
  }

  // normalize + รองรับ legacy productId ระดับบน
  const items = normalizeOrderItems(b.items, b.productId);
  if (!items.length) {
    return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' });
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    if (!toStr(it.product)) {
      return res.status(400).json({ error: `แถวที่ ${i + 1}: ต้องระบุ product` });
    }
    if (!toStr(it.size)) {
      return res.status(400).json({ error: `แถวที่ ${i + 1}: ต้องระบุไซซ์สินค้า` });
    }
    if (!toStr(it.color)) {
      return res.status(400).json({ error: `แถวที่ ${i + 1}: ต้องระบุสีสินค้า` });
    }
    if (!Number.isFinite(it.price) || it.price <= 0) {
      return res.status(400).json({ error: `แถวที่ ${i + 1}: ราคาไม่ถูกต้อง` });
    }
    if (!Number.isFinite(it.qty) || it.qty < 1) {
      return res.status(400).json({ error: `แถวที่ ${i + 1}: จำนวนต้องอย่างน้อย 1` });
    }
  }

  // ตรวจ phone ถ้ามี
  if (b.customerPhone && !isPhoneNumber(String(b.customerPhone))) {
    return res.status(400).json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง (9-10 หลัก หรือ +66)' });
  }

  // ตรวจ shippingType ถ้ามี + ที่อยู่เมื่อเลือก DELIVERY
  if (b.shippingType) {
    const okShip = ['PICKUP_SMAKHOM', 'PICKUP_EVENT', 'DELIVERY'];
    if (!okShip.includes(b.shippingType)) {
      return res.status(400).json({ error: 'ประเภทการรับสินค้าไม่ถูกต้อง' });
    }
    if (b.shippingType === 'DELIVERY' && !toStr(b.customerAddress)) {
      return res.status(400).json({ error: 'กรุณากรอกที่อยู่สำหรับจัดส่ง' });
    }
  }

  // เขียนกลับให้ controller ใช้ต่อ
  req.body.items = items;
  req.body.lineId = lineId;

  next();
}

module.exports = {
  // helpers
  isPhoneNumber,
  isEmail,
  isLineId,
  normalizeOrderItems,
  // middlewares
  validateProduct,
  validateOrder,
};