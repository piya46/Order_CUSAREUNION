// // const router = require('express').Router();
// // const ctrl = require('../controllers/orderController');
// // const { requireLiffUser, requireAdmin, requireAdminOrLiff } = require('../middlewares/auth');
// // const authorize = require('../middlewares/authorize');
// // const { uploadSlip } = require('../middlewares/upload');

// // // ===== ลูกค้า (ต้องมี LIFF ID token) =====
// // router.get('/user', requireLiffUser, ctrl.getMyOrders);               // ใช้ req.user.lineId จาก token
// // router.get('/:id', requireAdminOrLiff, ctrl.getById);                  // ลูกค้าเปิดดูเฉพาะของตัวเอง
// // router.post('/:id/slip', requireAdminOrLiff, uploadSlip, ctrl.uploadSlip);
// // router.post('/:id/slip/retry', requireAdminOrLiff, uploadSlip, ctrl.retrySlip);
// // router.get('/:id/slip-url', requireAdminOrLiff, ctrl.getSlipFile);

// // // ===== แอดมิน =====
// // const ADMIN_ROLES = ['admin','manager','account','shipping'];
// // router.get('/', requireAdmin(ADMIN_ROLES), authorize(ADMIN_ROLES), ctrl.getAll);
// // router.put('/:id', requireAdmin(ADMIN_ROLES), authorize(ADMIN_ROLES), ctrl.update);
// // router.delete('/:id', requireAdmin(['admin','manager']), authorize(['admin','manager']), ctrl.delete);

// // module.exports = router;

// // backend/src/routes/order.js
// const router = require('express').Router();

// const orderCtrl = require('../controllers/orderController');
// const { requireAdmin, requireLiffUser, requireAdminOrLiff } = require('../middlewares/auth');
// const authorize = require('../middlewares/authorize');
// const { uploadSlip } = require('../middlewares/upload');
// const { validateOrder } = require('../middlewares/validate');

// const STAFF = ['admin', 'manager', 'account', 'shipping'];

// // // ---- quick self-check (ถ้ารันแล้วยังล้ม ให้เปิดบรรทัด console นี้ชั่วคราว) ----
// // console.log('[order routes] keys:', Object.keys(orderCtrl));
// // console.log({
// //   requireAdmin: typeof requireAdmin,
// //   requireLiffUser: typeof requireLiffUser,
// //   requireAdminOrLiff: typeof requireAdminOrLiff,
// //   authorize: typeof authorize,
// //   uploadSlip: typeof uploadSlip,
// // });

// // ===== ลูกค้า (ผ่าน LIFF) =====
// router.get('/user', requireLiffUser, orderCtrl.getMyOrders);             // GET /api/orders/user?lineId=...
// router.post('/', requireLiffUser, validateOrder, orderCtrl.create);       // POST /api/orders

// // ===== สลิป (ลูกค้าหรือ staff) =====
// router.get('/:id/slip-file', requireAdminOrLiff, orderCtrl.getSlipFile);  // GET /api/orders/:id/slip-file
// router.post('/:id/slip', requireAdminOrLiff, uploadSlip, orderCtrl.uploadSlip);
// router.post('/:id/slip/retry', requireAdminOrLiff, uploadSlip, orderCtrl.retrySlip);

// // ===== แอดมิน/สตาฟ =====
// router.get('/', requireAdmin(STAFF), authorize(STAFF), orderCtrl.getAll);
// router.get('/export/excel', requireAdmin(STAFF), authorize(STAFF), orderCtrl.exportExcel);
// router.get('/:id', requireAdminOrLiff, orderCtrl.getById);
// router.put('/:id', requireAdmin(STAFF), authorize(STAFF), orderCtrl.update);
// router.delete('/:id', requireAdmin(['admin','managหer']), authorize(['admin','manager']), orderCtrl.delete);
// router.post(
//   '/:id/slip/verify',
//   requireAdmin(['admin','account','manager']),
//   authorize(['admin','account','manager']),
//   orderCtrl.verifySlip
// );

// router.post(
//   '/:id/push',
//   requireAdmin(STAFF),
//   authorize(STAFF),
//   orderCtrl.pushMessageToCustomer
// );



// module.exports = router;


// backend/src/routes/order.js
const router = require('express').Router();

const orderCtrl = require('../controllers/orderController');
const { requireAdmin, requireLiffUser, requireAdminOrLiff } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const { uploadSlip } = require('../middlewares/upload');
const { validateOrder } = require('../middlewares/validate');

const STAFF = ['admin', 'manager', 'account', 'shipping'];

// ===== ลูกค้า (ผ่าน LIFF) =====
router.get('/user', requireLiffUser, orderCtrl.getMyOrders);             // GET /api/orders/user?lineId=...
router.post('/', requireLiffUser, validateOrder, orderCtrl.create);       // POST /api/orders

// ===== สลิป (ลูกค้าหรือ staff) =====
router.get('/:id/slip-file', requireAdminOrLiff, orderCtrl.getSlipFile);  // GET /api/orders/:id/slip-file
router.post('/:id/slip', requireAdminOrLiff, uploadSlip, orderCtrl.uploadSlip);
router.post('/:id/slip/retry', requireAdminOrLiff, uploadSlip, orderCtrl.retrySlip);

// ===== แอดมิน/สตาฟ =====
router.get('/', requireAdmin(STAFF), authorize(STAFF), orderCtrl.getAll);

// ✅ ถูกต้อง: วาง route export ไว้ก่อน /:id เสมอ
router.get('/export/excel', requireAdmin(STAFF), authorize(STAFF), orderCtrl.exportExcel);

router.get('/:id', requireAdminOrLiff, orderCtrl.getById);
router.put('/:id', requireAdmin(STAFF), authorize(STAFF), orderCtrl.update);

// ✅ แก้ไข: ลบ 'ห' ออกจาก manager แล้ว
router.delete('/:id', requireAdmin(['admin','manager']), authorize(['admin','manager']), orderCtrl.delete);

router.post(
  '/:id/slip/verify',
  requireAdmin(['admin','account','manager']),
  authorize(['admin','account','manager']),
  orderCtrl.verifySlip
);

router.post(
  '/:id/push',
  requireAdmin(STAFF),
  authorize(STAFF),
  orderCtrl.pushMessageToCustomer
);

module.exports = router;