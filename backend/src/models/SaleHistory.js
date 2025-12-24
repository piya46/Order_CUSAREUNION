const mongoose = require('mongoose');

const saleHistorySchema = new mongoose.Schema({
  orderId:        { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  customerName:   String,
  customerLineId: String,
  items: [
    {
      product:     { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      productName: String,
      size:        String,
      color:       String,
      price:       Number,
      quantity:    Number, 
    }
  ],
  paidAmount: Number,                
  soldAt:     { type: Date, default: Date.now } 
});

module.exports = mongoose.model("SaleHistory", saleHistorySchema);