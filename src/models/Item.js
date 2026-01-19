const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['tea', 'accessories', 'packaging', 'other'],
    default: 'tea'
  },
  hsnCode: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'gram', 'bags', 'pieces', 'litre'],
    default: 'kg'
  },
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0
    },
    purchasePrice: {
      type: Number,
      min: 0
    }
  },
  gst: {
    rate: {
      type: Number,
      required: true,
      enum: [0, 5, 12, 18, 28]
    },
    cgst: {
      type: Number,
      required: true
    },
    sgst: {
      type: Number,
      required: true
    },
    igst: {
      type: Number,
      required: true
    }
  },
  stock: {
    quantity: {
      type: Number,
      default: 0
    },
    weight: {
      type: Number,
      default: 0
    },
    bags: {
      type: Number,
      default: 0
    },
    minStockLevel: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate GST components
itemSchema.pre('save', function(next) {
  if (this.isModified('gst.rate')) {
    this.gst.cgst = this.gst.rate / 2;
    this.gst.sgst = this.gst.rate / 2;
    this.gst.igst = this.gst.rate;
  }
  next();
});

// Index for faster queries
itemSchema.index({ name: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ hsnCode: 1 });

module.exports = mongoose.model('Item', itemSchema);
