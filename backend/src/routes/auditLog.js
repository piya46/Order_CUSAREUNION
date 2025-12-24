const router = require('express').Router();
const auditLogController = require('../controllers/auditLogController');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Audit Logs (Admin/Manager เท่านั้น)
router.get('/',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  auditLogController.getAll
);

router.get('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  auditLogController.getOne
);

module.exports = router;
