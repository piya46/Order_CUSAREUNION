const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  size: String,
  color: String,
  price: Number,
  quantity: Number
}, { _id: false });


const trackingEntrySchema = new mongoose.Schema({
  status: String,
  timestamp: String,
  location: String,
  description: String
}, { _id: false });

const orderSchema = new mongoose.Schema({

  orderNo: { type: String, required: true },

  customerName: String,
  customerPhone: { type: String, trim: true },
  customerLineId: { type: String, index: true },
  customerAddress: String,

  items: [orderItemSchema],
  totalAmount: Number,

  paymentSlipFilename: String,
  paymentStatus: {
    type: String,
    enum: ['WAITING', 'PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'REJECTED', 'EXPIRED'],
    default: 'WAITING'
  },
  slipReviewCount: { type: Number, default: 0 },

  orderStatus: {
    type: String,
    enum: ['RECEIVED', 'PREPARING_ORDER', 'SHIPPING', 'COMPLETED', 'CANCELLED'],
    default: 'RECEIVED'
  },

  shippingType: { type: String, enum: ['PICKUP_SMAKHOM','PICKUP_EVENT', 'DELIVERY'], default: 'DELIVERY' },
  shippingProvider: String,
  trackingNumber: { type: String, trim: true },


  trackingHistory: { type: [trackingEntrySchema], default: [] },
  lastTrackingHash: String,
  lastTrackingFetchedAt: Date,
  deliveredAt: Date,

  locked: { type: Boolean, default: true },
  expiredAt: Date
}, { timestamps: true });


orderSchema.index({ orderNo: 1 }, { unique: true, name: 'order_orderNo_u' });
orderSchema.index({ trackingNumber: 1 }, { name: 'order_trackingNumber_i' });
orderSchema.index({ customerLineId: 1, createdAt: -1 }, { name: 'order_customerLineId_createdAt_i' });


function normalizeTrackingTimestamp(doc) {
  if (!Array.isArray(doc.trackingHistory)) return;
  for (const e of doc.trackingHistory) {
    if (e && e.timestamp instanceof Date) {
      e.timestamp = e.timestamp.toISOString();
    }
  }
}

orderSchema.pre('save', function(next) {
  normalizeTrackingTimestamp(this);
  next();
});

orderSchema.set('toJSON', {
  transform: (_, ret) => {
    if (Array.isArray(ret.trackingHistory)) {
      ret.trackingHistory = ret.trackingHistory.map(e => {
        if (!e) return e;
        const out = { ...e };
        if (out.timestamp instanceof Date) out.timestamp = out.timestamp.toISOString();
        return out;
      });
    }
    return ret;
  }
});

module.exports = mongoose.model('Order', orderSchema);