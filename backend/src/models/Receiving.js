const mongoose = require('mongoose');

const receivingItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  size: String,
  color: String,
  quantity: Number,
  goodQty: Number,
  damagedQty: Number
});

const receivingSchema = new mongoose.Schema({
  receivingNumber: { type: String, unique: true },
  po: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  items: [receivingItemSchema],
  receiverName: String,
  receiveDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['COMPLETE', 'PARTIAL', 'REJECTED'], default: 'COMPLETE' },
  note: String
}, { timestamps: true });

module.exports = mongoose.model('Receiving', receivingSchema);
