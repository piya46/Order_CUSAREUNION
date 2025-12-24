const express = require('express');
const router = express.Router();

const trackingController = require('../controllers/trackingController');
const thaiPostWebhookController = require('../controllers/thaiPostWebhookController');

// ดึงสถานะเอง (หน้า OrderDetail/หน้า Track เรียก)
router.get('/:trackingNo', trackingController.getByTrackingNo);

// รับ Webhook จาก Thailand Post
// ตัวอย่าง: POST /api/tracking/webhook/thai-post?s=YOUR_SECRET
router.post('/webhook/thai-post', express.json({ limit: '1mb' }), thaiPostWebhookController.receive);

module.exports = router;