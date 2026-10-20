// models/Counter.js
import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';
import { requireTenantId } from '../saas/tenantContext.js';

const counterSchema = new mongoose.Schema({
  _id: {
    type: String, // 'GRN', 'PO', 'SO'
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
}, {
  versionKey: false
});

counterSchema.path('_id').set(function(value) {
  const prefix = `${requireTenantId().toHexString()}:`;
  const key = value && typeof value === 'object' ? value._id : value;
  if (typeof key !== 'string' || !key.length) throw new Error('A counter key is required');
  if (key.startsWith(prefix)) return key;
  if (key.includes(':')) throw new Error('Counter key belongs to another tenant');
  return `${prefix}${key}`;
});

counterSchema.plugin(tenantPlugin);

export default mongoose.model('Counter', counterSchema);
