import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const warehouseLocationSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  code:    { type: String, required: true, trim: true, uppercase: true },
  type:    { type: String, enum: ['Shop', 'Godown', 'Factory', 'Others'], default: 'Godown' },
  address: { type: String, trim: true, default: '' },
  isActive:{ type: Boolean, default: true }
}, { timestamps: true });

warehouseLocationSchema.index({ code: 1 }, { unique: true });

warehouseLocationSchema.plugin(tenantPlugin);

export default mongoose.model('WarehouseLocation', warehouseLocationSchema);
