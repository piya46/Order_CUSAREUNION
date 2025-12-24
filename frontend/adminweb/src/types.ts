// src/types.ts
export type OrderItem = {
  productName: string;
  size?: string;
  color?: string;
  price: number;
  quantity: number;
};

export type Order = {
  _id: string;
  orderNo: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerLineId?: string;
  items?: OrderItem[];
  totalAmount: number;
  paymentStatus:
    | "WAITING"
    | "PENDING_PAYMENT"
    | "PAYMENT_CONFIRMED"
    | "REJECTED"
    | "EXPIRED";
  orderStatus:
    | "RECEIVED"
    | "PREPARING_ORDER"
    | "SHIPPING"
    | "COMPLETED"
    | "CANCELLED";
  shippingType?: "DELIVERY" | "PICKUP_EVENT" | "PICKUP_SMAKHOM";
  shippingProvider?: string;
  trackingNumber?: string;
  slipReviewCount?: number;
  paymentSlipFilename?: string;
  expiredAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Variant = {
  _id?: string;
  size: string;
  color?: string;
  price: number;
  stock: number;
  locked?: number;
  paidQty?: number;
};

export type Product = {
  _id: string;
  productCode?: string;
  name: string;
  description?: string;
  category?: string;
  preorder?: boolean;
  images?: string[];
  imageUrls?: string[];
  availableFrom?: string;
  availableTo?: string;
  isActive?: boolean;
  variants: Variant[];
  createdAt?: string;
  updatedAt?: string;
};

export type Issue = {
  _id: string;
  issueNumber: string;
  refType: "ORDER" | "RECEIVING" | "PRODUCT";
  refId: string;
  description?: string;
  status: "OPEN" | "PROCESSING" | "RESOLVED" | "REJECTED";
  createdAt: string;
};

export type Role = {
  _id: string;
  code?: string;
  name: string;
  description?: string;
  permissions: string[];
};

export type AuditLog = {
  _id: string;
  user?: { _id: string; username: string; name?: string };
  action: string;
  detail?: any;
  ip?: string;
  createdAt: string;
};

export type PO = {
  _id: string;
  poNumber: string;
  supplierName?: string;
  status: "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  orderDate?: string;
  expectedReceiveDate?: string;
  totalAmount?: number;
};

export type Receiving = {
  _id: string;
  receivingNumber: string;
  po?: string;
  receiverName?: string;
  receiveDate?: string;
  status: "COMPLETE" | "PARTIAL" | "REJECTED";
  items?: any[];
};