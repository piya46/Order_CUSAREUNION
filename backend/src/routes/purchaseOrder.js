const router = require('express').Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

const ROLES = ['purchasing', 'admin', 'manager'];

// Purchase Order
router.post('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  purchaseOrderController.create
);

router.get('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  purchaseOrderController.getAll
);

router.get('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  purchaseOrderController.getOne
);

router.put('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  purchaseOrderController.update
);

router.delete('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  purchaseOrderController.delete
);

// Export PO (PDF/Excel)
router.get('/:id/export',
  requireAdmin(ROLES),
  authorize(ROLES),
  purchaseOrderController.exportPO
);

module.exports = router;
