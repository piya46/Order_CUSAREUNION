const trackingCache = require('../cache/trackingCache');
const thaiPostService = require('../services/thaiPostService');
const { historyHash } = require('../services/thaiPostService');
const Order = require('../models/Order');
const lineMessageService = require('../services/lineMessageService');
const auditLogService = require('../services/auditLogService'); // ✅ เพิ่ม

exports.getByTrackingNo = async (req, res) => {
  const trackingNo = (req.params.trackingNo || '').trim();
  if (!trackingNo) return res.status(400).json({ error: 'invalid tracking number' });

  // 1) เช็คแคช
  const cached = trackingCache.get(trackingNo);
  if (Array.isArray(cached) && cached.length > 0) {
    return res.json({ history: cached, cached: true, complete: isComplete(cached) });
  }

  try {
    // 2) call service
    const result = await thaiPostService.trackParcel(trackingNo);
    const historyArr = Array.isArray(result?.history) ? result.history :
                       (Array.isArray(result) ? result : []);

    if (historyArr.length === 0) {
      trackingCache.set(trackingNo, historyArr, 60 * 1000);
      return res.json({ history: historyArr });
    }

    trackingCache.set(trackingNo, historyArr);

    if (isComplete(historyArr)) {
      trackingCache.set(trackingNo, historyArr, 0); // เก็บถาวร
      await finishOrdersWithTimeline(trackingNo, historyArr);
      return res.json({ history: historyArr, complete: true });
    }

    return res.json({ history: historyArr });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'ไม่สามารถดึงข้อมูลพัสดุได้' });
  }
};

// ---------- Helpers ----------
function isComplete(history) {
  if (!Array.isArray(history) || history.length === 0) return false;
  const last = history[history.length - 1];
  const text = (last.status || '').toLowerCase();
  return text.includes('delivered')
      || text.includes('completed')
      || (last.status || '').includes('นำจ่ายสำเร็จ');
}

async function finishOrdersWithTimeline(trackingNo, historyArr) {
  const h = historyHash(historyArr);
  const orders = await Order.find({ trackingNumber: trackingNo });
  if (!orders || orders.length === 0) return;

  const latest = historyArr[historyArr.length - 1];

  for (const order of orders) {
    let needNotify = false;

    order.trackingHistory = historyArr;
    order.lastTrackingHash = h;
    order.lastTrackingFetchedAt = new Date();

    if (order.orderStatus !== 'COMPLETED') {
      order.orderStatus = 'COMPLETED';
      order.deliveredAt = new Date();
      needNotify = true;
    }

    await order.save();

    // ✅ Audit: ปิดงานอัตโนมัติจากหน้า track
    await auditLogService.log({
      user: null,
      action: 'ORDER_DELIVERED_AUTO',
      detail: { orderId: order._id, orderNo: order.orderNo, trackingNo, latest },
      ip: '' // ไม่มี req ที่นี่
    });

    if (needNotify) {
      if (typeof lineMessageService?.pushDelivered === 'function') {
        await lineMessageService.pushDelivered(order, trackingNo);
      } else if (order.customerLineId) {
        const place = latest?.location ? `ที่: ${latest.location}` : '';
        await lineMessageService.pushToUser(
          order.customerLineId,
          `ออเดอร์ ${order.orderNo} จัดส่งสำเร็จแล้ว 🎉\nเลขพัสดุ: ${trackingNo}\n${place}`
        );
      }
      if (typeof lineMessageService?.pushSlipResultFlexToAdmin === 'function') {
        await lineMessageService.pushSlipResultFlexToAdmin(order, {
          success: true,
          message: `จัดส่งสำเร็จแล้ว (Delivered) — เลขพัสดุ: ${trackingNo}`
        });
      }
    }
  }
}