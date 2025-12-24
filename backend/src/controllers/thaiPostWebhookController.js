const Order = require('../models/Order');
const { historyHash, clearRespCache } = require('../services/thaiPostService');
const lineMessageService = require('../services/lineMessageService');
const auditLogService = require('../services/auditLogService'); // ✅ เพิ่ม

const SECRET = process.env.THAI_POST_WEBHOOK_SECRET;

exports.receive = async (req, res) => {
  try {
    if (!SECRET || req.query.s !== SECRET) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { barcode, events } = req.body || {};
    if (!barcode || !Array.isArray(events)) {
      return res.status(400).json({ error: 'bad payload' });
    }

    const order = await Order.findOne({ trackingNumber: barcode });
    if (!order) {
      await auditLogService.log({
        user: null,
        action: 'THAIPOST_WEBHOOK_MISS',
        detail: { barcode, note: 'order not found' },
        ip: req.ip
      });
      return res.json({ ok: true, note: 'order not found' });
    }

    const key = r => `${r.status}|${r.timestamp}|${r.location || ''}`;
    const existed = new Map((order.trackingHistory || []).map(e => [key(e), e]));
    for (const e of events) if (!existed.has(key(e))) existed.set(key(e), e);

    const merged = Array.from(existed.values());
    const newHash = historyHash(merged);

    if (newHash !== order.lastTrackingHash) {
      order.trackingHistory = merged;
      order.lastTrackingHash = newHash;
      order.lastTrackingFetchedAt = new Date();
      clearRespCache(barcode);

      const delivered = merged.find(x => (x.status || '').includes('นำจ่ายสำเร็จ'));
      if (delivered && order.orderStatus !== 'COMPLETED') {
        order.orderStatus = 'COMPLETED';
        order.deliveredAt = new Date();
        await lineMessageService.pushDelivered(order, barcode);

        await auditLogService.log({
          user: null,
          action: 'THAIPOST_WEBHOOK_DELIVERED',
          detail: { orderId: order._id, orderNo: order.orderNo, barcode, latest: delivered },
          ip: req.ip
        });
      } else {
        const latest = events[events.length - 1] || merged[merged.length - 1];

        await auditLogService.log({
          user: null,
          action: 'THAIPOST_WEBHOOK_UPDATE',
          detail: { orderId: order._id, orderNo: order.orderNo, barcode, latest },
          ip: req.ip
        });

        if (latest) await lineMessageService.pushShippingUpdate(order, latest);
      }
      await order.save();
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('ThaiPost webhook error:', err);
    await auditLogService.log({
      user: null,
      action: 'THAIPOST_WEBHOOK_ERROR',
      detail: { error: err?.message || String(err) },
      ip: req.ip
    });
    res.status(500).json({ error: 'internal error' });
  }
};