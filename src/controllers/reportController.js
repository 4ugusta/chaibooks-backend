const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const Customer = require('../models/Customer');

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, customer } = req.query;

    const matchQuery = { user: req.user._id, invoiceType: 'sale', status: { $ne: 'cancelled' } };

    if (startDate || endDate) {
      matchQuery.invoiceDate = {};
      if (startDate) matchQuery.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchQuery.invoiceDate.$lte = new Date(endDate);
    }

    if (customer) matchQuery.customer = customer;

    // Get individual invoices with customer details
    const salesInvoices = await Invoice.find(matchQuery)
      .populate('customer', 'name gstin')
      .select('invoiceNumber invoiceDate customer grandTotal subtotal totalGst paymentStatus')
      .sort({ invoiceDate: -1 });

    // Calculate totals
    const totalSales = salesInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalGST = salesInvoices.reduce((sum, inv) => sum + (inv.totalGst?.total || 0), 0);

    res.json({
      sales: salesInvoices,
      totalSales,
      totalInvoices: salesInvoices.length,
      totalGST
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get purchase report
// @route   GET /api/reports/purchases
// @access  Private
exports.getPurchaseReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const matchQuery = { user: req.user._id, invoiceType: 'purchase', status: { $ne: 'cancelled' } };

    if (startDate || endDate) {
      matchQuery.invoiceDate = {};
      if (startDate) matchQuery.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchQuery.invoiceDate.$lte = new Date(endDate);
    }

    let groupByFormat;
    switch (groupBy) {
      case 'month':
        groupByFormat = { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } };
        break;
      case 'year':
        groupByFormat = { $dateToString: { format: '%Y', date: '$invoiceDate' } };
        break;
      default:
        groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } };
    }

    const purchaseData = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupByFormat,
          totalPurchases: { $sum: '$grandTotal' },
          totalInvoices: { $sum: 1 },
          totalGST: { $sum: '$totalGst.total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totals = purchaseData.reduce((acc, item) => ({
      totalPurchases: acc.totalPurchases + item.totalPurchases,
      totalInvoices: acc.totalInvoices + item.totalInvoices,
      totalGST: acc.totalGST + item.totalGST
    }), { totalPurchases: 0, totalInvoices: 0, totalGST: 0 });

    res.json({
      data: purchaseData,
      summary: totals
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get GST report (ITR ready)
// @route   GET /api/reports/gst
// @access  Private
exports.getGSTReport = async (req, res) => {
  try {
    const { startDate, endDate, type = 'both' } = req.query;

    const matchQuery = { user: req.user._id, status: { $ne: 'cancelled' } };

    if (startDate || endDate) {
      matchQuery.invoiceDate = {};
      if (startDate) matchQuery.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchQuery.invoiceDate.$lte = new Date(endDate);
    }

    if (type !== 'both') {
      matchQuery.invoiceType = type;
    }

    const gstData = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$invoiceType',
          totalCGST: { $sum: '$totalGst.cgst' },
          totalSGST: { $sum: '$totalGst.sgst' },
          totalIGST: { $sum: '$totalGst.igst' },
          totalGST: { $sum: '$totalGst.total' },
          totalTaxableValue: { $sum: '$subtotal' },
          totalInvoiceValue: { $sum: '$grandTotal' },
          invoiceCount: { $sum: 1 }
        }
      }
    ]);

    // Group by GST rate
    const gstByRate = await Invoice.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            invoiceType: '$invoiceType',
            gstRate: '$items.gst.rate'
          },
          taxableValue: { $sum: '$items.amount' },
          cgst: { $sum: '$items.gst.cgstAmount' },
          sgst: { $sum: '$items.gst.sgstAmount' },
          igst: { $sum: '$items.gst.igstAmount' },
          totalGst: { $sum: '$items.gst.totalGstAmount' },
          totalValue: { $sum: '$items.total' }
        }
      },
      { $sort: { '_id.invoiceType': 1, '_id.gstRate': 1 } }
    ]);

    res.json({
      summary: gstData,
      detailedByRate: gstByRate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get profit/loss report
// @route   GET /api/reports/profit-loss
// @access  Private
exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = { user: req.user._id, status: { $ne: 'cancelled' } };

    if (startDate || endDate) {
      matchQuery.invoiceDate = {};
      if (startDate) matchQuery.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchQuery.invoiceDate.$lte = new Date(endDate);
    }

    // Sales revenue
    const salesRevenue = await Invoice.aggregate([
      { $match: { ...matchQuery, invoiceType: 'sale' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalGST: { $sum: '$totalGst.total' }
        }
      }
    ]);

    // Purchase costs
    const purchaseCosts = await Invoice.aggregate([
      { $match: { ...matchQuery, invoiceType: 'purchase' } },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$grandTotal' },
          totalGST: { $sum: '$totalGst.total' }
        }
      }
    ]);

    // Expenses
    const expenseQuery = { user: req.user._id, category: 'expense' };
    if (startDate || endDate) {
      expenseQuery.date = {};
      if (startDate) expenseQuery.date.$gte = new Date(startDate);
      if (endDate) expenseQuery.date.$lte = new Date(endDate);
    }

    const expenses = await Transaction.aggregate([
      { $match: expenseQuery },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' }
        }
      }
    ]);

    const revenue = salesRevenue[0]?.totalRevenue || 0;
    const cost = purchaseCosts[0]?.totalCost || 0;
    const expense = expenses[0]?.totalExpenses || 0;
    const grossProfit = revenue - cost;
    const netProfit = grossProfit - expense;
    const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0;

    res.json({
      revenue,
      cost,
      expenses: expense,
      grossProfit,
      netProfit,
      profitMargin: parseFloat(profitMargin),
      gstCollected: salesRevenue[0]?.totalGST || 0,
      gstPaid: purchaseCosts[0]?.totalGST || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get stock report
// @route   GET /api/reports/stock
// @access  Private
exports.getStockReport = async (req, res) => {
  try {
    const { category, lowStock } = req.query;

    const query = { user: req.user._id, status: 'active' };
    if (category) query.category = category;

    const items = await Item.find(query).select('name category stock pricing');

    let filteredItems = items;

    if (lowStock === 'true') {
      filteredItems = items.filter(item => item.stock.quantity <= item.stock.minStockLevel);
    }

    const totalStockValue = filteredItems.reduce((acc, item) => {
      return acc + (item.stock.quantity * item.pricing.purchasePrice || 0);
    }, 0);

    res.json({
      items: filteredItems,
      summary: {
        totalItems: filteredItems.length,
        totalStockValue,
        lowStockItems: items.filter(item => item.stock.quantity <= item.stock.minStockLevel).length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get customer report
// @route   GET /api/reports/customers
// @access  Private
exports.getCustomerReport = async (req, res) => {
  try {
    const customers = await Customer.find({ user: req.user._id, status: 'active' })
      .select('name gstin outstandingBalance');

    const totalOutstanding = customers.reduce((acc, customer) => {
      return acc + customer.outstandingBalance;
    }, 0);

    // Top customers by sales
    const topCustomers = await Invoice.aggregate([
      { $match: { user: req.user._id, invoiceType: 'sale', status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$customer',
          totalSales: { $sum: '$grandTotal' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customerInfo'
        }
      },
      { $unwind: '$customerInfo' }
    ]);

    res.json({
      totalCustomers: customers.length,
      totalOutstanding,
      topCustomers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
