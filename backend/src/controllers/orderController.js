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

function canSellProduct(p) {
  if (p.isActive === false) return false;
  if (p.availableFrom || p.availableTo) return nowInWindow(p);
  return true;
}

/* ---------------- stock helpers (atomic + arrayFilters) ---------------- */
const nstr = v => String(v ?? '').trim();
const nnum = v => Number(v || 0);

/** ล็อกสต๊อก: stock -qty, locked +qty */
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

    if (res.modifiedCount === 0) {
      throw new Error(`สต๊อกไม่พอหรือสินค้าหมด: ${item.size}/${item.color}`);
    }
  }
}

/** ยืนยันการขาย: locked -qty */
async function confirmStock(items) {
  for (const raw of items) {
    const item = {
      product: raw.product,
      size: nstr(raw.size),
      color: nstr(raw.color),
      qty: nnum(raw.quantity ?? raw.qty),
    };
    if (!item.qty) continue;

    // ลดจาก locked อย่างเดียว (เพราะตอนจอง ย้ายจาก stock -> locked แล้ว)
    await Product.updateOne(
      { _id: item.product, preorder: { $ne: true } },
      { $inc: { 'variants.$[v].locked': -item.qty } },
      { arrayFilters: [{ 'v.size': item.size, 'v.color': item.color, 'v.locked': { $gte: item.qty } }] }
    );
  }
}

/** ยกเลิก/หมดอายุ: stock +qty, locked -qty */
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
      // เช็ค locked >= qty เพื่อความปลอดภัย (กันติดลบ)
      { arrayFilters: [{ 'v.size': item.size, 'v.color': item.color, 'v.locked': { $gte: item.qty } }] }
    );
  }
}

function isStaff(req) {
  const role = req.user?.role;
  return ['admin', 'manager', 'account', 'shipping'].includes(role);
}

/* ----------------------- CREATE ORDER ----------------------- */
exports.create = async (req, res, next) => {
  try {
    const realLineId = req.body.lineId;
    const { displayName, items, shippingType, customerAddress, customerPhone } = req.body;

    if (!realLineId || !displayName || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลลูกค้า/สินค้าไม่ถูกต้อง' });
    }

    const productIds = [...new Set(items.map(i => String(i.product)))];
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const pMap = new Map(products.map(p => [p._id.toString(), p]));

    const missing = productIds.filter(id => !pMap.has(id));
    if (missing.length) {
      return res.status(404).json({ error: `ไม่พบสินค้า: ${missing[0]}` });
    }

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
          return res.status(400).json({ error: `สินค้า ${p.name} ${it.size}/${it.color} สินค้าหมด` });
        }
      }
    }

    const itemsToLock = items
      .filter(it => !pMap.get(String(it.product))?.preorder)
      .map(it => ({ product: it.product, size: it.size, color: it.color, quantity: it.qty }));
    
    try {
      if (itemsToLock.length) await lockStock(itemsToLock);
    } catch (e) {
      return res.status(400).json({ error: e.message || 'สินค้าหมด' });
    }

    const orderNo = generateOrderNumber();
    const totalAmount = items.reduce((s, i) => s + nnum(i.price) * nnum(i.qty), 0);
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000); 

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

    if (order.customerLineId) {
      await lineMessageService.pushOrderCreatedFlexToUser(order.customerLineId, order);
    }

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


/* ---------------- VERIFY SLIP (Shared) ---------------- */
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
    // ถ้าเคยหมดอายุหรือยกเลิก ต้องจองของใหม่ก่อนคอนเฟิร์ม
    const wasExpiredOrCancelled = order.orderStatus === 'CANCELLED' || order.paymentStatus === 'EXPIRED';
    
    if (order.paymentStatus !== 'PAYMENT_CONFIRMED') {
      if (wasExpiredOrCancelled) {
        try {
           // จองของใหม่ (ย้าย stock -> locked)
           await lockStock(order.items);
        } catch(e) {
           throw new Error('สินค้าหมด ไม่สามารถกู้คืนออเดอร์ได้');
        }
      }
      
      // ยืนยัน (ลด locked)
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
    // เคลียร์สถานะหมดอายุ/ยกเลิก ถ้ามี
    if (wasExpiredOrCancelled) {
      order.expiredAt = undefined; 
    }
    
    if (order.orderStatus === 'RECEIVED' || order.orderStatus === 'CANCELLED') {
      order.orderStatus = 'PREPARING_ORDER';
    }

    if (order.customerLineId) {
      await lineMessageService.pushSlipResultFlexToUser(order.customerLineId, order, {
        success: true,
        message: 'ชำระเงินสำเร็จ ระบบกำลังเตรียมสินค้า'
      });
    }
    await lineMessageService.pushSlipResultFlexToAdmin(order, {
      success: true,
      message: `ลูกค้า ${order.customerName} ชำระเงินสำเร็จ`
    });

  } else {
    // ถ้าตรวจไม่ผ่าน
    order.paymentStatus = 'REJECTED';
    order.slipReviewCount = (order.slipReviewCount || 0) + 1;

    if (order.slipReviewCount >= 3) {
      await lineMessageService.pushSlipResultFlexToAdmin(order, {
        success: false,
        message: `ลูกค้า ${order.customerName} สลิปไม่ผ่าน ${order.slipReviewCount} ครั้ง`
      });
    }
  }

  await order.save();
  await auditLogService.log({
    user: userId || order._id,
    action: 'ORDER_UPLOAD_SLIP',
    detail: { orderId: order._id, slipOkResult, status: order.paymentStatus },
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

    if (req.user?.type === 'liff' && order.customerLineId !== req.user.lineId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // กรณีหมดอายุ และยังไม่จ่าย ให้ตัดจบเลย (แต่ถ้าจ่ายแล้ว หรือกำลัง process จะไม่เข้า loop นี้)
    if (order.expiredAt && order.expiredAt < new Date()) {
      if (order.paymentStatus !== 'PAYMENT_CONFIRMED' && order.orderStatus !== 'CANCELLED') {
        // คืนของ
        await unlockStock(order.items);
        order.orderStatus = 'CANCELLED';
        order.paymentStatus = 'EXPIRED';
        await order.save();
        return res.status(400).json({ error: 'ออร์เดอร์นี้หมดอายุแล้ว กรุณาสั่งซื้อใหม่' });
      }
    }
    
    // ถ้า Cancelled ไปแล้ว ลูกค้าอัปไม่ได้
    if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'EXPIRED') {
       return res.status(400).json({ error: 'ออร์เดอร์นี้ถูกยกเลิกไปแล้ว' });
    }

    const result = await processSlipAndVerify(order, req.file, req.user?.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
};

exports.retrySlip = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์สลิป' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user?.type === 'liff' && order.customerLineId !== req.user.lineId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await processSlipAndVerify(order, req.file, req.user?.id, req.ip);
    res.json(result);
  } catch (err) { next(err); }
};

/* ----------------------- VERIFY SLIP (ADMIN) ----------------------- */
exports.verifySlip = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !order.paymentSlipFilename) {
      return res.status(400).json({ error: 'ไม่พบไฟล์สลิป' });
    }
    
    // ใช้ logic เดียวกับ processSlipAndVerify แต่ไม่ต้องอัปไฟล์ใหม่
    const filePath = path.join(__dirname, '..', 'private_uploads', order.paymentSlipFilename);
    
    let slipOkResult = { success: false, message: 'ตรวจสอบไม่ได้' };
    try {
      slipOkResult = await slipokService.verifySlipByFile(filePath, order.totalAmount);
    } catch(e) {
      slipOkResult = { success: false, message: e.message };
    }
    
    // ถ้า Slip OK -> บังคับ Success
    // แต่ถ้า Slip Fail -> Admin อาจจะอยาก Force approve? 
    // ในที่นี้ยึดตามผล SlipOK เป็นหลัก หรือถ้าจะ Force ต้องทำผ่านหน้า Update status
    
    order.slipOkResult = slipOkResult;

    if (slipOkResult.success) {
      const wasExpiredOrCancelled = order.orderStatus === 'CANCELLED' || order.paymentStatus === 'EXPIRED';

      if (order.paymentStatus !== 'PAYMENT_CONFIRMED') {
         // !!! CRITICAL FIX: ถ้าของหลุดจองไปแล้ว ต้องจองใหม่ก่อน !!!
         if (wasExpiredOrCancelled) {
            try {
               await lockStock(order.items);
            } catch(e) {
               return res.status(400).json({ error: 'สินค้าหมดแล้ว ไม่สามารถอนุมัติได้' });
            }
         }
         
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
      if (wasExpiredOrCancelled) order.expiredAt = undefined;
      
      if (order.orderStatus === 'RECEIVED' || order.orderStatus === 'CANCELLED') {
        order.orderStatus = 'PREPARING_ORDER';
      }

      // Notify
      if (order.customerLineId) {
        await lineMessageService.pushSlipResultFlexToUser(order.customerLineId, order, {
          success: true, message: 'Admin ตรวจสอบการชำระเงินเรียบร้อยแล้ว'
        });
      }
    } else {
       order.paymentStatus = 'REJECTED';
    }

    await order.save();
    await auditLogService.log({
       user: req.user?.id, action: 'ORDER_VERIFY_SLIP_ADMIN', 
       detail: { orderId: order._id, result: slipOkResult }, ip: req.ip
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

    // เช็คสิทธิ์ (LIFF)
    if (req.user?.type === 'liff' && order.customerLineId !== req.user.lineId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 1. แปลงเป็น Object ธรรมดา เพื่อให้เรายัด property 'slipUrl' เพิ่มได้
    const orderObj = order.toObject();

    // 2. ถ้ามีไฟล์สลิป ให้สร้าง Signed URL
    if (orderObj.paymentSlipFilename) {
      // เช็คว่าเป็นเจ้าของออเดอร์หรือไม่?
      const isOwner = req.user?.type === 'liff' && req.user.lineId === order.customerLineId;
      
      // ถ้าเป็นเจ้าของใช้ TTL User, ถ้าไม่ใช่ (Admin) ใช้ TTL Staff
      const ttl = isOwner ? SLIP_TTL_USER : (SLIP_TTL_STAFF || 300);
      
      orderObj.slipUrl = buildSignedUrl(orderObj.paymentSlipFilename, ttl);
    }

    res.json(orderObj);
  } catch (err) { next(err); }
};

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
    // 1. เพิ่ม .lean() ท้ายสุด เพื่อให้ Mongoose คืนค่าเป็น Plain Object (แก้ไขได้ & เร็วขึ้น)
    const orders = await Order.find()
      .populate('items.product')
      .sort({ createdAt: -1 })
      .lean();

    // 2. วนลูปเช็ค: ถ้ามีไฟล์สลิป ให้สร้าง slipUrl (Signed URL) แปะไปด้วย
    const ordersWithSignedUrl = orders.map(order => {
      if (order.paymentSlipFilename) {
        // ใช้ TTL ของ Staff (เช่น 300 วิ หรือตาม config) ในการดูรูป
        // ถ้าอยากให้นานกว่านี้ แก้ตัวเลขตรงนี้ได้ (หน่วยเป็นวินาที)
        const ttl = SLIP_TTL_STAFF || 300; 
        order.slipUrl = buildSignedUrl(order.paymentSlipFilename, ttl);
      }
      return order;
    });

    res.json(ordersWithSignedUrl);
  } catch (err) { next(err); }
};


/* ----------------------- UPDATE (ADMIN) ----------------------- */
exports.update = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

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
    };
    const prevTrackingNo = order.trackingNumber;

    if (typeof req.body.trackingNumber === 'string' &&
        req.body.trackingNumber !== order.trackingNumber) {
      order.trackingHistory = [];
      order.lastTrackingHash = undefined;
      order.lastTrackingFetchedAt = undefined;
      order.deliveredAt = undefined;
      if (prevTrackingNo) clearRespCache(prevTrackingNo);
      if (req.body.trackingNumber) clearRespCache(req.body.trackingNumber);
    }

    Object.assign(order, req.body);

    const prevPaid   = prev.paymentStatus === 'PAYMENT_CONFIRMED';
    const nowPaid    = order.paymentStatus === 'PAYMENT_CONFIRMED';
    const prevExpiredOrCancelled = prev.orderStatus === 'CANCELLED' || prev.paymentStatus === 'EXPIRED';
    const nowExpiredOrCancelled = order.orderStatus === 'CANCELLED' || order.paymentStatus === 'EXPIRED';

    // 1. Cancel/Expire now (and never paid before) -> Refund Stock
    if (nowExpiredOrCancelled && !prevExpiredOrCancelled && !prevPaid) {
      await unlockStock(order.items);
    }

    // 2. Recover from Cancel/Expire -> Reserve Stock
    if (prevExpiredOrCancelled && !nowExpiredOrCancelled && !nowPaid) {
      try {
        await lockStock(order.items);
      } catch (e) {
        return res.status(400).json({ error: 'สต๊อกไม่พอสำหรับกู้คืนออเดอร์' });
      }
      if (!order.expiredAt || order.expiredAt < new Date()) {
        order.expiredAt = new Date(Date.now() + ORDER_RENEW_MINUTES * 60 * 1000);
      }
    }

    // 3. Mark as Paid
    if (!prevPaid && nowPaid) {
      // Recover stock if needed
      if (prevExpiredOrCancelled) {
        try {
          await lockStock(order.items);
        } catch (e) {
          return res.status(400).json({ error: 'สต๊อกไม่พอสำหรับยืนยันการขาย' });
        }
      }
      await confirmStock(order.items);
      await SaleHistory.create({
        orderId: order._id,
        customerName: order.customerName,
        customerLineId: order.customerLineId,
        items: order.items,
        paidAmount: order.totalAmount,
        soldAt: new Date()
      });

      if (order.orderStatus === 'RECEIVED') {
        order.orderStatus = 'PREPARING_ORDER';
      }
    }

    // Shipping Notification
    if (prev.orderStatus !== 'SHIPPING' && order.orderStatus === 'SHIPPING') {
      if (order.customerLineId) {
        const flex = lineMessageService.buildShippingStartedFlex(order);
        await lineMessageService.pushToUser(order.customerLineId, flex);
      }
    }

    // Status Change Notification
    const anyChanged = (prev.orderStatus !== order.orderStatus) || (prev.paymentStatus !== order.paymentStatus);
    if (anyChanged && order.customerLineId) {
      const flex = lineMessageService.buildOrderStatusUpdateFlex(order);
      await lineMessageService.pushToUser(order.customerLineId, flex);
    }

    await order.save();
    await auditLogService.log({
      user: req.user?.id, action: 'ORDER_UPDATE',
      detail: { orderId: order._id, before: prev, after: req.body }, ip: req.ip
    });

    res.json(order);
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    // คืนของถ้ายังไม่จ่าย
    if (order && order.paymentStatus !== 'PAYMENT_CONFIRMED') {
      await unlockStock(order.items);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.pushMessageToCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const text = (req.body?.text || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'ระบุข้อความ' });

    const order = await Order.findById(id);
    if (!order || !order.customerLineId) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    await lineMessageService.pushToUser(order.customerLineId, { type: 'text', text });
    await auditLogService.log({ user: req.user?.id, action: 'PUSH_MSG', detail: { orderId: id }, ip: req.ip });

    res.json({ success: true });
  } catch (err) { next(err); }
};