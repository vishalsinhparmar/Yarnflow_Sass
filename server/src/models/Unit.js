import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const unitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Unit name is required'],
    unique: true,
    trim: true
  }
}, {
  timestamps: true
});

// name index is created by unique:true above

unitSchema.plugin(tenantPlugin);

const Unit = mongoose.model('Unit', unitSchema);

export default Unit;
