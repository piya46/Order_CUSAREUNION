const path = require('path');
const fs = require('fs');

const Order = require('../models/Order');
const Product = require('../models/Product');
const SaleHistory = require('../models/SaleHistory');

const { generateOrderNumber } = require('../utils/generate');
const lineMessageService = require('../services/lineMessageService');
const slipokService = require('../services/slipOkService');
const auditLogService = require('../services/auditLogService');
const { clearRespCache } = require('../services/thaiPostService');

// Signed URL
const { buildSignedUrl } = require('../utils/fileSigner');
const SLIP_TTL_USER  = parseInt(process.env.SLIP_SIGN_TTL_USER  || '90', 10);
const SLIP_TTL_STAFF = parseInt(process.env.SLIP_SIGN_TTL_STAFF || '300', 10);
const ORDER_RENEW_MINUTES = parseInt(process.env.ORDER_RENEW_MINUTES || '30', 10);

/* ---------------- sale-window & stock policy helpers ---------------- */
function nowInWindow(p) {
  const now = new Date();
  const fromOk = !p.availableFrom || now >= p.availableFrom;
  const toOk   = !p.availableTo   || now <= p.availableTo;
  return fromOk && toOk;
}

// ซื้อได้ต้อง active และถ้ากำหนดช่วงเวลาวางขายไว้ ต้องอยู่ในช่วง
function canSellProduct(p) {
  if (p.isActive === false) return false;
  if (p.availableFrom || p.availableTo) return nowInWindow(p);
  return true;
}

/* ---------------- stock helpers (atomic + arrayFilters) ---------------- */
const nstr = v => String(v ?? '').trim();
const nnum = v => Number(v || 0);

/** ล็อกสต๊อกแบบอะตอมมิก: stock -qty, locked +qty (เฉพาะ non-preorder) */
async function lockStock(items) {
  for (const raw of items) {
    const item = {
      product: raw.product,
      size: nstr(raw.size),
      color: nstr(raw.color),
      qty: nnum(raw.quantity ?? raw.qty),
    };
    if (!item.qty) continue;

    const res = await Product.updateOne(
      { _id: item.product, preorder: { $ne: true } },
      {
        $inc: {
          'variants.$[v].stock': -item.qty,
          'variants.$[v].locked': item.qty
        }
      },
      {
        arrayFilters: [
          { 'v.size': item.size, 'v.color': item.color, 'v.stock': { $gte: item.qty } }
        ]
      }
    );

    // ถ้าไม่ match แปลว่าสต๊อกไม่พอหรือไม่พบ variant
    if (res.modifiedCount === 0) {
      throw new Error(`สต๊อกไม่พอหรือไม่พบไซส์/สี: ${item.size}/${item.color}`);
    }
  }
}

/** ยืนยันการขาย: locked -qty (เฉพาะ non-preorder) */
async function confirmStock(items) {
  for (const raw of items) {
    const item = {
      product: raw.product,
      size: nstr(raw.size),
      color: nstr(raw.color),
      qty: nnum(raw.quantity ?? raw.qty),
    };
    if (!item.qty) continue;

    await Product.updateOne(
      { _id: item.product, preorder: { $ne: true } },
      { $inc: { 'variants.$[v].locked': -item.qty } },
      { arrayFilters: [{ 'v.size': item.size, 'v.color': item.color, 'v.locked': { $gte: item.qty } }] }
    );
  }
}

/** ยกเลิก/หมดอายุ: stock +qty, locked -qty (เฉพาะ non-preorder) */
async function unlockStock(items) {
  for (const raw of items) {
    const item = {
      product: raw.product,
      size: nstr(raw.size),
      color: nstr(raw.color),
      qty: nnum(raw.quantity ?? raw.qty),
    };
    if (!item.qty) continue;

    await Product.updateOne(
      { _id: item.product, preorder: { $ne: true } },
      {
        $inc: {
          'variants.$[v].stock': item.qty,
          'variants.$[v].locked': -item.qty
        }
      },
      { arrayFilters: [{ 'v.size': item.size, 'v.color': item.color, 'v.locked': { $gte: item.qty } }] }
    );
  }
}

const buildThaiPostUrl = tn => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(tn)}`;

// role helper
function isStaff(req) {
  const role = req.user?.role;
  return ['admin', 'manager', 'account', 'shipping'].includes(role);
}

/* ----------------------- CREATE ORDER (รองรับหลาย product) ----------------------- */
exports.create = async (req, res, next) => {
  try {
    // validateOrder เติม lineId และ normalize items มาแล้ว
    const realLineId = req.body.lineId;
    const { displayName, items, shippingType, customerAddress, customerPhone } = req.body;

    if (!realLineId || !displayName || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลลูกค้า/สินค้าไม่ถูกต้อง' });
    }

    // 1) ดึงสินค้าแบบหลายตัว
    const productIds = [...new Set(items.map(i => String(i.product)))];
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const pMap = new Map(products.map(p => [p._id.toString(), p]));

    // มี product ไหนหาไม่เจอ?
    const missing = productIds.filter(id => !pMap.has(id));
    if (missing.length) {
      return res.status(404).json({ error: `ไม่พบสินค้า: ${missing[0]}` });
    }

    // 2) ตรวจ policy การขาย และ ตรวจ variant/สต๊อก
    for (const it of items) {
      const p = pMap.get(String(it.product));
      if (!canSellProduct(p)) {
        return res.status(400).json({ error: `สินค้า ${p.name} นอกช่วงวางขายหรือปิดการขายแล้ว` });
      }
      const v = (p.variants || []).find(x => x.size === nstr(it.size) && x.color === nstr(it.color));
      if (!v) {
        return res.status(400).json({ error: `ไม่พบไซส์/สี ${it.size}/${it.color} ในสินค้า ${p.name}` });
      }
      if (!p.preorder) {
        if (nnum(v.stock) < nnum(it.qty)) {
          return res.status(400).json({ error: `สต๊อก ${p.name} ${it.size}/${it.color} ไม่พอ` });
        }
      }
    }

    // 3) ล็อกสต๊อกเฉพาะ non-preorder
    const itemsToLock = items
      .filter(it => !pMap.get(String(it.product))?.preorder)
      .map(it => ({ product: it.product, size: it.size, color: it.color, quantity: it.qty }));
    try {
      if (itemsToLock.length) await lockStock(itemsToLock);
    } catch (e) {
      return res.status(400).json({ error: e.message || 'สต๊อกไม่พอ' });
    }

    // 4) คำนวณยอด/สร้างออเดอร์
    const orderNo = generateOrderNumber();
    const totalAmount = items.reduce((s, i) => s + nnum(i.price) * nnum(i.qty), 0);
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000); // 30 นาที

    const orderItems = items.map(i => {
      const p = pMap.get(String(i.product));
      return {
        product: i.product,
        productName: p?.name || '-',
        size: nstr(i.size),
        color: nstr(i.color),
        price: nnum(i.price),
        quantity: nnum(i.qty),
      };
    });

    const order = await Order.create({
      orderNo,
      customerName: displayName,
      customerLineId: realLineId,
      customerPhone,
      customerAddress,
      shippingType,
      items: orderItems,
      totalAmount,
      orderStatus: 'RECEIVED',
      paymentStatus: 'WAITING',
      expiredAt
    });

    // 5) แจ้งลูกค้าใน LINE
    if (order.customerLineId) {
      await lineMessageService.pushOrderCreatedFlexToUser(order.customerLineId, order);
    }

    // 6) audit log
    await auditLogService.log({
      user: req.user?.id,
      action: 'ORDER_CREATE',
      detail: { orderId: order._id, items: order.items, amount: totalAmount },
      ip: req.ip
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};


/* ---------------- VERIFY SLIP (shared) ---------------- */
async function processSlipAndVerify(order, file, userId = null, ip = null) {
  order.paymentSlipFilename = file.filename;

  const filePath = path.join(__dirname, '..', 'private_uploads', file.filename);
  let slipOkResult = { success: false, message: 'ไม่สามารถตรวจสอบสลิปได้' };

  try {
    slipOkResult = await slipokService.verifySlipByFile(filePath, order.totalAmount);
  } catch (err) {
    slipOkResult = { success: false, message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' };
  }

  order.slipOkResult = slipOkResult;

  if (slipOkResult.success) {
    if (order.paymentStatus !== 'PAYMENT_CONFIRMED') {
      await confirmStock(order.items); 
      await SaleHistory.create({
        orderId: order._id,
        customerName: order.customerName,
        customerLineId: order.customerLineId,
        items: order.items,            
        paidAmount: order.totalAmount,
        soldAt: new Date()
      });
    }
    order.paymentStatus = 'PAYMENT_CONFIRMED';
    if (order.orderStatus === 'RECEIVED') {
      order.orderStatus = 'PREPARING_ORDER';
    }

    if (order.customerLineId) {
      await lineMessageService.pushSlipResultFlexToUser(order.customerLineId, order, {
        success: true,
        message: 'ระบบกำลังเตรียมคำสั่งซื้อของคุณ'
      });
    }
    await lineMessageService.pushSlipResultFlexToAdmin(order, {
      success: true,
      message: `ลูกค้า ${order.customerName} ชำระสำเร็จ`
    });

  } else {
    order.paymentStatus = 'REJECTED';
    order.slipReviewCount = (order.slipReviewCount || 0) + 1;

    if (order.slipReviewCount >= 3) {
      await lineMessageService.pushSlipResultFlexToAdmin(order, {
        success: false,
        message: `ลูกค้า ${order.customerName} อัปโหลดสลิปไม่ผ่าน ${order.slipReviewCount} ครั้ง`
      });
    }
  }

  await order.save();

  await auditLogService.log({
    user: userId || order._id,
    action: 'ORDER_UPLOAD_SLIP',
    detail: { orderId: order._id, slipOkResult },
    ip: ip || ''
  });

  return { order, slipOkResult };
}

/* ----------------------- UPLOAD SLIP ----------------------- */
exports.uploadSlip = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์สลิป' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // guard: ลูกค้าต้องเป็นเจ้าของ
    if (req.user?.type === 'liff' && order.customerLineId !== req.user.lineId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (order.expiredAt && order.expiredAt < new Date()) {
      if (order.orderStatus !== 'CANCELLED' && order.paymentStatus !== 'EXPIRED') {
        // ❗ คืนสต๊อกเฉพาะออเดอร์ที่ยัง "ไม่ชำระสำเร็จ"
        if (order.paymentStatus !== 'PAYMENT_CONFIRMED') {
          await unlockStock(order.items);
        }
      }
      order.orderStatus = 'CANCELLED';
      order.paymentStatus = 'EXPIRED';
      await order.save();
      return res.status(400).json({ error: 'ออร์เดอร์นี้หมดอายุแล้ว' });
    }
    if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'EXPIRED') {
      if (order.paymentStatus !== 'PAYMENT_CONFIRMED') {
        await unlockStock(order.items);
      }
      return res.status(400).json({ error: 'ออร์เดอร์นี้ถูกยกเลิกหรือหมดอายุแล้ว' });
    }

    const result = await processSlipAndVerify(order, req.file, req.user?.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
};

/* ----------------------- RETRY SLIP ----------------------- */
exports.retrySlip = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์สลิป' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // guard: ลูกค้าต้องเป็นเจ้าของ
    if (req.user?.type === 'liff' && order.customerLineId !== req.user.lineId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await processSlipAndVerify(order, req.file, req.user?.id, req.ip);
    if (result.slipOkResult?.success) {
      await lineMessageService.pushSlipResultFlexToAdmin(order, {
        success: true,
        message: `ลูกค้า ${order.customerName} ชำระสำเร็จ (รีอัปโหลด)`
      });
    }
    res.json(result);
  } catch (err) { next(err); }
};

/* ----------------------- VERIFY SLIP (ADMIN) ----------------------- */
exports.verifySlip = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.paymentSlipFilename) {
      return res.status(400).json({ error: 'No slip uploaded' });
    }

    const filePath = path.join(__dirname, '..', 'private_uploads', order.paymentSlipFilename);
    let slipOkResult = { success: false, message: 'ไม่สามารถตรวจสอบสลิปได้' };

    try {
      slipOkResult = await slipokService.verifySlipByFile(filePath, order.totalAmount);
    } catch (err) {
      slipOkResult = { success: false, message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป' };
    }

    order.slipOkResult = slipOkResult;

    if (slipOkResult.success) {
      if (order.paymentStatus !== 'PAYMENT_CONFIRMED') {
        await confirmStock(order.items);
        await SaleHistory.create({
          orderId: order._id,
          customerName: order.customerName,
          customerLineId: order.customerLineId,
          items: order.items,
          paidAmount: order.totalAmount,
          soldAt: new Date()
        });
      }
      order.paymentStatus = 'PAYMENT_CONFIRMED';
      if (order.orderStatus === 'RECEIVED') {
        order.orderStatus = 'PREPARING_ORDER';
      }

      if (order.customerLineId) {
        await lineMessageService.pushSlipResultFlexToUser(order.customerLineId, order, {
          success: true,
          message: 'ระบบกำลังเตรียมคำสั่งซื้อของคุณ'
        });
      }
      await lineMessageService.pushSlipResultFlexToAdmin(order, {
        success: true,
        message: `ลูกค้า ${order.customerName} ชำระสำเร็จ (Admin Verify)`
      });

    } else {
      order.paymentStatus = 'REJECTED';
      order.slipReviewCount = (order.slipReviewCount || 0) + 1;

      if (order.slipReviewCount >= 3) {
        await lineMessageService.pushSlipResultFlexToAdmin(order, {
          success: false,
          message: `ลูกค้า ${order.customerName} อัปโหลดสลิปไม่ผ่าน ${order.slipReviewCount} ครั้ง (Admin Verify)`
        });
      }
    }

    await order.save();

    await auditLogService.log({
      user: req.user?.id,
      action: 'ORDER_VERIFY_SLIP',
      detail: { orderId: order._id, slipOkResult },
      ip: req.ip
    });

    res.json({ order, slipOkResult });
  } catch (err) { next(err); }
};

/* ----------------------- GETTERS ----------------------- */
exports.getMyOrders = async (req, res, next) => {
  try {
    const uid = req.user?.lineId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const orders = await Order.find({ customerLineId: uid }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // guard: ลูกค้าต้องเป็นเจ้าของ
    if (req.user?.type === 'liff' && order.customerLineId !== req.user.lineId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(order);
  } catch (err) { next(err); }
};

// ลูกค้าเจ้าของ หรือ staff ขอ URL สลิปได้ (Signed URL)
exports.getSlipFile = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.paymentSlipFilename) return res.status(404).json({ error: 'No slip found' });

    const isOwner = req.user?.type === 'liff' && req.user.lineId === order.customerLineId;
    const allow = isOwner || isStaff(req);
    if (!allow) return res.status(403).json({ error: 'Forbidden' });

    const ttl = isOwner ? SLIP_TTL_USER : SLIP_TTL_STAFF;
    const url = buildSignedUrl(order.paymentSlipFilename, ttl);
    return res.json({ url, ttl, owner: isOwner ? 'customer' : 'staff' });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const orders = await Order.find().populate('items.product');
    res.json(orders);
  } catch (err) { next(err); }
};

/* ----------------------- UPDATE (ADMIN) ----------------------- */
exports.update = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // เลือกฟิลด์ที่อนุญาตเท่านั้น
    const allowed = [
      'orderStatus', 'paymentStatus',
      'shippingType', 'shippingProvider', 'trackingNumber',
      'customerName', 'customerPhone', 'customerAddress'
    ];
    for (const k of Object.keys(req.body)) {
      if (!allowed.includes(k)) delete req.body[k];
    }

    const prev = {
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      trackingNumber: order.trackingNumber,
      shippingProvider: order.shippingProvider,
    };
    const prevTrackingNo = order.trackingNumber;

    // เปลี่ยนเลขพัสดุ → เคลียร์สถานะติดตาม + เคลียร์ cache เก่า/ใหม่
    if (typeof req.body.trackingNumber === 'string' &&
        req.body.trackingNumber !== order.trackingNumber) {
      order.trackingHistory = [];
      order.lastTrackingHash = undefined;
      order.lastTrackingFetchedAt = undefined;
      order.deliveredAt = undefined;
      if (prevTrackingNo) clearRespCache(prevTrackingNo);
      if (req.body.trackingNumber) clearRespCache(req.body.trackingNumber);
    }

    // อัปเดตค่า
    Object.assign(order, req.body);

    // ===== คำนวนสถานะก่อน/หลัง =====
    const prevPaid   = prev.paymentStatus === 'PAYMENT_CONFIRMED';
    const nowPaid    = order.paymentStatus === 'PAYMENT_CONFIRMED';

    const prevExpiredOrCancelled =
      prev.orderStatus === 'CANCELLED' || prev.paymentStatus === 'EXPIRED';
    const nowExpiredOrCancelled =
      order.orderStatus === 'CANCELLED' || order.paymentStatus === 'EXPIRED';

    const cancelledNow  = nowExpiredOrCancelled;
    const cancelledPrev = prevExpiredOrCancelled;

    const wasEverPaid = prevPaid || nowPaid;

    // ===== เส้นทาง 1: เปลี่ยนเป็น CANCELLED/EXPIRED ตอนนี้ (และไม่เคยชำระ) → คืนสต๊อก =====
    if (cancelledNow && !cancelledPrev && !wasEverPaid) {
      await unlockStock(order.items);
    }

    // ===== เส้นทาง 2: กู้คืนจาก EXPIRED/CANCELLED → สถานะปกติ (ยังไม่ชำระ) → ล็อกสต๊อก & ต่ออายุ =====
    if (prevExpiredOrCancelled && !nowExpiredOrCancelled && !nowPaid) {
      try {
        await lockStock(order.items); // reserve กลับ
      } catch (e) {
        return res.status(400).json({ error: e.message || 'สต๊อกไม่พอสำหรับกู้คืนออเดอร์' });
      }
      // ต่ออายุหมดเขตใหม่ ถ้าอันเดิมหมดอายุไปแล้ว/ไม่มี
      if (!order.expiredAt || order.expiredAt < new Date()) {
        order.expiredAt = new Date(Date.now() + ORDER_RENEW_MINUTES * 60 * 1000);
      }
    }

    // ===== เส้นทาง 3: ตั้งเป็นชำระสำเร็จตอนนี้ =====
    if (!prevPaid && nowPaid) {
      // ถ้ากู้คืนจาก EXPIRED/CANCELLED มาก่อน ให้ล็อกสต๊อกก่อนคอนเฟิร์ม
      if (prevExpiredOrCancelled) {
        try {
          await lockStock(order.items);
        } catch (e) {
          return res.status(400).json({ error: e.message || 'สต๊อกไม่พอสำหรับยืนยันการขาย' });
        }
      }
      // คอนเฟิร์มการขาย (ลด locked)
      await confirmStock(order.items);
      // บันทึกประวัติการขาย (ให้สอดคล้องกับ path อื่น ๆ)
      await SaleHistory.create({
        orderId: order._id,
        customerName: order.customerName,
        customerLineId: order.customerLineId,
        items: order.items,
        paidAmount: order.totalAmount,
        soldAt: new Date()
      });

      // ถ้าเดิมเพิ่งรับออเดอร์ ให้ขยับไปเตรียมของ
      if (order.orderStatus === 'RECEIVED') {
        order.orderStatus = 'PREPARING_ORDER';
      }
    }

    // จัดส่งแล้ว → แจ้งลูกค้าด้วย Flex (ครั้งแรกที่เข้า SHIPPING)
    if (prev.orderStatus !== 'SHIPPING' && order.orderStatus === 'SHIPPING') {
      if (order.customerLineId) {
        const flex = lineMessageService.buildShippingStartedFlex(order);
        await lineMessageService.pushToUser(order.customerLineId, flex);
      }
    }

    // มีการเปลี่ยนสถานะสำคัญ → แจ้งลูกค้า
    const anyChanged =
      (prev.orderStatus !== order.orderStatus) ||
      (prev.paymentStatus !== order.paymentStatus);
    if (anyChanged && order.customerLineId) {
      const flex = lineMessageService.buildOrderStatusUpdateFlex(order);
      await lineMessageService.pushToUser(order.customerLineId, flex);
    }

    await order.save();

    // Audit (ถ้า service ไม่พร้อม ให้ปล่อย throw ไปให้ error handler กลางจัดการตามนโยบายของโปรเจค)
    await auditLogService.log({
      user: req.user?.id,
      action: 'ORDER_UPDATE',
      detail: {
        orderId: order._id,
        before: prev,
        after: {
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          shippingProvider: order.shippingProvider,
          trackingNumber: order.trackingNumber
        }
      },
      ip: req.ip
    });

    res.json(order);
  } catch (err) { next(err); }
};

/* ----------------------- DELETE ----------------------- */
exports.delete = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (order && order.paymentStatus !== 'PAYMENT_CONFIRMED') {
      await unlockStock(order.items);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};

/* ----------------------- PUSH MESSAGE TO CUSTOMER (ADMIN) ----------------------- */
exports.pushMessageToCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const text = (req.body?.text || '').toString().trim();

    if (!text) {
      return res.status(400).json({ error: 'กรุณาระบุข้อความที่จะส่ง' });
    }
    if (text.length > 1000) {
      return res.status(400).json({ error: 'ข้อความยาวเกินไป (สูงสุด 1000 ตัวอักษร)' });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    if (!order.customerLineId) {
      return res.status(400).json({ error: 'ออเดอร์นี้ไม่มี LINE User ID ของลูกค้า จึงไม่สามารถส่งข้อความได้' });
    }

    // ส่งข้อความผ่าน OA (ต้องตั้งค่า LINE_CHANNEL_ACCESS_TOKEN)
    await lineMessageService.pushToUser(order.customerLineId, { type: 'text', text });

    // บันทึก audit log
    await auditLogService.log({
      user: req.user?.id,
      action: 'ORDER_PUSH_MESSAGE',
      detail: { orderId: order._id, length: text.length },
      ip: req.ip
    });

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};