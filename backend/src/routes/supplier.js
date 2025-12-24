const router = require('express').Router();
const supplierController = require('../controllers/supplierController');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// กำหนด Role ที่มีสิทธิ์จัดการ Supplier (น่าจะกลุ่มเดียวกับที่ดู PO ได้)
const ROLES = ['purchasing', 'admin', 'manager'];

// Get All Suppliers
router.get('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  supplierController.list
);

// Get One Supplier
router.get('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  supplierController.getOne
);

// Create Supplier
router.post('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  supplierController.create
);

// Update Supplier
router.put('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  supplierController.update
);

// Delete Supplier (สงวนสิทธิ์ให้ admin/manager เหมือน PO)
router.delete('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  supplierController.delete
);

module.exports = router;