import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Company from '../saas/company.model.js';
import { publicUser } from '../middleware/authMiddleware.js';
import { asyncHandler, fail, text, validEmail, validPassword } from '../saas/security.js';
import { validateModules } from '../saas/modules.js';

const fields = (body, company, creating = false) => {
  const update = {};
  if (creating || body.email !== undefined) update.email = validEmail(body.email);
  if (body.name !== undefined) {
    update.name = text(body.name, 120);
    if (!update.name) throw fail(400, 'A valid name is required');
  }
  if (body.username !== undefined) {
    update.username = text(body.username, 80).toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(update.username)) throw fail(400, 'Username may contain letters, numbers, dots, underscores and hyphens');
  }
  if (creating || body.role !== undefined) {
    update.role = body.role ?? 'User';
    if (!['Admin', 'User'].includes(update.role)) throw fail(400, 'Role must be Admin or User');
  }
  if (creating || body.permissions !== undefined) update.permissions = validateModules(body.permissions ?? [], company.modules);
  for (const key of ['isActive', 'mobileAccess']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') throw fail(400, `${key} must be a boolean`);
      update[key] = body[key];
    }
  }
  return update;
};
const targetUser = async req => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id || '')) throw fail(400, 'Invalid user identifier');
  const user = await User.findById(req.params.id);
  if (!user) throw fail(404, 'User not found');
  return user;
};
const protectInitialAdmin = async (req, user, update, deleting = false) => {
  const company = await Company.findById(req.tenantId);
  if (!company || company.status !== 'active') throw fail(403, 'Company access is not active');
  if (String(company.initialAdminId) === String(user._id) && (deleting || update.role === 'User' || update.isActive === false || (update.permissions && company.modules.includes('users') && !update.permissions.includes('users')))) {
    throw fail(400, 'The initial company administrator must remain active and retain user administration access');
  }
  if (String(user._id) === req.user.id && (deleting || update.role === 'User' || update.isActive === false || (update.permissions && !update.permissions.includes('users')))) {
    throw fail(400, 'You cannot remove your own administration access');
  }
};
const ensureNoConflict = async (update, id) => {
  const alternatives = [];
  if (update.email) alternatives.push({ email: update.email }, { username: update.email });
  if (update.username) alternatives.push({ email: update.username }, { username: update.username });
  if (alternatives.length && await User.exists({ ...(id ? { _id: { $ne: id } } : {}), $or: alternatives })) throw fail(409, 'Email or username already exists in this company');
};

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(1000);
  res.json({ success: true, data: users.map(user => publicUser(user, req.company)) });
});

export const createUser = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = fields(body, req.company, true);
  await ensureNoConflict(update);
  const password = await bcrypt.hash(validPassword(body.password), 12);
  const user = await User.create({ ...update, tenantId: req.tenantId, password });
  res.status(201).json({ success: true, data: publicUser(user, req.company) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await targetUser(req);
  const body = req.body || {};
  const update = fields(body, req.company);
  if (body.password !== undefined) update.password = await bcrypt.hash(validPassword(body.password), 12);
  if (!Object.keys(update).length) throw fail(400, 'No supported user fields provided');
  await protectInitialAdmin(req, user, update);
  await ensureNoConflict(update, user._id);
  const updated = await User.findOneAndUpdate({ _id: user._id }, { $set: update, $inc: { tokenVersion: 1 } }, { new: true, runValidators: true });
  if (!updated) throw fail(404, 'User not found');
  res.json({ success: true, data: publicUser(updated, req.company) });
});

export const toggleUserActive = asyncHandler(async (req, res) => {
  const user = await targetUser(req);
  const update = { isActive: !user.isActive };
  await protectInitialAdmin(req, user, update);
  const updated = await User.findOneAndUpdate({ _id: user._id }, { $set: update, $inc: { tokenVersion: 1 } }, { new: true });
  if (!updated) throw fail(404, 'User not found');
  res.json({ success: true, data: publicUser(updated, req.company) });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await targetUser(req);
  await protectInitialAdmin(req, user, {}, true);
  await User.deleteOne({ _id: user._id });
  res.json({ success: true, message: 'User deleted' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await targetUser(req);
  const password = await bcrypt.hash(validPassword(req.body?.password), 12);
  await User.updateOne({ _id: user._id }, { $set: { password }, $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: 'Password reset; existing sessions revoked' });
});
