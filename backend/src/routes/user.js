// backend/src/routes/user.js
const router = require('express').Router();
const userCtrl = require('../controllers/userController');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Public: Admin login -> ออก Admin JWT (มี aud/iss/sub/roles ครบ)
router.post('/login', userCtrl.login);

// Admin logout (ล้าง session ปัจจุบันจาก JWT)
router.post('/logout',
  requireAdmin(['admin','manager','account','shipping']),
  authorize(['admin','manager','account','shipping']),
  userCtrl.logout
);

// ===== Admin-only (JWT) =====
router.get('/',
  requireAdmin(['admin']),
  authorize(['admin']),
  userCtrl.getAll
);

router.post('/',
  requireAdmin(['admin']),
  authorize(['admin']),
  userCtrl.create     // alias ของ register
);

router.put('/:id',
  requireAdmin(['admin']),
  authorize(['admin']),
  userCtrl.update
);

router.delete('/:id',
  requireAdmin(['admin']),
  authorize(['admin']),
  userCtrl.remove
);

router.get('/me',
  requireAdmin(['admin','manager','account','shipping']),
  authorize(['admin','manager','account','shipping']),
  userCtrl.me
);


module.exports = router;
