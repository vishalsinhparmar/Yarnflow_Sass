import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, default: 'Super Admin' },
  password: { type: String, required: true, select: false },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 }
}, { timestamps: true, collection: 'saas_super_admins' });
export default mongoose.models.SaasSuperAdmin || mongoose.model('SaasSuperAdmin', schema);
