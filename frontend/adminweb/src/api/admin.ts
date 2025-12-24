import api from '../lib/axios';
/* ============================ Auth ============================ */
export async function adminLogin(username: string, password: string) {
  const { data } = await api.post('/users/login', { username, password });
  return data as { token: string; user: any; expiresIn?: number };
}
export async function adminLogout() { try { await api.post('/users/logout'); } catch {} }

/* ✅ NEW: verify password (ปลดล็อกแก้ไข) */
export async function verifyMyPassword(password: string) {
  const { data } = await api.post('/users/verify-password', { password });
  return !!data?.ok;
}

/* ============================ Orders ============================ */
export type OrderItem = { productName: string; size?: string; color?: string; price: number; quantity: number };
export type StatusTimelineEntry = { at?: string; action: string; note?: string; by?: string; role?: string };

export type Order = {
  _id: string;
  orderNo: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerLineId?: string;
  items?: OrderItem[];
  totalAmount: number;
  paymentStatus: 'WAITING'|'PENDING_PAYMENT'|'PAYMENT_CONFIRMED'|'REJECTED'|'EXPIRED';
  orderStatus: 'RECEIVED'|'PREPARING_ORDER'|'SHIPPING'|'COMPLETED'|'CANCELLED';
  shippingType?: 'DELIVERY'|'PICKUP_EVENT'|'PICKUP_SMAKHOM';
  shippingProvider?: string;
  trackingNumber?: string;
  slipReviewCount?: number;
  paymentSlipFilename?: string;
  statusTimeline?: StatusTimelineEntry[];   // ✅ NEW
  createdAt: string;
  updatedAt?: string;
};

export async function listOrders() {
  const { data } = await api.get('/orders');
  return Array.isArray(data) ? data as Order[] : [];
}
export async function getOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data as Order;
}
export async function updateOrder(id: string, patch: Partial<Order> & Record<string, any>) {
  const { data } = await api.put(`/orders/${id}`, patch);
  return data as Order;
}
export async function verifySlip(id: string) {
  const { data } = await api.post(`/orders/${id}/slip/verify`);
  return data as { order: Order; slipOkResult?: { success: boolean; message?: string } };
}
export async function getSlipSignedUrl(id: string) {
  const { data } = await api.get(`/orders/${id}/slip-file`);
  return data?.url as string | undefined;
}
export async function retrySlip(id: string, file: File) {
  const fd = new FormData();
  fd.append('slip', file);
  const { data } = await api.post(`/orders/${id}/slip/retry`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data as { order: Order; slipOkResult?: { success: boolean; message?: string } };
}

/* ✅ NEW: Tracking template / import */
export function trackingTemplateUrl() {
  return `/api/orders/tracking-template`;
}
export async function importTrackingNumbers(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post('/orders/tracking-import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data as { success: boolean; updated: number; failed: number; errors: { row: number; orderNo?: string; reason: string }[] };
}


// ============================ Products / Inventory ============================

// ถ้าโปรเจ็กต์คุณยังไม่มี type เหล่านี้ ให้เพิ่มด้วย (ถ้ามีอยู่แล้ว ข้ามส่วนนี้ได้)
export type Variant = {
  _id?: string;
  size?: string;
  color?: string;
  price?: number;
  stock?: number;
};
export type Product = {
  _id: string;
  name: string;
  variants: Variant[];
  preorder?: boolean;
};

// ดึงสินค้าพร้อม variants มาใช้สร้าง PO
export async function listInventory() {
  // บางโปรเจ็กต์มี endpoint /inventory, บางโปรเจ็กต์ใช้ /products
  try {
    const { data } = await api.get('/inventory');
    return Array.isArray(data) ? (data as Product[]) : [];
  } catch {
    const { data } = await api.get('/products');
    return Array.isArray(data) ? (data as Product[]) : [];
  }
}

/* ============================ (อื่น ๆ คงเดิม) ============================ */
// ... products / inventory / roles / po / receiving ตามไฟล์เดิม ...
/* ============================ Purchasing (PO) ============================ */
export type POItem = {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
};
export type PO = {
  _id: string;
  poNumber: string;
  supplierName?: string;
  status: 'DRAFT'|'ORDERED'|'PARTIAL'|'RECEIVED'|'CANCELLED';
  orderDate?: string;
  expectedReceiveDate?: string;
  totalAmount?: number;
  items?: POItem[];
};

export async function listPO()        { const { data } = await api.get('/purchase-orders'); return Array.isArray(data) ? data as PO[] : []; }
export async function getPO(id: string) { const { data } = await api.get(`/purchase-orders/${id}`); return data as PO; }
export async function createPO(body: Partial<PO> & { items?: POItem[] }) {
  const { data } = await api.post('/purchase-orders', body); return data as PO;
}
export async function updatePO(id: string, body: Partial<PO>) {
  const { data } = await api.put(`/purchase-orders/${id}`, body); return data as PO;
}
export function exportPOUrl(id: string, type: 'pdf'|'excel' = 'pdf') {
  return `/api/purchase-orders/${id}/export?type=${type}`; // ใช้กับ window.open
}

/* ============================ Receiving ============================ */
export type ReceivingItem = {
  productId: string;
  variantId?: string;
  quantity: number;
  unitCost?: number;
};
export type Receiving = {
  _id: string;
  receivingNumber: string;
  po?: string; // id
  receiverName?: string;
  receiveDate?: string;
  status: 'COMPLETE'|'PARTIAL'|'REJECTED';
  items?: ReceivingItem[];
};

export async function listReceiving() { const { data } = await api.get('/receivings'); return Array.isArray(data) ? data as Receiving[] : []; }
export async function getReceiving(id: string) { const { data } = await api.get(`/receivings/${id}`); return data as Receiving; }
export async function createReceiving(body: Partial<Receiving> & { items?: ReceivingItem[] }) {
  // สมมติฝั่ง backend จะอัปเดตสต๊อกทันทีเมื่อสร้าง receiving สำเร็จ
  const { data } = await api.post('/receivings', body);
  return data as Receiving;
}
export async function updateReceiving(id: string, body: Partial<Receiving>) {
  const { data } = await api.put(`/receivings/${id}`, body);
  return data as Receiving;
}
export function exportReceivingUrl(id: string, type: 'pdf'|'excel' = 'pdf') {
  return `/api/receivings/${id}/export?type=${type}`;
}