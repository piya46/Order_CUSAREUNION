const router = require('express').Router();
const issueController = require('../controllers/issueController');
// const { uploadMulti } = require('../middlewares/upload');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

const ROLES = ['admin', 'manager', 'account', 'shipping', 'purchasing'];

// Issue/Problem Report
router.post('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  issueController.create
);

router.get('/',
  requireAdmin(ROLES),
  authorize(ROLES),
  issueController.getAll
);

router.get('/:id',
  requireAdmin(ROLES),
  authorize(ROLES),
  issueController.getOne
);

router.put('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  issueController.update
);

router.delete('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  issueController.delete
);

// Upload evidence images (ตัวอย่าง ถ้าจะเปิดภายหลัง)
// router.post('/:id/evidence',
//   requireAdmin(ROLES), authorize(ROLES), uploadMulti, issueController.uploadEvidence);

module.exports = router;
