import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Discontinued'],
    default: 'Active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.virtual('subProducts', {
  ref: 'SubProduct',
  localField: '_id',
  foreignField: 'product'
});

productSchema.plugin(tenantPlugin);

export default mongoose.model('Product', productSchema);
