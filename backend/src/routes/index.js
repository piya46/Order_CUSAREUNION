const express = require('express');
const router = express.Router();

router.use('/users', require('./user'));
router.use('/roles', require('./role'));
router.use('/products', require('./product'));
router.use('/orders', require('./order'));
router.use('/purchase-orders', require('./purchaseOrder'));
router.use('/receivings', require('./receiving'));
router.use('/issues', require('./issue'));
router.use('/audit-logs', require('./auditLog'));
router.use('/tracking', require('./trackingRoutes'));

module.exports = router;
