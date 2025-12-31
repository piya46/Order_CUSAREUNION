// backend/src/services/lineMessageService.js
const axios = require('axios');
const https = require('https');
require('dotenv').config();

/* ======================== ENV ========================= */
const BASE_URL = 'https://api.line.me/v2/bot';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!CHANNEL_ACCESS_TOKEN) {
  console.warn('[lineMessageService] Missing LINE_CHANNEL_ACCESS_TOKEN');
}

const PUBLIC_WEB_BASE_URL = process.env.PUBLIC_WEB_BASE_URL || '';
const WEB_BASE = PUBLIC_WEB_BASE_URL.startsWith('https://') ? PUBLIC_WEB_BASE_URL : null;

// Admin Targets (User IDs หรือ Group ID)
const ADMIN_SINGLE = process.env.LINE_ADMIN_USER_ID || '';
const ADMIN_LIST = (process.env.LINE_ADMIN_USER_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ADMIN_IDS = ADMIN_LIST.length ? ADMIN_LIST : (ADMIN_SINGLE ? [ADMIN_SINGLE] : []);

// Group ID สำหรับห้อง Admin (ต้องตั้งค่าใน .env)
const ADMIN_GROUP_ID = process.env.LINE_ADMIN_GROUP_ID;

/* =============== LINE HTTP CLIENT =============== */
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  proxy: false,
  httpsAgent: new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    timeout: 20000,
    family: 4,
    maxSockets: 50,
  }),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
  },
});

/* ======================== helpers ========================= */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function postWithRetry(url, body, { attempts = 3, throwOnFail = false } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await http.post(url, body);
      return { ok: true, status: res.status, data: res.data };
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        await delay(800 * i);
        continue;
      }
      break;
    }
  }
  if (throwOnFail) throw lastErr;
  return { ok: false, err: lastErr };
}

async function safePost(url, body) {
  const r = await postWithRetry(url, body, { attempts: 3, throwOnFail: false });
  if (!r.ok) {
    console.error(`[LINE API Error]`, r.err?.response?.data || r.err?.message);
  }
  return r.ok;
}

const thMoney = (n) => Number(n || 0).toLocaleString('th-TH');

// Helper for status mapping
const STATUS_TH = {
  RECEIVED: 'รับออเดอร์',
  PREPARING_ORDER: 'กำลังเตรียมสินค้า',
  SHIPPING: 'จัดส่งแล้ว',
  COMPLETED: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
  WAITING: 'รอโอน',
  PENDING_PAYMENT: 'รอตรวจสอบ',
  PAYMENT_CONFIRMED: 'ชำระแล้ว',
  REJECTED: 'สลิปไม่ผ่าน',
  EXPIRED: 'หมดอายุ'
};

const getColor = (status) => {
  if (['PAYMENT_CONFIRMED', 'COMPLETED', 'SHIPPING'].includes(status)) return '#1DB446'; // Green
  if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(status)) return '#FF334B'; // Red
  if (['PENDING_PAYMENT'].includes(status)) return '#FFC107'; // Yellow
  return '#aaaaaa';
};

/* ====================== ✨ PREMIUM FLEX BUILDERS ====================== */

function buildOrderStatusUpdateFlex(order) {
  const statusLabels = {
    'RECEIVED': { text: 'รับออเดอร์แล้ว', color: '#17a2b8', icon: '📝' },
    'PREPARING_ORDER': { text: 'กำลังจัดเตรียมสินค้า', color: '#ffc107', icon: '📦' },
    'SHIPPING': { text: 'กำลังจัดส่ง', color: '#007bff', icon: '🚚' },
    'COMPLETED': { text: 'สำเร็จเรียบร้อย', color: '#28a745', icon: '✅' },
    'CANCELLED': { text: 'ยกเลิกออเดอร์', color: '#dc3545', icon: '❌' },
    'PAYMENT_CONFIRMED': { text: 'ชำระเงินเรียบร้อย', color: '#28a745', icon: '💰' },
    'REJECTED': { text: 'ชำระเงินไม่ผ่าน', color: '#dc3545', icon: '⚠️' }
  };
  const current = statusLabels[order.orderStatus] || statusLabels[order.paymentStatus] || { text: order.orderStatus, color: '#6c757d', icon: '📢' };

  const bubble = {
    type: 'bubble',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: current.color,
      contents: [
        { type: 'text', text: 'ORDER UPDATE', color: '#ffffffcc', size: 'xs', weight: 'bold' },
        { type: 'text', text: `${current.icon} ${current.text}`, color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
      ]
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md',
      contents: [
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: 'หมายเลขออเดอร์', size: 'sm', color: '#aaaaaa', flex: 1 },
            { type: 'text', text: `#${order.orderNo}`, size: 'sm', color: '#444444', flex: 1, align: 'end', weight: 'bold' }
          ]
        },
        { type: 'separator' },
        { type: 'text', text: 'ขอบคุณที่ร่วมกิจกรรม ระบบจะแจ้งให้ทราบเมื่อมีความคืบหน้าถัดไปครับ', size: 'xs', color: '#888888', wrap: true, style: 'italic' }
      ]
    }
  };

  if (WEB_BASE) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [
        {
          type: 'button', style: 'primary', color: current.color, height: 'sm',
          action: { type: 'uri', label: 'ดูรายละเอียดออเดอร์', uri: `${WEB_BASE}/orders/${order._id}` }
        }
      ]
    };
  }

  return { type: 'flex', altText: `📢 อัปเดตสถานะออเดอร์ #${order.orderNo}`, contents: bubble };
}

function buildOrderCreatedFlex(order, { forAdmin = false } = {}) {
  const amount = thMoney(order.totalAmount);
  const shippingBadge = order.shippingType === 'DELIVERY'
    ? { text: '🚚 จัดส่งพัสดุ', color: '#1565c0' }
    : { text: '🏬 รับสินค้าด้วยตนเอง', color: '#2e7d32' };

  const bubble = {
    type: 'bubble',
    hero: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1000&auto=format&fit=crop',
      size: 'full', aspectRatio: '20:13', aspectMode: 'cover'
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md',
      contents: [
        { type: 'text', text: forAdmin ? '🔔 มีออเดอร์ใหม่!' : '🛒 รับออเดอร์ของคุณแล้ว', weight: 'bold', size: 'xl', color: '#2c3e50' },
        { type: 'text', text: `หมายเลข #${order.orderNo}`, size: 'sm', color: '#999999' },
        {
          type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm',
          contents: [
            {
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: 'ยอดชำระ', size: 'sm', color: '#aaaaaa', flex: 1 },
                { type: 'text', text: `${amount} ฿`, size: 'lg', color: '#d32f2f', weight: 'bold', flex: 1, align: 'end' }
              ]
            },
            {
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: 'รับสินค้า', size: 'sm', color: '#aaaaaa', flex: 1 },
                { type: 'text', text: shippingBadge.text, size: 'sm', color: shippingBadge.color, weight: 'bold', flex: 1, align: 'end' }
              ]
            }
          ]
        }
      ]
    }
  };

  if (WEB_BASE) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [
        {
          type: 'button', style: 'primary', color: '#2c3e50',
          action: {
            type: 'uri',
            label: forAdmin ? 'จัดการออเดอร์' : 'ชำระเงิน / แจ้งโอน',
            uri: forAdmin ? `${WEB_BASE}/orders/${order._id}` : `${WEB_BASE}/orders/${order._id}/upload-slip`
          }
        }
      ]
    };
  }

  return { type: 'flex', altText: `🛒 ออเดอร์ใหม่ #${order.orderNo}`, contents: bubble };
}

function buildSlipResultFlex(order, { success, message }) {
  const config = success
    ? { title: 'ชำระเงินสำเร็จ', color: '#28a745', icon: 'https://cdn-icons-png.flaticon.com/512/5290/5290058.png' }
    : { title: 'สลิปไม่ผ่านการตรวจสอบ', color: '#dc3545', icon: 'https://cdn-icons-png.flaticon.com/512/595/595067.png' };

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box', layout: 'vertical', spacing: 'md',
      contents: [
        { type: 'image', url: config.icon, size: 'sm', aspectRatio: '1:1' },
        { type: 'text', text: config.title, weight: 'bold', size: 'lg', color: config.color, align: 'center' },
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: 'ยอดชำระ', size: 'sm', color: '#aaaaaa' },
            { type: 'text', text: `${thMoney(order.totalAmount)} บาท`, size: 'sm', color: '#333333', align: 'end', weight: 'bold' }
          ]
        },
        { type: 'text', text: message || (success ? 'เราได้รับยอดชำระเรียบร้อยแล้ว' : 'กรุณาแจ้งโอนใหม่อีกครั้ง'), size: 'xs', color: '#666666', margin: 'md', wrap: true, align: 'center' }
      ]
    }
  };

  if (WEB_BASE) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [
        {
          type: 'button', style: 'primary', color: config.color,
          action: {
            type: 'uri',
            label: success ? 'ติดตามสถานะ' : 'อัปโหลดสลิปใหม่',
            uri: success ? `${WEB_BASE}/orders/${order._id}` : `${WEB_BASE}/orders/${order._id}/upload-slip`
          }
        }
      ]
    };
  }

  return { type: 'flex', altText: `🧾 ผลตรวจสลิป ออเดอร์ #${order.orderNo}`, contents: bubble };
}

function buildShippingStartedFlex(order) {
  const bubble = {
    type: 'bubble',
    hero: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaad5b?q=80&w=1000&auto=format&fit=crop',
      size: 'full', aspectRatio: '20:13', aspectMode: 'cover'
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md',
      contents: [
        { type: 'text', text: '🚚 สินค้ากำลังเดินทางไปหาคุณ!', weight: 'bold', size: 'lg', color: '#007bff' },
        {
          type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm',
          contents: [
            {
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: 'เลขพัสดุ', size: 'sm', color: '#aaaaaa', flex: 1 },
                { type: 'text', text: order.trackingNumber || '-', size: 'sm', color: '#333333', flex: 2, align: 'end', weight: 'bold' }
              ]
            },
            {
              type: 'box', layout: 'horizontal',
              contents: [
                { type: 'text', text: 'ขนส่งโดย', size: 'sm', color: '#aaaaaa', flex: 1 },
                { type: 'text', text: order.shippingProvider || 'ไปรษณีย์ไทย', size: 'sm', color: '#333333', flex: 2, align: 'end' }
              ]
            }
          ]
        }
      ]
    }
  };

  if (order.trackingNumber) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [
        {
          type: 'button', style: 'primary', color: '#007bff',
          action: { type: 'uri', label: '📍 เช็คสถานะพัสดุ', uri: `https://track.thailandpost.co.th/?trackNumber=${order.trackingNumber}` }
        }
      ]
    };
  }

  return { type: 'flex', altText: `🚚 ส่งของแล้ว! ออเดอร์ #${order.orderNo}`, contents: bubble };
}

function buildDeliveredFlex(order, barcode) {
  return {
    type: 'flex',
    altText: `📦 สินค้าถึงมือคุณแล้ว! ออเดอร์ #${order.orderNo}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          {
            type: 'box', layout: 'vertical', backgroundColor: '#28a745', paddingAll: 'lg',
            contents: [{ type: 'text', text: '🎉 จัดส่งสำเร็จ!', color: '#ffffff', weight: 'bold', size: 'xl', align: 'center' }]
          },
          {
            type: 'box', layout: 'vertical', paddingAll: 'xl', spacing: 'sm',
            contents: [
              { type: 'text', text: 'พัสดุจัดส่งถึงมือเรียบร้อยแล้ว หวังว่าคุณจะประทับใจในสินค้าของเรานะครับ', size: 'sm', color: '#444444', align: 'center', wrap: true },
              { type: 'text', text: `Track: ${barcode}`, size: 'xs', color: '#999999', align: 'center', margin: 'md' }
            ]
          }
        ],
        paddingAll: 'none'
      }
    }
  };
}

/* ====================== PUBLIC APIs ====================== */

async function sendToTargets(targetIds, messageObject) {
  if (!targetIds?.length) return true;
  const userIds = targetIds.filter(id => id.startsWith('U')); 
  const otherIds = targetIds.filter(id => !id.startsWith('U'));

  let okAll = true;
  for (const batch of chunk(userIds, 500)) {
    const ok = await safePost('/message/multicast', { to: batch, messages: [messageObject] });
    okAll = okAll && ok;
  }
  for (const id of otherIds) {
    const ok = await safePost('/message/push', { to: id, messages: [messageObject] });
    okAll = okAll && ok;
  }
  return okAll;
}

async function pushToUser(userId, textOrFlex) {
  if (!userId) return false;
  const message = typeof textOrFlex === 'string' ? { type: 'text', text: textOrFlex } : textOrFlex;
  return safePost('/message/push', { to: userId, messages: [message] });
}

async function pushToAdmin(textOrFlex) {
  const targets = [...ADMIN_IDS];
  if (ADMIN_GROUP_ID) targets.push(ADMIN_GROUP_ID);
  
  if (!targets.length) return true;
  const message = typeof textOrFlex === 'string' ? { type: 'text', text: textOrFlex } : textOrFlex;
  return sendToTargets(targets, message);
}

async function pushOrderStatusUpdate(order) {
  if (!order?.customerLineId) return true;
  return pushToUser(order.customerLineId, buildOrderStatusUpdateFlex(order));
}

// [NEW] ฟังก์ชันแจ้งเตือน Admin แบบละเอียด เมื่อสถานะเปลี่ยน
async function pushOrderStatusUpdateToAdmin(order, prevStatus, prevPayment) {
  const targets = [...ADMIN_IDS];
  if (ADMIN_GROUP_ID) targets.push(ADMIN_GROUP_ID);
  
  if (!targets.length) return;

  const changes = [];
  if (prevStatus !== order.orderStatus) {
    changes.push({
      type: 'text', text: `สถานะ: ${STATUS_TH[prevStatus]||prevStatus} ➝ ${STATUS_TH[order.orderStatus]||order.orderStatus}`,
      size: 'sm', color: getColor(order.orderStatus), weight: 'bold', wrap: true
    });
  }
  if (prevPayment !== order.paymentStatus) {
    changes.push({
      type: 'text', text: `การเงิน: ${STATUS_TH[prevPayment]||prevPayment} ➝ ${STATUS_TH[order.paymentStatus]||order.paymentStatus}`,
      size: 'sm', color: getColor(order.paymentStatus), weight: 'bold', wrap: true
    });
  }

  // Items info (max 5)
  const itemsContent = (order.items || []).slice(0, 5).map(it => ({
      type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: `▪ ${it.productName} (${it.size||'-'} ${it.color||''})`, size: 'xs', color: '#555555', flex: 7, wrap: true },
          { type: 'text', text: `x${it.quantity}`, size: 'xs', align: 'end', flex: 2 }
      ]
  }));
  if(order.items.length > 5) {
      itemsContent.push({ type: 'text', text: `...และอีก ${order.items.length-5} รายการ`, size: 'xxs', color: '#999999', align: 'end' });
  }

  const flex = {
    type: 'flex',
    altText: `Update Order #${order.orderNo}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#f7f7f7',
        contents: [
          { type: 'text', text: 'ORDER UPDATE', weight: 'bold', size: 'xxs', color: '#aaaaaa' },
          { type: 'text', text: order.orderNo, weight: 'bold', size: 'lg', margin: 'xs' },
          { type: 'text', text: order.customerName, size: 'sm', color: '#333333' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          ...changes,
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'Items:', size: 'xs', weight: 'bold', margin: 'md', color: '#aaaaaa' },
          ...itemsContent,
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'horizontal', margin: 'md', contents: [
              { type: 'text', text: 'Total', size: 'sm', color: '#555555' },
              { type: 'text', text: thMoney(order.totalAmount), size: 'sm', weight: 'bold', align: 'end' }
          ]}
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
            type: 'button', style: 'link', height: 'sm',
            action: { type: 'uri', label: 'View Order', uri: `${process.env.PUBLIC_WEB_BASE_URL}/admin/orders/${order._id}` }
        }]
      }
    }
  };

  return sendToTargets(targets, flex);
}

async function pushShippingStarted(order) {
  if (!order?.customerLineId) return true;
  return pushToUser(order.customerLineId, buildShippingStartedFlex(order));
}

async function pushDelivered(order, barcode) {
  if (!order?.customerLineId) return true;
  return pushToUser(order.customerLineId, buildDeliveredFlex(order, barcode));
}

async function pushSlipResultFlexToUser(userId, order, result) {
  return pushToUser(userId, buildSlipResultFlex(order, result));
}

async function pushOrderCreatedFlexToUser(userId, order) {
  return pushToUser(userId, buildOrderCreatedFlex(order));
}

async function pushOrderCreatedFlexToAdmin(order) {
  const targets = [...ADMIN_IDS];
  if (ADMIN_GROUP_ID) targets.push(ADMIN_GROUP_ID);
  if (!targets.length) return true;
  return sendToTargets(targets, buildOrderCreatedFlex(order, { forAdmin: true }));
}

async function pushSlipResultFlexToAdmin(order, result) {
  const targets = [...ADMIN_IDS];
  if (ADMIN_GROUP_ID) targets.push(ADMIN_GROUP_ID);
  if (!targets.length) return true;
  return sendToTargets(targets, buildSlipResultFlex(order, result));
}

module.exports = {
  pushToUser,
  pushToAdmin,
  pushOrderStatusUpdate,
  pushOrderStatusUpdateToAdmin,
  pushShippingStarted,
  pushDelivered,
  pushSlipResultFlexToUser,
  pushOrderCreatedFlexToUser,
  pushOrderCreatedFlexToAdmin,
  pushSlipResultFlexToAdmin,
  buildOrderCreatedFlex,
  buildSlipResultFlex,
  buildOrderStatusUpdateFlex,
  buildShippingStartedFlex,
  buildDeliveredFlex
};