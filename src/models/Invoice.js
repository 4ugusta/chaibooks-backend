const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  itemName: String,
  hsnCode: String,
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  weight: {
    type: Number,
    default: 0
  },
  bags: {
    type: Number,
    default: 0
  },
  unit: String,
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true
  },
  gst: {
    rate: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    cgstAmount: Number,
    sgstAmount: Number,
    igstAmount: Number,
    totalGstAmount: Number
  },
  total: {
    type: Number,
    required: true
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  invoiceType: {
    type: String,
    enum: ['sale', 'purchase'],
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  totalGst: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  discount: {
    type: Number,
    default: 0
  },
  roundOff: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },
  amountInWords: {
    type: String
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid', 'partial', 'overdue'],
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'cheque', 'upi', 'neft', 'rtgs', 'card'],
  },
  notes: {
    type: String
  },
  termsAndConditions: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft'
  },
  eWayBill: {
    number: String,
    date: Date,
    validUpto: Date,
    qrCode: String
  }
}, {
  timestamps: true
});

// Auto-increment invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const prefix = this.invoiceType === 'sale' ? 'INV' : 'PUR';
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await this.constructor.countDocuments({ invoiceType: this.invoiceType });
    this.invoiceNumber = `${prefix}${year}${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Index for faster queries
// Note: invoiceNumber already has a unique index from the schema definition
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ invoiceType: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
