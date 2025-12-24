// backend/src/routes/product.js
const router = require('express').Router();
const productController = require('../controllers/productController');
const { uploadProductImages } = require('../middlewares/upload');
const { requireAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const { validateProduct } = require('../middlewares/validate');

router.get('/image/:filename', productController.getImage);

router.get('/inventory',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  productController.getInventory
);

// CRUD
router.post('/',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  validateProduct,
  productController.create
);
router.get('/', productController.getAll);
router.get('/:id', productController.getOne);
router.put('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  validateProduct,
  productController.update
);
router.delete('/:id',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  productController.delete
);

// Upload images
router.post('/:id/images',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  uploadProductImages,
  productController.uploadImages
);

// NEW: delete single image
router.delete('/:id/images/:filename',
  requireAdmin(['admin', 'manager']),
  authorize(['admin', 'manager']),
  productController.deleteImage
);

module.exports = router;