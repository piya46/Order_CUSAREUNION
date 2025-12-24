// src/api/orderApi.js
import api from './axios';

/** ดึงออเดอร์ของผู้ใช้ (อ่านจาก token) */
export async function getOrders() {
  const res = await api.get('/api/orders/user');
  return res.data; // Order[]
}

/** รายละเอียดออเดอร์ */
export async function getOrderDetail(orderId) {
  const res = await api.get(`/api/orders/${orderId}`);
  return res.data; // Order
}

/** ขอ URL แบบ signed สำหรับดูสลิป */
export async function getSlipSignedUrl(orderId) {
  const res = await api.get(`/api/orders/${orderId}/slip-file`);
  return res.data?.url || res.data || '';
}

/**
 * สร้างออเดอร์ (รองรับหลายสินค้า/หลายโปรดักต์)
 * โครง payload:
 * {
 *   lineId, displayName, shippingType, customerAddress, customerPhone,
 *   items: [
 *     { product, variantId?, size, color, price, qty|quantity }
 *   ]
 * }
 */
export async function createOrder(payload) {
  // guard เบื้องต้น
  if (!payload?.lineId?.startsWith('U') || payload.lineId.length !== 33) {
    throw new Error('lineId ไม่ถูกต้อง (ต้องขึ้นต้นด้วย U และยาว 33 ตัวอักษร)');
  }
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new Error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
  }

  // --- ทำความสะอาด/ทำให้เป็นรูปแบบเดียวกัน ---
  const topProductId = payload.productId || payload.product || null;

  const normalizedItems = payload.items
    .map((it) => {
      // รองรับทั้ง it.product, it.productId และกรณีมี productId เดี่ยว (ย้อนกลับได้)
      const product =
        String(it.product || it.productId || topProductId || '').trim();

      // จำนวน
      const q = Number(it.quantity ?? it.qty ?? it.q ?? 0);

      // variant id (optional)
      const variantId = it.variantId ?? it.variant_id ?? it.id ?? '';

      return {
        product,                            // <= สำคัญ (ต้องมีต่อชิ้น)
        productName: it.productName || it.name || undefined,
        variantId: String(variantId || ''),
        size: String(it.size ?? ''),
        color: String(it.color ?? ''),
        price: Number(it.price ?? 0),
        quantity: q,                        // ฝั่งหลังบ้านเก็บใน quantity
        qty: q,                             // เผื่อ compat หลังบ้านที่รองรับทั้งสองคีย์
      };
    })
    // ตัดทิ้งรายการที่ไม่มี product หรือจำนวน <= 0
    .filter((x) => x.product && x.quantity > 0);

  if (normalizedItems.length === 0) {
    throw new Error('ข้อมูลรายการสินค้าไม่ถูกต้อง');
  }

  // --- ถอยหลังเข้ากันได้กับ API เก่าที่ต้องมี productId เดี่ยว ---
  const uniqProducts = [...new Set(normalizedItems.map((x) => x.product))];
  const normalizedPayload = {
    ...payload,
    items: normalizedItems,
  };
  if (!normalizedPayload.productId && uniqProducts.length === 1) {
    normalizedPayload.productId = uniqProducts[0];
  }

  const res = await api.post('/api/orders', normalizedPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data; // -> Order ที่ถูกสร้าง
}


export async function createOrderFromCart(payload) {
  return createOrder(payload);
}

/** อัปโหลด/เปลี่ยนสลิป */
export async function uploadSlip(orderId, file) {
  const form = new FormData();
  form.append('slip', file);
  const res = await api.post(`/api/orders/${orderId}/slip`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}