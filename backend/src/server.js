// server.js
const dns = require('dns');              // ⬅️ เพิ่ม 2 บรรทัดนี้ด้านบนสุด
dns.setDefaultResultOrder?.('ipv4first');
const config = require('./config');     // ใช้ src/config/index.js เดิม
const connectDb = require('./config/db');
const app = require('./app');

connectDb().then(() => {
  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.env})`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
});
