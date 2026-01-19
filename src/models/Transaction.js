const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['sale', 'purchase', 'payment_received', 'payment_made', 'expense'],
    required: true
  },
  reference: {
    type: String,
    enum: ['invoice', 'direct', 'return'],
    default: 'direct'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Invoice', 'Customer']
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'cheque', 'upi', 'neft', 'rtgs', 'card', 'other'],
    required: true
  },
  paymentDetails: {
    transactionId: String,
    chequeNumber: String,
    bankName: String,
    upiId: String
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['revenue', 'expense', 'asset', 'liability'],
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Index for faster queries and reports
transactionSchema.index({ date: -1 });
transactionSchema.index({ customer: 1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
