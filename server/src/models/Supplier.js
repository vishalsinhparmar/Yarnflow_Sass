import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const supplierSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  city: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blocked'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Add indexes for better performance
supplierSchema.index({ companyName: 1 });
supplierSchema.index({ gstNumber: 1 });
supplierSchema.index({ status: 1 });

// Auto-extract PAN from GST if GST is provided and PAN is not
supplierSchema.pre('save', function(next) {
  if (this.gstNumber && this.gstNumber.length >= 10 && !this.panNumber) {
    this.panNumber = this.gstNumber.substring(2, 12).toUpperCase();
  }
  next();
});

supplierSchema.plugin(tenantPlugin);

export default mongoose.model('Supplier', supplierSchema);
