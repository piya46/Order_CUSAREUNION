// src/api/admin.ts
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

// ✅ แก้ไข: เพิ่ม slipUrl และ slipOkResult ใน Type หลัก
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
  
  // ✅ เพิ่ม field นี้เพื่อให้ TypeScript รู้จัก Signed URL
  slipUrl?: string; 
  
  // ✅ เพิ่ม field นี้เผื่อไว้แสดงผลการตรวจสอบ
  slipOkResult?: { success: boolean; message?: string };

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
  try {
    // เรียก API เพื่อขอ URL จริงที่มีลายเซ็น
    const { data } = await api.get(`/orders/${id}/slip-file`);
    return data; // backend อาจส่งมาเป็น { url: "..." } หรือ string
  } catch (error) {
    console.error("Get slip url failed", error);
    return null;
  }
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
    const { data } = await api.get('/products');
    return Array.isArray(data) ? (data as Product[]) : [];
  } catch {
    return [];
  }
}

/* ============================ Suppliers (COMPLETE) ============================ */
export type Supplier = {
  _id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  isActive?: boolean;
};

export async function listSuppliers() {
  const { data } = await api.get('/suppliers');
  return Array.isArray(data) ? data as Supplier[] : [];
}

export async function getSupplier(id: string) {
  const { data } = await api.get(`/suppliers/${id}`);
  return data as Supplier;
}

export async function createSupplier(body: Partial<Supplier>) {
  const { data } = await api.post('/suppliers', body);
  return data as Supplier;
}

export async function updateSupplier(id: string, body: Partial<Supplier>) {
  const { data } = await api.put(`/suppliers/${id}`, body);
  return data as Supplier;
}

export async function deleteSupplier(id: string) {
  const { data } = await api.delete(`/suppliers/${id}`);
  return data as { success: boolean; message?: string };
}

/* ============================ Purchasing (PO) ============================ */
export type POItem = {
  product?: string | Product;
  productId?: string;
  productName?: string;
  variantId?: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
};

export type PO = {
  _id: string;
  poNumber: string;
  supplier: Supplier | string; 
  supplierNameSnapshot?: string;
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

export async function downloadPO(id: string, type: "pdf" | "excel") {
  const { data } = await api.get(`/purchase-orders/${id}/export`, {
    params: { type },
    responseType: "blob",
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
  po?: string | PO;
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