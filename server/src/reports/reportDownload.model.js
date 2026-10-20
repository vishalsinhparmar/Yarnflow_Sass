import mongoose from 'mongoose';
import tenantPlugin from '../saas/tenantPlugin.js';

const reportDownloadSchema = new mongoose.Schema({
  reportName: {
    type: String,
    required: true
  },
  reportKey: {
    type: String,
    required: true
  },
  dateRange: {
    type: String,
    default: ''
  },
  filename: {
    type: String,
    required: true
  },
  fileData: {
    type: Buffer,
    default: null
  },
  createdBy: {
    type: String,
    default: 'System'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries by user
reportDownloadSchema.index({ createdBy: 1, generatedAt: -1 });

reportDownloadSchema.plugin(tenantPlugin);

export default mongoose.model('ReportDownload', reportDownloadSchema);
