const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  size: String,
  color: String,
  quantity: Number,
  receivedQuantity: { type: Number, default: 0 }, // ✅ เพิ่ม: เก็บยอดที่รับของแล้ว
  price: Number
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, unique: true },
  supplierName: String,
  supplierContact: String,
  items: [poItemSchema],
  totalAmount: Number,
  status: { type: String, enum: ['DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED'], default: 'DRAFT' },
  orderDate: { type: Date, default: Date.now },
  expectedReceiveDate: Date,
  receivedDate: Date,
  note: String
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);