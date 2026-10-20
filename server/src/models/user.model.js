import mongoose from "mongoose";
import tenantPlugin from '../saas/tenantPlugin.js';
import { MODULES } from '../saas/modules.js';

const UserSchema = new mongoose.Schema({
  name:    { type: String, trim: true, default: '', maxlength: 120 },
  username:{ type: String, trim: true, lowercase: true, maxlength: 80 },
  email:   { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  password:{ type: String, required: true, select: false },
  role:    { type: String, enum: ['Admin', 'User'], default: 'User' },
  permissions: { type: [{ type: String, enum: MODULES }], default: [] },
  tokenVersion: { type: Number, default: 0, select: false },
  isActive:{ type: Boolean, default: true },
  mobileAccess: { type: Boolean, default: false }
}, { timestamps: true });

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
UserSchema.plugin(tenantPlugin);
const User = mongoose.model("User", UserSchema);

export default User;
