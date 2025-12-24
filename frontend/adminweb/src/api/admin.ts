import api from '../lib/axios';

/* ============================ Auth ============================ */
export async function adminLogin(username: string, password: string) {
  const { data } = await api.post('/users/login', { username, password });
  return data as { token: string; user: any; expiresIn?: number };
}
export async function adminLogout() { try { await api.post('/users/logout'); } catch {} }

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
  statusTimeline?: StatusTimelineEntry[];
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


/* ============================ Products / Inventory ============================ */
export type Variant = {
  _id: string;
  size: string;
  color?: string;
  price: number;
  stock: number;
  locked?: number;
};
export type Product = {
  _id: string;
  productCode: string;
  name: string;
  images?: string[];
  variants: Variant[];
  preorder?: boolean;
};

export async function listInventory() {
  try {
    const { data } = await api.get('/products'); // Backend ปกติใช้ /products
    return Array.isArray(data) ? (data as Product[]) : [];
  } catch {
    return [];
  }
}

/* ============================ Purchasing (PO) ============================ */
export type POItem = {
  product?: string | Product; // รองรับทั้ง ID (ตอนส่งไป) และ Object (ตอนรับมา)
  productId?: string;        // เผื่อไว้สำหรับบาง logic
  productName?: string;      // ชื่อสินค้า (Flatten มาแล้วหรือมีใน response)
  variantId?: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice?: number;        // Backend อาจส่งมาเป็น price หรือ unitPrice
  price?: number;
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
  createdAt?: string;
};

export async function listPO() { 
  const { data } = await api.get('/purchase-orders'); 
  return Array.isArray(data) ? data as PO[] : []; 
}

export async function getPO(id: string) { 
  const { data } = await api.get(`/purchase-orders/${id}`); 
  return data as PO; 
}

export async function createPO(body: Partial<PO> & { items?: any[] }) {
  const { data } = await api.post('/purchase-orders', body); 
  return data as PO;
}

export async function updatePO(id: string, body: Partial<PO>) {
  const { data } = await api.put(`/purchase-orders/${id}`, body); 
  return data as PO;
}

// ✅ [FIX] เพิ่มฟังก์ชัน Download PO (Blob)
export async function downloadPO(id: string, type: "pdf" | "excel") {
  const { data } = await api.get(`/purchase-orders/${id}/export`, {
    params: { type },
    responseType: "blob", // สำคัญมาก
  });
  
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `PO-${id}.${type === 'excel' ? 'xlsx' : 'pdf'}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// เก็บไว้เผื่อใช้แบบเก่า (แต่แนะนำให้ใช้ downloadPO ด้านบน)
export function exportPOUrl(id: string, type: 'pdf'|'excel' = 'pdf') {
  return `${import.meta.env.VITE_API_URL || ''}/api/purchase-orders/${id}/export?type=${type}`;
}

/* ============================ Receiving ============================ */
export type ReceivingItem = {
  product?: string | Product;
  productId?: string;
  productName?: string;
  variantId?: string;
  size?: string;
  color?: string;
  quantity: number;
  unitCost?: number;
};

export type Receiving = {
  _id: string;
  receivingNumber: string;
  po?: string | PO; // อาจจะเป็น Object PO ถ้า populate
  receiverName?: string;
  receiveDate?: string;
  status: 'COMPLETE'|'PARTIAL'|'REJECTED';
  items?: ReceivingItem[];
  createdAt?: string;
};

export async function listReceiving() { 
  const { data } = await api.get('/receivings'); 
  return Array.isArray(data) ? data as Receiving[] : []; 
}

export async function getReceiving(id: string) { 
  const { data } = await api.get(`/receivings/${id}`); 
  return data as Receiving; 
}

export async function createReceiving(body: Partial<Receiving> & { items?: any[] }) {
  const { data } = await api.post('/receivings', body);
  return data as Receiving;
}

export async function updateReceiving(id: string, body: Partial<Receiving>) {
  const { data } = await api.put(`/receivings/${id}`, body);
  return data as Receiving;
}

// ✅ [FIX] เพิ่มฟังก์ชัน Download Receiving (Blob)
export async function downloadReceiving(id: string, type: "pdf" | "excel") {
  const { data } = await api.get(`/receivings/${id}/export`, {
    params: { type },
    responseType: "blob",
  });
  
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `REC-${id}.${type === 'excel' ? 'xlsx' : 'pdf'}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function exportReceivingUrl(id: string, type: 'pdf'|'excel' = 'pdf') {
  return `${import.meta.env.VITE_API_URL || ''}/api/receivings/${id}/export?type=${type}`;
}

/* ============================ Issues ============================ */
// import { Issue } from '../types'; // ถ้ามีไฟล์ types แยกให้ uncomment
// หรือ define type ง่ายๆ ไว้ตรงนี้ถ้าไม่มีไฟล์แยก
export type Issue = {
  _id: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
};

export async function listIssues() {
  const { data } = await api.get('/issues');
  return Array.isArray(data) ? (data as Issue[]) : [];
}

export async function createIssue(payload: Partial<Issue>) {
  const { data } = await api.post('/issues', payload);
  return data as Issue;
}

export async function updateIssue(id: string, payload: Partial<Issue>) {
  const { data } = await api.put(`/issues/${id}`, payload);
  return data as Issue;
}