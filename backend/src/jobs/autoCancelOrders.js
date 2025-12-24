// jobs/autoCancelOrders.js
const cron = require('node-cron');
const Order = require('../models/Order');
const Product = require('../models/Product');
const lineMessageService = require('../services/lineMessageService');

let running = false;

async function unlockStock(items = []) {
  for (const item of items) {
    // ใส่ try/catch กันหลุดทั้ง job
    try {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.size, 'variants.color': item.color },
        { $inc: { 'variants.$.stock': item.quantity, 'variants.$.locked': -item.quantity } }
      );
    } catch (e) {
      console.error('[autoCancel] unlockStock error', e?.message || e);
    }
  }
}

cron.schedule('*/5 * * * *', async () => {
  if (running) return;          // กันงานซ้อน
  running = true;
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      expiredAt: { $lt: now },
      paymentStatus: { $nin: ['EXPIRED', 'PAYMENT_CONFIRMED'] }
    }).lean();                  // ⬅️ lean เพื่อลด overhead

    for (const o of expiredOrders) {
      try {
        await unlockStock(o.items);

        await Order.updateOne(
          { _id: o._id },
          { $set: { orderStatus: 'CANCELLED', paymentStatus: 'EXPIRED' } }
        );

        // แจ้ง admin แบบ “best effort” ไม่ await ก็ได้
        lineMessageService.pushToAdmin?.(
          `⏰ ออร์เดอร์หมดอายุ (auto-cancel): #${o.orderNo} ลูกค้า: ${o.customerName}`
        ).catch(() => {});

        console.log(`Order #${o.orderNo} auto-cancelled (expired)`);
      } catch (e) {
        console.error('[autoCancel] handle order error', o?._id, e?.message || e);
      }

      // ผ่อน event-loop
      await new Promise(r => setImmediate(r));
    }
  } catch (e) {
    console.error('[autoCancel] job error', e?.message || e);
  } finally {
    running = false;
  }
}, { timezone: 'Asia/Bangkok' });