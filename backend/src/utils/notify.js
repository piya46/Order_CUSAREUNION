// src/utils/notify.js

exports.orderStatusMessage = (order) => {
  return `สถานะออร์เดอร์ ${order._id}: ${order.orderStatus}\nยอดเงิน: ${order.totalAmount} บาท`;
};

exports.poArrivedMessage = (po) => {
  return `แจ้งเตือน: PO ${po.poNumber} มีกำหนดรับสินค้าในวันที่ ${po.expectedReceiveDate}`;
};
