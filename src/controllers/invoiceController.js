const Invoice = require('../models/Invoice');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const { calculateInvoiceTotals } = require('../utils/gstCalculator');
const { numberToWords } = require('../utils/numberToWords');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.invoiceType) query.invoiceType = req.query.invoiceType;
    if (req.query.status) query.status = req.query.status;
    if (req.query.paymentStatus) query.paymentStatus = req.query.paymentStatus;
    if (req.query.customer) query.customer = req.query.customer;

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.invoiceDate = {};
      if (req.query.startDate) query.invoiceDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.invoiceDate.$lte = new Date(req.query.endDate);
    }

    // Search by invoice number
    if (req.query.search) {
      query.invoiceNumber = { $regex: req.query.search, $options: 'i' };
    }

    const invoices = await Invoice.find(query)
      .populate('customer', 'name gstin contact')
      .sort({ invoiceDate: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Invoice.countDocuments(query);

    res.json({
      invoices,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalInvoices: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('items.item');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create invoice
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res) => {
  try {
    const { customer, items, invoiceType, discount = 0, isInterState = false } = req.body;

    // Validate customer
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Process items and calculate totals
    const processedItems = [];
    for (const item of items) {
      const itemDoc = await Item.findById(item.item);
      if (!itemDoc) {
        return res.status(404).json({ message: `Item ${item.item} not found` });
      }

      const amount = item.quantity * item.rate;
      const gstAmount = (amount * itemDoc.gst.rate) / 100;

      const processedItem = {
        item: item.item,
        itemName: itemDoc.name,
        hsnCode: itemDoc.hsnCode,
        quantity: item.quantity,
        weight: item.weight || 0,
        bags: item.bags || 0,
        unit: itemDoc.unit,
        rate: item.rate,
        amount: amount,
        gst: {
          rate: itemDoc.gst.rate,
          cgst: isInterState ? 0 : itemDoc.gst.rate / 2,
          sgst: isInterState ? 0 : itemDoc.gst.rate / 2,
          igst: isInterState ? itemDoc.gst.rate : 0,
          cgstAmount: isInterState ? 0 : gstAmount / 2,
          sgstAmount: isInterState ? 0 : gstAmount / 2,
          igstAmount: isInterState ? gstAmount : 0,
          totalGstAmount: gstAmount
        },
        total: amount + gstAmount
      };

      processedItems.push(processedItem);

      // Update stock for sales
      if (invoiceType === 'sale') {
        itemDoc.stock.quantity -= item.quantity;
        itemDoc.stock.weight -= item.weight || 0;
        itemDoc.stock.bags -= item.bags || 0;
        await itemDoc.save();
      }
    }

    // Calculate invoice totals
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    processedItems.forEach(item => {
      subtotal += item.amount;
      totalCgst += item.gst.cgstAmount;
      totalSgst += item.gst.sgstAmount;
      totalIgst += item.gst.igstAmount;
    });

    const totalGst = totalCgst + totalSgst + totalIgst;
    const grandTotal = subtotal + totalGst - discount;
    const roundOff = Math.round(grandTotal) - grandTotal;
    const finalTotal = Math.round(grandTotal);

    // Create invoice
    const invoice = await Invoice.create({
      ...req.body,
      items: processedItems,
      subtotal,
      totalGst: {
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        total: totalGst
      },
      discount,
      roundOff,
      grandTotal: finalTotal,
      amountInWords: numberToWords(finalTotal)
    });

    // Update customer outstanding balance
    if (req.body.paymentStatus === 'unpaid' || req.body.paymentStatus === 'partial') {
      customerDoc.outstandingBalance += finalTotal;
      await customerDoc.save();
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('items.item');

    res.status(201).json(populatedInvoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('customer')
    .populate('items.item');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update invoice payment status
// @route   PATCH /api/invoices/:id/payment
// @access  Private
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, paymentMethod } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const oldStatus = invoice.paymentStatus;
    invoice.paymentStatus = paymentStatus;
    invoice.paymentMethod = paymentMethod;

    // Update customer outstanding balance
    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      if (oldStatus === 'unpaid' && paymentStatus === 'paid') {
        customer.outstandingBalance -= invoice.grandTotal;
      } else if (oldStatus === 'paid' && paymentStatus === 'unpaid') {
        customer.outstandingBalance += invoice.grandTotal;
      }
      await customer.save();
    }

    await invoice.save();
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
