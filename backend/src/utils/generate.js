// src/utils/generate.js

// === ฟังก์ชันแปลงวันที่ให้อยู่ในรูป YYYYMMDD ===
const getDateString = () => {
  const date = new Date();
  return date.toISOString().slice(0,10).replace(/-/g,'');
};

// === เจนหมายเลขออร์เดอร์ ===
// ORD-YYYYMMDD-xxxx
exports.generateOrderNumber = () => {
  const dateStr = getDateString();
  const random = Math.floor(1000 + Math.random() * 9000); // 4 หลัก
  return `ORD-${dateStr}-${random}`;
};

// === เจนรหัสสินค้า ===
// PRD-YYYYMMDD-xxxx
exports.generateProductCode = () => {
  const dateStr = getDateString();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PRD-${dateStr}-${random}`;
};

// === เจนหมายเลข PO ===
// PO-YYYYMMDD-xxxx
exports.generatePONumber = () => {
  const dateStr = getDateString();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PO-${dateStr}-${random}`;
};

// === เจนหมายเลข Receiving ===
// RC-YYYYMMDD-xxxx
exports.generateReceivingNumber = () => {
  const dateStr = getDateString();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `RC-${dateStr}-${random}`;
};

// === เจนหมายเลข Issue/Problem ===
// ISS-YYYYMMDD-xxxx
exports.generateIssueNumber = () => {
  const dateStr = getDateString();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ISS-${dateStr}-${random}`;
};

// === (Optional) เจนหมายเลข role แบบ unique code ===
exports.generateRoleCode = () => {
  const dateStr = getDateString();
  const random = Math.floor(100 + Math.random() * 900);
  return `ROLE-${dateStr}-${random}`;
};

// === (Optional) auto-increment สามารถ implement เพิ่มได้ ถ้าต้องการเลขรันต่อเนื่อง ===
// แต่สำหรับระบบ scale เดียวกับ MongoDB/NoSQL แนะนำใช้แบบ random + date นี้ดีที่สุด
