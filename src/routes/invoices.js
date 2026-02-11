const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updatePaymentStatus,
  deletePayment
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');
const { generateInvoicePDF, generateEWayBillPDF } = require('../utils/pdfGenerator');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

router.use(protect);

router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

router.patch('/:id/payment', updatePaymentStatus);
router.delete('/:id/payment/:paymentId', deletePayment);

// PDF Generation
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer')
      .populate('items.item');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const user = await User.findById(req.user._id);
    await generateInvoicePDF(invoice, user.businessDetails || {}, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// E-Way Bill PDF
router.get('/:id/eway-bill', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer')
      .populate('items.item');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (!invoice.eWayBill || !invoice.eWayBill.number) {
      return res.status(400).json({ message: 'E-Way Bill not generated for this invoice' });
    }

    const user = await User.findById(req.user._id);
    await generateEWayBillPDF(invoice, user.businessDetails || {}, invoice.eWayBill, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
