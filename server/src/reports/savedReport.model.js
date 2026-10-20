import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const savedReportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  reportKey: {
    type: String,
    required: true,
    trim: true
  },
  config: {
    selectedFields: { type: [String], default: [] },
    filters: { type: mongoose.Schema.Types.Mixed, default: { condition: 'and', filters: [] } },
    sort: { type: mongoose.Schema.Types.Mixed, default: [] }
  },
  createdBy: {
    type: String,
    required: true
  },
  isShared: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

savedReportSchema.index({ createdBy: 1, reportKey: 1 });
savedReportSchema.index({ reportKey: 1, isShared: 1 });

savedReportSchema.plugin(tenantPlugin);

export default mongoose.model('SavedReport', savedReportSchema);
