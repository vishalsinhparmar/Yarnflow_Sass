import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const subProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

subProductSchema.index({ product: 1, name: 1 }, { unique: true });

// Auto-flag category.hasSubProducts = true when a sub-product is created
subProductSchema.post('save', async function () {
  try {
    const Product = mongoose.model('Product');
    const Category = mongoose.model('Category');
    const product = await Product.findById(this.product).lean();
    if (product?.category) {
      await Category.findByIdAndUpdate(product.category, { hasSubProducts: true });
    }
  } catch (err) {
    // Non-critical — just log
    console.error('SubProduct post-save hook error:', err.message);
  }
});

subProductSchema.plugin(tenantPlugin);

export default mongoose.model('SubProduct', subProductSchema);
