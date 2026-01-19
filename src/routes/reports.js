const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  getPurchaseReport,
  getGSTReport,
  getProfitLossReport,
  getStockReport,
  getCustomerReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/sales', getSalesReport);
router.get('/purchases', getPurchaseReport);
router.get('/gst', getGSTReport);
router.get('/profit-loss', getProfitLossReport);
router.get('/stock', getStockReport);
router.get('/customers', getCustomerReport);

module.exports = router;
