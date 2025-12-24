const router = require('express').Router();
const roleController = require('../controllers/roleController');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Role Management (Admin only)
router.post('/',
  requireAdmin(['admin']),
  authorize(['admin']),
  roleController.create
);

router.get('/',
  requireAdmin(['admin']),
  authorize(['admin']),
  roleController.getAll
);

router.put('/:id',
  requireAdmin(['admin']),
  authorize(['admin']),
  roleController.update
);

// ⬇️ เปลี่ยนจาก roleController.delete -> roleController.remove
router.delete('/:id',
  requireAdmin(['admin']),
  authorize(['admin']),
  roleController.remove
);

module.exports = router;
