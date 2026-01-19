const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.transactionType) query.transactionType = req.query.transactionType;
    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;
    if (req.query.customer) query.customer = req.query.customer;

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
    }

    const transactions = await Transaction.find(query)
      .populate('customer', 'name gstin')
      .sort({ date: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTransactions: total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('customer');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    // Auto-determine category based on transactionType if not provided
    const transactionData = { ...req.body };
    if (!transactionData.category) {
      const categoryMap = {
        'payment_received': 'revenue',
        'sale': 'revenue',
        'payment_made': 'expense',
        'purchase': 'expense',
        'expense': 'expense'
      };
      transactionData.category = categoryMap[transactionData.transactionType] || 'revenue';
    }

    const transaction = await Transaction.create(transactionData);

    // If transaction is linked to an invoice, add payment record to the invoice
    if (transaction.reference === 'invoice' && transaction.referenceId) {
      const invoice = await Invoice.findById(transaction.referenceId);

      if (invoice) {
        // Create payment record
        const payment = {
          amount: transaction.amount,
          method: transaction.paymentMethod || 'other',
          date: transaction.date,
          reference: transaction.referenceNumber || '',
          notes: transaction.description || '',
          transactionId: transaction._id
        };

        // Add payment to invoice
        invoice.payments.push(payment);

        // Recalculate invoice payment totals
        invoice.amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        invoice.balanceDue = invoice.grandTotal - invoice.amountPaid;

        // Update payment status
        if (invoice.balanceDue <= 0) {
          invoice.paymentStatus = 'paid';
          invoice.balanceDue = 0;
        } else if (invoice.amountPaid > 0) {
          invoice.paymentStatus = 'partial';
        } else {
          invoice.paymentStatus = 'unpaid';
        }

        await invoice.save();
      }
    }

    // Update customer outstanding balance if applicable
    if (transaction.customer) {
      const customer = await Customer.findById(transaction.customer);
      if (customer) {
        if (transaction.transactionType === 'payment_received') {
          customer.outstandingBalance -= transaction.amount;
        } else if (transaction.transactionType === 'payment_made') {
          customer.outstandingBalance += transaction.amount;
        }
        await customer.save();
      }
    }

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('customer');

    res.status(201).json(populatedTransaction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('customer');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // If transaction is linked to an invoice, remove the payment from the invoice
    if (transaction.reference === 'invoice' && transaction.referenceId) {
      const invoice = await Invoice.findById(transaction.referenceId);

      if (invoice) {
        // Find and remove the payment linked to this transaction
        const paymentIndex = invoice.payments.findIndex(
          p => p.transactionId && p.transactionId.toString() === transaction._id.toString()
        );

        if (paymentIndex !== -1) {
          invoice.payments.splice(paymentIndex, 1);

          // Recalculate invoice payment totals
          invoice.amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
          invoice.balanceDue = invoice.grandTotal - invoice.amountPaid;

          // Update payment status
          if (invoice.balanceDue <= 0) {
            invoice.paymentStatus = 'paid';
            invoice.balanceDue = 0;
          } else if (invoice.amountPaid > 0) {
            invoice.paymentStatus = 'partial';
          } else {
            invoice.paymentStatus = 'unpaid';
          }

          await invoice.save();
        }
      }
    }

    // Update customer outstanding balance if applicable
    if (transaction.customer) {
      const customer = await Customer.findById(transaction.customer);
      if (customer) {
        if (transaction.transactionType === 'payment_received') {
          customer.outstandingBalance += transaction.amount;
        } else if (transaction.transactionType === 'payment_made') {
          customer.outstandingBalance -= transaction.amount;
        }
        await customer.save();
      }
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get transaction summary
// @route   GET /api/transactions/summary
// @access  Private
exports.getTransactionSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$transactionType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
