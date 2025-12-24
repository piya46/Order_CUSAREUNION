const router = require('express').Router();
const receivingController = require('../controllers/receivingController');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

const ROLES = ['purchasing', 'admin', 'manager'];

// Receiving
router.post('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  receivingController.create
);

router.get('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  receivingController.getAll
);

router.get('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  receivingController.getOne
);

router.put('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  receivingController.update
);

router.delete('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  receivingController.delete
);

// Export Receiving (PDF/Excel)
router.get('/:id/export',
  requireAdmin(ROLES),
  authorize(ROLES),
  receivingController.exportReceiving
);

module.exports = router;
