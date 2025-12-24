const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String, // Snapshot ชื่อสินค้า ณ วันที่สั่ง
  size: String,
  color: String,
  quantity: Number,
  receivedQuantity: { type: Number, default: 0 },
  price: Number
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, unique: true },
  
  // 🔥 Change: เปลี่ยนจาก String เป็น ObjectId (Relation)
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  
  // (Optional) เก็บชื่อไว้กันเหนียว เผื่อ Supplier ถูกลบ แต่เราอยากให้ PO ประวัติยังดูรู้เรื่อง
  supplierNameSnapshot: String,

  items: [poItemSchema],
  totalAmount: Number,
  status: { type: String, enum: ['DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'], default: 'DRAFT' },
  orderDate: { type: Date, default: Date.now },
  expectedReceiveDate: Date,
  receivedDate: Date,
  note: String
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);