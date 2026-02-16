const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  getPurchaseReport,
  getGSTReport,
  getProfitLossReport,
  getStockReport,
  getCustomerReport,
  getSalesReportPDF,
  getPurchaseReportPDF,
  getStockReportPDF,
  getGSTReportPDF
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/sales', getSalesReport);
router.get('/sales/pdf', getSalesReportPDF);
router.get('/purchases', getPurchaseReport);
router.get('/purchases/pdf', getPurchaseReportPDF);
router.get('/gst', getGSTReport);
router.get('/gst/pdf', getGSTReportPDF);
router.get('/profit-loss', getProfitLossReport);
router.get('/stock', getStockReport);
router.get('/stock/pdf', getStockReportPDF);
router.get('/customers', getCustomerReport);

module.exports = router;
