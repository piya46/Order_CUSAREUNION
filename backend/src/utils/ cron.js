// src/utils/cron.js
const autoUnlockStockService = require('../services/autoUnlockStockService');

exports.startAutoUnlockJob = () => {
  setInterval(async () => {
    await autoUnlockStockService.autoUnlock();
    // อาจ log ผลลัพธ์/แจ้งเตือนเพิ่มเติมได้
  }, 1000 * 60 * 5); // ทุก 5 นาที
};
