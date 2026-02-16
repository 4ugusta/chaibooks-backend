const Invoice = require('../models/Invoice');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { calculateInvoiceTotals } = require('../utils/gstCalculator');
const { numberToWords } = require('../utils/numberToWords');
const { getErrorMessage } = require('../middleware/errorHandler');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

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
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer')
      .populate('items.item');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// @desc    Create invoice
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res) => {
  try {
    const { customer, items, invoiceType, discount = 0, isInterState = false } = req.body;

    // Validate customer belongs to this user
    const customerDoc = await Customer.findOne({ _id: customer, user: req.user._id });
    if (!customerDoc) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Process items and calculate totals
    const processedItems = [];
    for (const item of items) {
      const itemDoc = await Item.findOne({ _id: item.item, user: req.user._id });
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
      user: req.user._id,
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

    // Update customer outstanding balance (only for unpaid invoices)
    if (invoiceType === 'sale') {
      customerDoc.outstandingBalance += finalTotal;
      await customerDoc.save();
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('items.item');

    res.status(201).json(populatedInvoice);
  } catch (error) {
    res.status(400).json({ message: getErrorMessage(error) });
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
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
    res.status(400).json({ message: getErrorMessage(error) });
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Restore stock for sale invoices
    if (invoice.invoiceType === 'sale') {
      for (const item of invoice.items) {
        if (item.item) {
          await Item.findByIdAndUpdate(item.item, {
            $inc: {
              'stock.quantity': item.quantity,
              'stock.bags': item.bags || 0
            }
          });
        }
      }
    }

    // Reverse customer outstanding balance for sale invoices
    if (invoice.invoiceType === 'sale') {
      const customer = await Customer.findById(invoice.customer);
      if (customer) {
        // Remove the unpaid portion (grandTotal - amountPaid) from outstanding
        customer.outstandingBalance -= invoice.balanceDue || (invoice.grandTotal - (invoice.amountPaid || 0));
        await customer.save();
      }
    }

    // Delete linked payment transactions
    if (invoice.payments && invoice.payments.length > 0) {
      const transactionIds = invoice.payments
        .filter(p => p.transactionId)
        .map(p => p.transactionId);
      if (transactionIds.length > 0) {
        await Transaction.deleteMany({ _id: { $in: transactionIds } });
      }
    }

    await invoice.deleteOne();

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: getErrorMessage(error) });
  }
};

// @desc    Update invoice payment status (record payment)
// @route   PATCH /api/invoices/:id/payment
// @access  Private
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { amount, method, date, reference, notes } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Validate payment amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than 0' });
    }

    const currentBalance = invoice.balanceDue || invoice.grandTotal - (invoice.amountPaid || 0);

    if (amount > currentBalance) {
      return res.status(400).json({
        message: `Payment amount (₹${amount}) cannot exceed balance due (₹${currentBalance})`
      });
    }

    // Add payment record
    const payment = {
      amount: parseFloat(amount),
      method: method || 'cash',
      date: date ? new Date(date) : new Date(),
      reference: reference || '',
      notes: notes || ''
    };

    if (!invoice.payments) {
      invoice.payments = [];
    }

    // Create linked transaction record
    const transaction = await Transaction.create({
      user: req.user._id,
      transactionType: invoice.invoiceType === 'sale' ? 'payment_received' : 'payment_made',
      reference: 'invoice',
      referenceId: invoice._id,
      referenceModel: 'Invoice',
      customer: invoice.customer,
      date: payment.date,
      amount: payment.amount,
      paymentMethod: payment.method,
      description: `Payment for invoice ${invoice.invoiceNumber}${payment.notes ? ': ' + payment.notes : ''}`,
      category: invoice.invoiceType === 'sale' ? 'revenue' : 'expense',
      status: 'completed'
    });

    // Link transaction to payment
    payment.transactionId = transaction._id;
    invoice.payments.push(payment);

    // Calculate total amount paid
    const oldAmountPaid = invoice.amountPaid || 0;
    const newAmountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    invoice.amountPaid = newAmountPaid;

    // Calculate balance due
    invoice.balanceDue = invoice.grandTotal - newAmountPaid;

    // Automatically update payment status based on amounts
    const oldStatus = invoice.paymentStatus;
    if (invoice.balanceDue <= 0) {
      invoice.paymentStatus = 'paid';
      invoice.balanceDue = 0; // Ensure no negative balance
    } else if (invoice.amountPaid > 0) {
      invoice.paymentStatus = 'partial';
    } else {
      invoice.paymentStatus = 'unpaid';
    }

    // Update customer outstanding balance
    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      // Subtract the payment amount from outstanding balance
      customer.outstandingBalance -= payment.amount;
      await customer.save();
    }

    await invoice.save();

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('items.item');

    res.json(populatedInvoice);
  } catch (error) {
    res.status(400).json({ message: getErrorMessage(error) });
  }
};

// @desc    Delete a payment from invoice
// @route   DELETE /api/invoices/:id/payment/:paymentId
// @access  Private
exports.deletePayment = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (!invoice.payments || invoice.payments.length === 0) {
      return res.status(400).json({ message: 'No payments found for this invoice' });
    }

    // Find payment by ID
    const paymentIndex = invoice.payments.findIndex(
      p => p._id.toString() === req.params.paymentId
    );

    if (paymentIndex === -1) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const payment = invoice.payments[paymentIndex];

    // Delete linked transaction if exists
    if (payment.transactionId) {
      await Transaction.findByIdAndDelete(payment.transactionId);
    }

    // Update customer outstanding balance (add back the payment amount)
    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      customer.outstandingBalance += payment.amount;
      await customer.save();
    }

    // Remove payment from array
    invoice.payments.splice(paymentIndex, 1);

    // Recalculate totals
    const newAmountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    invoice.amountPaid = newAmountPaid;
    invoice.balanceDue = invoice.grandTotal - newAmountPaid;

    // Recalculate payment status
    if (invoice.balanceDue <= 0) {
      invoice.paymentStatus = 'paid';
      invoice.balanceDue = 0;
    } else if (invoice.amountPaid > 0) {
      invoice.paymentStatus = 'partial';
    } else {
      invoice.paymentStatus = 'unpaid';
    }

    await invoice.save();

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('items.item');

    res.json(populatedInvoice);
  } catch (error) {
    res.status(400).json({ message: getErrorMessage(error) });
  }
};
