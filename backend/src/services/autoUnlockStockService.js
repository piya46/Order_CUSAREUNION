// src/services/autoUnlockStockService.js
const Order = require('../models/Order');
const stockService = require('./stockService');

exports.autoUnlock = async () => {
  // หาออร์เดอร์ที่เลยเวลารอ slip
  const expiredOrders = await Order.find({
    paymentStatus: 'PENDING_PAYMENT',
    updatedAt: { $lt: new Date(Date.now() - 1000 * 60 * 15) } // 15 นาที
  });
  for (const order of expiredOrders) {
    await stockService.unlock(order.items);
    order.paymentStatus = 'EXPIRED';
    await order.save();
  }
};
