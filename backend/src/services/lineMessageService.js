// services/lineMessageService.js
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
// ใช้เฉพาะ https เพื่อไม่ให้ LINE ปฏิเสธ URL ใน Flex
const WEB_BASE = PUBLIC_WEB_BASE_URL.startsWith('https://') ? PUBLIC_WEB_BASE_URL : null;

// รองรับทั้งตัวแปรเดี่ยว/หลายคน (userId=U..., groupId=C..., roomId=R...)
const ADMIN_SINGLE = process.env.LINE_ADMIN_USER_ID || '';
const ADMIN_LIST = (process.env.LINE_ADMIN_USER_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ADMIN_IDS = ADMIN_LIST.length ? ADMIN_LIST : (ADMIN_SINGLE ? [ADMIN_SINGLE] : []);

/* =============== LINE HTTP CLIENT (ทนเน็ตแผ่ว) =============== */
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,               // ⬆️ ยืด timeout
  proxy: false,                 // กัน axios แอบใช้ HTTP(S)_PROXY
  httpsAgent: new https.Agent({
    keepAlive: true,            // ลด TLS handshake
    keepAliveMsecs: 10000,
    timeout: 20000,             // socket timeout
    family: 4,                  // บังคับ IPv4 (หลบ route IPv6 ช้า)
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

/**
 * ยิง POST แบบมี retry/backoff — คืน {ok:boolean, ...}
 * throwOnFail=false จะไม่โยน error ออกไป (ป้องกัน flow หลักพังเพราะ push)
 */
async function postWithRetry(url, body, { attempts = 3, throwOnFail = false } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    const t0 = Date.now();
    try {
      const res = await http.post(url, body);
      const ms = Date.now() - t0;
      if (ms > 1500) console.info(`[LINE] ${url} slow ${ms}ms`);
      return { ok: true, status: res.status, data: res.data };
    } catch (err) {
      lastErr = err;
      const code = err.code || err?.response?.status;
      const retryableHttp = [429, 500, 502, 503, 504].includes(err?.response?.status);
      const isTimeoutLike = code === 'ECONNABORTED';
      const isNetworkLike = ['ECONNRESET','ETIMEDOUT','EAI_AGAIN','ENOTFOUND'].includes(code);
      const rid = err?.response?.headers?.['x-line-request-id'];
      console.warn(`[LINE] POST ${url} fail #${i}`, code, err?.message, rid ? `RID=${rid}` : '');

      if (i < attempts && (retryableHttp || isTimeoutLike || isNetworkLike)) {
        await delay(800 * i);   // 0.8s, 1.6s, 2.4s …
        continue;
      }
      break;
    }
  }
  if (throwOnFail) throw lastErr;
  return { ok: false, err: lastErr, status: lastErr?.response?.status };
}

/** แทน safePost เดิม — คืน true/false ไม่โยน error */
async function safePost(url, body) {
  const r = await postWithRetry(url, body, { attempts: 3, throwOnFail: false });
  if (!r.ok) {
    const data = r.err?.response?.data || r.err?.message || r.err;
    const rid = r.err?.response?.headers?.['x-line-request-id'];
    console.error(`POST ${url} error:`, data, rid ? `RID=${rid}` : '');
  }
  return r.ok;
}
/** เวอร์ชันเคร่ง (เหมือนของเดิม) — จะ throw เมื่อ fail */
safePost.strict = (url, body) =>
  postWithRetry(url, body, { attempts: 3, throwOnFail: true }).then(() => true);

/* =============== ส่งไปยัง target หลายชนิด =============== */
async function sendToTargets(targetIds, messageObject) {
  if (!targetIds?.length) return true;

  const userIds  = targetIds.filter(id => id.startsWith('U'));
  const groupIds = targetIds.filter(id => id.startsWith('C')); // group
  const roomIds  = targetIds.filter(id => id.startsWith('R')); // room

  let okAll = true;

  // users -> multicast (<= 500)
  for (const batch of chunk(userIds, 500)) {
    const ok = await safePost('/message/multicast', { to: batch, messages: [messageObject] });
    okAll = okAll && ok;
  }

  // groups -> push
  for (const gid of groupIds) {
    const ok = await safePost('/message/push', { to: gid, messages: [messageObject] });
    okAll = okAll && ok;
  }

  // rooms -> push
  for (const rid of roomIds) {
    const ok = await safePost('/message/push', { to: rid, messages: [messageObject] });
    okAll = okAll && ok;
  }

  return okAll;
}

async function sendToTargetsWithFallback(targetIds, primaryMsg, fallbackText) {
  const ok = await sendToTargets(targetIds, primaryMsg);
  if (!ok && fallbackText) {
    await sendToTargets(targetIds, { type: 'text', text: fallbackText });
  }
  return ok;
}

/* ====================== Low-level senders ====================== */
async function pushRaw(to, message) {
  return safePost('/message/push', { to, messages: [message] });
}
async function multicastRaw(toList, message) {
  const userOnly = (toList || []).filter(id => id.startsWith('U'));
  if (!userOnly.length) return true;
  let okAll = true;
  for (const batch of chunk(userOnly, 500)) {
    const ok = await safePost('/message/multicast', { to: batch, messages: [message] });
    okAll = okAll && ok;
  }
  return okAll;
}

/* ====================== FLEX BUILDERS ====================== */
function buildOrderCreatedFlex(order, { forAdmin = false } = {}) {
  const amount = Number(order.totalAmount || 0).toLocaleString('th-TH');
  const createdAt = new Date(order.createdAt || Date.now()).toLocaleString('th-TH');
  const shippingBadge =
    order.shippingType === 'DELIVERY'
      ? { text: 'จัดส่ง', color: '#1565c0', emoji: '🚚' }
      : { text: 'รับเอง', color: '#2e7d32', emoji: '🏬' };

  const footerButtons = [];
  if (WEB_BASE && order._id) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      action: {
        type: 'uri',
        label: forAdmin ? 'เปิดออเดอร์' : 'อัปโหลดสลิป',
        uri: forAdmin
          ? `${WEB_BASE}/orders/${order._id}`
          : `${WEB_BASE}/orders/${order._id}/upload-slip`,
      },
    });
    footerButtons.push({
      type: 'button',
      style: 'secondary',
      action: {
        type: 'uri',
        label: 'ดูรายละเอียด',
        uri: `${WEB_BASE}/orders/${order._id}`,
      },
    });
  }

  const flex = {
    type: 'flex',
    altText: `🛒 ออเดอร์ใหม่ #${order.orderNo} จาก ${order.customerName}`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              { type: 'text', text: 'ออเดอร์ใหม่', weight: 'bold', size: 'lg' },
              { type: 'text', text: `#${order.orderNo}`, weight: 'bold', size: 'sm', color: '#999999', margin: 'sm' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ลูกค้า', size: 'sm', color: '#999999', flex: 2 },
              { type: 'text', text: order.customerName || '-', size: 'sm', wrap: true, flex: 5 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วิธีรับสินค้า', size: 'sm', color: '#999999', flex: 2 },
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  { type: 'text', text: `${shippingBadge.emoji} ${shippingBadge.text}`, weight: 'bold', size: 'sm', color: shippingBadge.color },
                ],
                flex: 5,
              },
            ],
          },
          ...(order.shippingType === 'DELIVERY' && order.customerAddress
            ? [{
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: 'ที่อยู่จัดส่ง', size: 'sm', color: '#999999' },
                  { type: 'text', text: order.customerAddress, size: 'sm', wrap: true },
                ],
              }]
            : []),
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ยอดรวม', size: 'sm', color: '#999999', flex: 2 },
              { type: 'text', text: `${amount} บาท`, size: 'md', weight: 'bold', color: '#d32f2f', flex: 5 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'สถานะ', size: 'sm', color: '#999999', flex: 2 },
              { type: 'text', text: order.orderStatus || '-', size: 'sm', weight: 'bold', color: '#1565c0', flex: 5 },
            ],
          },
          { type: 'text', text: `สร้างเมื่อ: ${createdAt}`, size: 'xxs', color: '#aaaaaa' },
        ],
      },
      ...(footerButtons.length
        ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons } }
        : {}),
    },
  };

  if (!WEB_BASE) {
    const quickItems = forAdmin
      ? [{ type: 'action', action: { type: 'message', label: 'ดูออเดอร์', text: `ดูออเดอร์ #${order.orderNo}` } }]
      : [
          { type: 'action', action: { type: 'message', label: 'อัปโหลดสลิป', text: `อัปโหลดสลิป #${order.orderNo}` } },
          { type: 'action', action: { type: 'message', label: 'เช็คสถานะ', text: `เช็คสถานะ #${order.orderNo}` } },
        ];
    flex.quickReply = { items: quickItems };
  }
  return flex;
}

function buildSlipResultFlex(order, { success, message }) {
  const amount = Number(order.totalAmount || 0).toLocaleString('th-TH');
  const result = success
    ? { title: 'ชำระเงินสำเร็จ', color: '#2e7d32', emoji: '✅', icon: 'https://cdn-icons-png.flaticon.com/512/845/845646.png' }
    : { title: 'สลิปไม่ผ่าน', color: '#c62828', emoji: '⚠️', icon: 'https://cdn-icons-png.flaticon.com/512/463/463612.png' };

  const flex = {
    type: 'flex',
    altText: `${result.emoji} ${result.title} | ออเดอร์ #${order.orderNo}`,
    contents: {
      type: 'bubble',
      hero: { type: 'image', url: result.icon, size: 'full', aspectRatio: '20:13', aspectMode: 'fit' },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `${result.emoji} ${result.title}`, weight: 'bold', size: 'lg', color: result.color },
          { type: 'text', text: `ออเดอร์ #${order.orderNo}`, size: 'sm', color: '#666666' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ยอดชำระ', size: 'sm', color: '#999999', flex: 2 },
              { type: 'text', text: `${amount} บาท`, size: 'md', weight: 'bold', color: '#d32f2f', flex: 5 },
            ],
          },
          ...(message ? [{ type: 'text', text: message, size: 'sm', wrap: true, color: '#666666' }] : []),
        ],
      },
      ...(WEB_BASE && order._id
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                success
                  ? { type: 'button', style: 'primary', action: { type: 'uri', label: 'ติดตามสถานะ', uri: `${WEB_BASE}/orders/${order._id}` } }
                  : { type: 'button', style: 'primary', action: { type: 'uri', label: 'อัปโหลดสลิปใหม่', uri: `${WEB_BASE}/orders/${order._id}/upload-slip` } },
              ],
            },
          }
        : {}),
    },
  };

  if (!WEB_BASE) {
    flex.quickReply = {
      items: success
        ? [{ type: 'action', action: { type: 'message', label: 'เช็คสถานะ', text: `เช็คสถานะ #${order.orderNo}` } }]
        : [{ type: 'action', action: { type: 'message', label: 'อัปโหลดสลิป', text: `อัปโหลดสลิป #${order.orderNo}` } }],
    };
  }
  return flex;
}

// helper แสดงตัวเลขแบบไทย
const thMoney = (n) => Number(n || 0).toLocaleString('th-TH');

function buildSlipResultFlexAdmin(order, { success, message }) {
  const amount = thMoney(order.totalAmount);
  const items = Array.isArray(order.items) ? order.items : [];

  // ทำ list รายการ (จำกัด 12 บรรทัดเพื่อความปลอดภัยของขนาด Flex)
  const MAX_LINES = 12;
  const itemLines = items.slice(0, MAX_LINES).map((it) => {
    const name = it.productName || '-';
    const opt  = `${it.size || '-'} / ${it.color || '-'}`;
    const qty  = Number(it.quantity || it.qty || 0);
    const price = Number(it.price || 0);
    const sub = thMoney(qty * price);

    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        { type: 'text', text: `• ${name} (${opt})`, size: 'sm', wrap: true, flex: 7 },
        { type: 'text', text: `${qty} x ${thMoney(price)}`, size: 'xs', color: '#64748b', align: 'end', flex: 3 }
      ]
    };
  });

  if (items.length > MAX_LINES) {
    itemLines.push({
      type: 'text',
      text: `...และอีก ${items.length - MAX_LINES} รายการ`,
      size: 'xs',
      color: '#64748b'
    });
  }

  const result = success
    ? { title: 'ชำระเงินสำเร็จ', color: '#2e7d32', emoji: '✅',
        icon: 'https://cdn-icons-png.flaticon.com/512/845/845646.png' }
    : { title: 'สลิปไม่ผ่าน', color: '#c62828', emoji: '⚠️',
        icon: 'https://cdn-icons-png.flaticon.com/512/463/463612.png' };

  return {
    type: 'flex',
    altText: `${result.emoji} ${result.title} | ออเดอร์ #${order.orderNo}`,
    contents: {
      type: 'bubble',
      hero: { type: 'image', url: result.icon, size: 'full', aspectRatio: '20:13', aspectMode: 'fit' },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `${result.emoji} ${result.title}`, weight: 'bold', size: 'lg', color: result.color },
          { type: 'text', text: `ออเดอร์ #${order.orderNo}`, size: 'sm', color: '#666666' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ลูกค้า', size: 'sm', color: '#999999', flex: 3 },
              { type: 'text', text: order.customerName || '-', size: 'sm', wrap: true, flex: 5 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ยอดชำระ', size: 'sm', color: '#999999', flex: 3 },
              { type: 'text', text: `${amount} บาท`, size: 'md', weight: 'bold', color: '#d32f2f', flex: 5 },
            ],
          },
          ...(message ? [{ type: 'text', text: message, size: 'sm', wrap: true, color: '#666666' }] : []),

          ...(success && items.length
            ? [
                { type: 'separator', margin: 'md' },
                { type: 'text', text: 'รายการสินค้า', size: 'sm', weight: 'bold', color: '#1565c0' },
                { type: 'box', layout: 'vertical', spacing: 'xs', contents: itemLines },
              ]
            : [])
        ],
      },
      ...(WEB_BASE && order._id
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                { type: 'button', style: 'primary',
                  action: { type: 'uri', label: 'เปิดออเดอร์', uri: `${WEB_BASE}/orders/${order._id}` } }
              ],
            },
          }
        : {}),
    },
  };
}

function buildDeliveredFlex(order, barcode) {
  const amount = Number(order.totalAmount || 0).toLocaleString('th-TH');
  const result = {
    title: 'นำจ่ายสำเร็จ',
    color: '#14b8a6',
    emoji: '📦',
    icon: 'https://cdn-icons-png.flaticon.com/512/190/190411.png'
  };

  return {
    type: 'flex',
    altText: `${result.emoji} ${result.title} | ออเดอร์ #${order.orderNo}`,
    contents: {
      type: 'bubble',
      hero: { type: 'image', url: result.icon, size: 'full', aspectRatio: '20:13', aspectMode: 'fit' },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `${result.emoji} ${result.title}`, weight: 'bold', size: 'lg', color: result.color },
          { type: 'text', text: `ออเดอร์ #${order.orderNo}`, size: 'sm', color: '#666666' },
          { type: 'text', text: `ยอดรวม ${amount} บาท`, size: 'sm', color: '#d32f2f', weight: 'bold' },
          { type: 'text', text: `เลขพัสดุ: ${barcode}`, size: 'sm', color: '#666666', wrap: true }
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: 'ดูในไปรษณีย์ไทย',
              uri: `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(barcode)}`
            }
          }
        ]
      }
    }
  };
}

function buildOrderStatusUpdateFlex(order) {
  return {
    type: 'flex',
    altText: `📢 อัปเดตสถานะออเดอร์ #${order.orderNo}`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://cdn-icons-png.flaticon.com/512/984/984196.png',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `📢 อัปเดตสถานะ`, weight: 'bold', size: 'lg', color: '#1565c0' },
          { type: 'text', text: `ออเดอร์ #${order.orderNo}`, size: 'sm', color: '#666666' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'สถานะออเดอร์', size: 'sm', color: '#999999', flex: 3 },
              { type: 'text', text: order.orderStatus || '-', size: 'sm', weight: 'bold', flex: 5, color: '#1565c0' }
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'สถานะชำระเงิน', size: 'sm', color: '#999999', flex: 3 },
              { type: 'text', text: order.paymentStatus || '-', size: 'sm', weight: 'bold', flex: 5, color: '#2e7d32' }
            ],
          },
        ],
      },
      ...(WEB_BASE && order._id
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                { type: 'button', style: 'primary', action: { type: 'uri', label: 'ดูรายละเอียด', uri: `${WEB_BASE}/orders/${order._id}` } }
              ]
            }
          }
        : {})
    }
  };
}

function buildShippingStartedFlex(order) {
  const trackingUrl = order.trackingNumber
    ? `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(order.trackingNumber)}`
    : null;

  return {
    type: 'flex',
    altText: `🚚 ออเดอร์ #${order.orderNo} จัดส่งแล้ว`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://cdn-icons-png.flaticon.com/512/679/679720.png',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `🚚 จัดส่งแล้ว`, weight: 'bold', size: 'lg', color: '#0277bd' },
          { type: 'text', text: `ออเดอร์ #${order.orderNo}`, size: 'sm', color: '#666666' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ขนส่ง', size: 'sm', color: '#999999', flex: 3 },
              { type: 'text', text: order.shippingProvider || '-', size: 'sm', weight: 'bold', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'เลขพัสดุ', size: 'sm', color: '#999999', flex: 3 },
              { type: 'text', text: order.trackingNumber || '-', size: 'sm', weight: 'bold', flex: 5 }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(trackingUrl
            ? [{ type: 'button', style: 'primary', action: { type: 'uri', label: 'ติดตามสถานะ', uri: trackingUrl } }]
            : [])
        ]
      }
    }
  };
}

function makeShippingUpdateText(order, lastStatus) {
  return `ออเดอร์ ${order.orderNo}\nเลขพัสดุ: ${order.trackingNumber}\nสถานะล่าสุด: ${lastStatus?.status || '-'}${lastStatus?.location ? ` @${lastStatus.location}` : ''}\nเวลา: ${lastStatus?.timestamp || '-'}`;
}

/* ====================== PUBLIC APIs ====================== */
async function pushToAdmin(textOrFlex) {
  if (!ADMIN_IDS.length) return true;
  const message = typeof textOrFlex === 'string' ? { type: 'text', text: textOrFlex } : textOrFlex;
  return sendToTargets(ADMIN_IDS, message);
}

async function pushToUser(userId, textOrFlex) {
  const message = typeof textOrFlex === 'string' ? { type: 'text', text: textOrFlex } : textOrFlex;
  return pushRaw(userId, message);
}

async function pushOrderCreatedFlexToAdmin(order) {
  if (!ADMIN_IDS.length) return true;
  const flex = buildOrderCreatedFlex(order, { forAdmin: true });
  return sendToTargets(ADMIN_IDS, flex);
}

async function pushOrderCreatedFlexToUser(userId, order) {
  const flex = buildOrderCreatedFlex(order);
  return pushRaw(userId, flex);
}

async function pushSlipResultFlexToUser(userId, order, result) {
  const flex = buildSlipResultFlex(order, result);
  return pushRaw(userId, flex);
}

async function pushSlipResultFlexToAdmin(order, result) {
  if (!ADMIN_IDS.length) return true;

  // ใช้เวอร์ชันสำหรับแอดมินที่มี "รายการสินค้า"
  const flex = buildSlipResultFlexAdmin(order, result);

  // fallback เป็นข้อความธรรมดา พร้อมสรุปรายการ (เผื่อ Flex ล้มเหลว)
  let fallback = `${result.success ? '✅ ชำระเงินสำเร็จ' : '⚠️ สลิปไม่ผ่าน'}\nออเดอร์ ${order.orderNo}\nยอด ${thMoney(order.totalAmount)} บาท`;
  if (result.success && Array.isArray(order.items) && order.items.length) {
    const lines = order.items.slice(0, 5).map(it => {
      const qty = Number(it.quantity || it.qty || 0);
      const price = Number(it.price || 0);
      const sub = thMoney(qty * price);
      return `• ${it.productName || '-'} (${it.size || '-'} / ${it.color || '-'}) x${qty} = ${sub}`;
    });
    fallback += `\nรายการ:\n${lines.join('\n')}${order.items.length > 5 ? `\n...และอีก ${order.items.length - 5} รายการ` : ''}`;
  }

  return sendToTargetsWithFallback(ADMIN_IDS, flex, fallback);
}

async function pushDelivered(order, barcode) {
  if (order?.customerLineId) {
    await pushRaw(order.customerLineId, buildDeliveredFlex(order, barcode));
  }
  if (ADMIN_IDS.length) {
    await sendToTargets(ADMIN_IDS, { type: 'text', text: `✅ นำจ่ายสำเร็จ: ${order.orderNo}\nเลขพัสดุ: ${barcode}` });
  }
  return true;
}

async function pushShippingUpdate(order, lastStatus) {
  if (!order?.customerLineId || !lastStatus) return true;
  const text = makeShippingUpdateText(order, lastStatus);
  return pushRaw(order.customerLineId, { type: 'text', text });
}

async function pushOrderStatusUpdate(order) {
  if (!order?.customerLineId) return true;
  const flex = buildOrderStatusUpdateFlex(order);
  return pushRaw(order.customerLineId, flex);
}

async function pushShippingStarted(order) {
  if (!order?.customerLineId) return true;
  const flex = buildShippingStartedFlex(order);
  return pushRaw(order.customerLineId, flex);
}

module.exports = {
  // send
  pushToAdmin,
  pushToUser,
  pushOrderCreatedFlexToAdmin,
  pushOrderCreatedFlexToUser,
  pushSlipResultFlexToUser,
  pushSlipResultFlexToAdmin,
  // shipping
  pushDelivered,
  pushShippingUpdate,
  pushShippingStarted,
  // builders (ถ้าต้องการเรียกใช้ภายนอก)
  buildDeliveredFlex,
  makeShippingUpdateText,
  buildOrderStatusUpdateFlex,
  buildShippingStartedFlex,
};