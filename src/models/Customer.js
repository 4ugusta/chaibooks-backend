const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: String,
  country: {
    type: String,
    default: 'India'
  }
}, { _id: false });

const customerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  gstin: {
    type: String,
    uppercase: true,
    trim: true,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format']
  },
  pan: {
    type: String,
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format']
  },
  contact: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    }
  },
  address: addressSchema,
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  creditLimit: {
    type: Number,
    default: 0
  },
  outstandingBalance: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Convert empty strings to undefined so partial unique indexes ignore them
customerSchema.pre('validate', function(next) {
  if (typeof this.gstin === 'string' && this.gstin.trim() === '') this.gstin = undefined;
  if (typeof this.pan === 'string' && this.pan.trim() === '') this.pan = undefined;

  if (!this.gstin && !this.pan) {
    return next(new Error('Either GSTIN or PAN is required'));
  }
  next();
});

// Also handle findOneAndUpdate (used by updateCustomer)
customerSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (typeof update.gstin === 'string' && update.gstin.trim() === '') {
    update.gstin = undefined;
    this.update({}, { $unset: { gstin: 1 } });
  }
  if (typeof update.pan === 'string' && update.pan.trim() === '') {
    update.pan = undefined;
    this.update({}, { $unset: { pan: 1 } });
  }
  next();
});

// Index for faster queries
customerSchema.index({ user: 1, gstin: 1 }, { unique: true, partialFilterExpression: { gstin: { $type: 'string' } } });
customerSchema.index({ user: 1, pan: 1 }, { unique: true, partialFilterExpression: { pan: { $type: 'string' } } });
customerSchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('Customer', customerSchema);
