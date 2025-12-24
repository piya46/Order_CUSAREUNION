// src/utils/time.js

exports.minutesBetween = (date1, date2) => {
  return Math.floor((date2 - date1) / 60000);
};

exports.isExpired = (date, minute) => {
  // คืน true ถ้า date เกินเวลานาทีที่กำหนด
  return Date.now() - new Date(date).getTime() > minute * 60 * 1000;
};
