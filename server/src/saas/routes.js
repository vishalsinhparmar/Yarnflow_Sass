import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import Company, { registrationFields } from './company.model.js';
import { seedCompanyProfile } from './companyProfileSeed.js';
import SuperAdmin from './superAdmin.model.js';
import User from '../models/user.model.js';
import { runWithTenant } from './tenantContext.js';
import { moduleCatalog, validateModules } from './modules.js';
import { asyncHandler, bearerToken, createRateLimiter, fail, issueToken, text, validEmail, validPassword, verifySaasToken } from './security.js';
import { publicUser } from '../middleware/authMiddleware.js';

export const superAdminAuth = asyncHandler(async (req, res, next) => {
  let claims;
  try { claims = verifySaasToken(bearerToken(req), 'superAdmin'); }
  catch { throw fail(401, 'Invalid or expired super-admin token'); }
  const admin = await SuperAdmin.findById(claims.sub);
  if (!admin || !admin.isActive || admin.tokenVersion !== claims.tokenVersion) throw fail(401, 'Super-admin session is no longer valid');
  req.superAdmin = { id: String(admin._id), email: admin.email, name: admin.name, role: 'SuperAdmin' };
  next();
});

const router = express.Router();
const loginLimiter = createRateLimiter({ limit: 10 });
const registrationLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
const adminWriteLimiter = createRateLimiter({ limit: 30 });

router.get('/modules', (req, res) => res.json({ success: true, data: moduleCatalog }));
router.post('/companies', registrationLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const company = await Company.create({
    ...registrationFields(body),
    companyCode: `YF-${randomBytes(6).toString('hex').toUpperCase()}`, status: 'pending', modules: []
  });
  res.status(201).json({ success: true, data: { companyCode: company.companyCode, status: company.status } });
}));

router.post('/super-admin/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = text(req.body?.email, 254).toLowerCase();
  const password = req.body?.password;
  if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) throw fail(400, 'Email and password are required');
  const admin = await SuperAdmin.findOne({ email }).select('+password');
  if (!admin || !admin.isActive || !(await bcrypt.compare(password, admin.password))) throw fail(401, 'Invalid credentials');
  res.json({ success: true, token: issueToken('superAdmin', admin), user: { id: String(admin._id), name: admin.name, email: admin.email, role: 'SuperAdmin' } });
}));
router.get('/super-admin/verify', superAdminAuth, (req, res) => res.json({ success: true, user: req.superAdmin }));

router.get('/companies', superAdminAuth, asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
  const [companies, total] = await Promise.all([Company.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Company.countDocuments()]);
  const data = [];
  for (const company of companies) {
    const usage = await runWithTenant(String(company._id), async () => {
      const [users, activeUsers] = await Promise.all([User.countDocuments(), User.countDocuments({ isActive: true })]);
      return { users, activeUsers, enabledModules: company.modules.length };
    });
    data.push({ ...company, companyName: company.name, id: String(company._id), usage });
  }
  res.json({ success: true, data, pagination: { page, limit, total } });
}));

router.param('id', (req, res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) return next(fail(400, 'Invalid company identifier'));
  next();
});
const getCompany = async id => {
  const company = await Company.findById(id);
  if (!company) throw fail(404, 'Company not found');
  return company;
};
router.patch('/companies/:id', superAdminAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};
  if (body.status === undefined && body.modules === undefined) throw fail(400, 'Status or modules are required');
  if (body.status !== undefined) {
    if (!['pending', 'active', 'inactive', 'suspended', 'rejected'].includes(body.status)) throw fail(400, 'Invalid company status');
    update.status = body.status;
  }
  if (body.modules !== undefined) update.modules = validateModules(body.modules);
  const company = await Company.findByIdAndUpdate(req.params.id, { $set: update, $inc: { authVersion: 1 } }, { new: true, runValidators: true });
  if (!company) throw fail(404, 'Company not found');
  let permissionsSyncPending = false;
  try {
    await runWithTenant(String(company._id), async () => {
      await User.updateMany({}, { $inc: { tokenVersion: 1 }, $pull: { permissions: { $nin: company.modules } } });
      if (company.initialAdminId && body.modules !== undefined) {
        await User.updateOne({ _id: company.initialAdminId }, { $set: { permissions: company.modules } });
      }
    });
  } catch { permissionsSyncPending = true; }
  res.json({ success: true, data: { ...company.toObject(), companyName: company.name }, ...(permissionsSyncPending ? { permissionsSyncPending: true } : {}) });
}));

router.post('/companies/:id/admin', superAdminAuth, adminWriteLimiter, asyncHandler(async (req, res) => {
  const company = await getCompany(req.params.id);
  if (company.initialAdminId) throw fail(409, 'Initial company administrator already exists');
  const body = req.body || {};
  const name = text(body.name, 120);
  const username = text(body.username, 80).toLowerCase();
  if (!name || !username || !/^[a-z0-9._-]+$/.test(username)) throw fail(400, 'Name and a valid username are required');
  const email = validEmail(body.email);
  const password = await bcrypt.hash(validPassword(body.password), 12);
  const user = await runWithTenant(String(company._id), async () => {
    await seedCompanyProfile(company);
    const created = await User.create({ tenantId: company._id, name, username, email, password, role: 'Admin', permissions: company.modules, isActive: true });
    const result = await Company.updateOne({ _id: company._id, initialAdminId: null }, { $set: { initialAdminId: created._id } });
    if (!result.modifiedCount) {
      await User.deleteOne({ _id: created._id });
      throw fail(409, 'Initial company administrator already exists');
    }
    return created;
  });
  res.status(201).json({ success: true, data: publicUser(user, company) });
}));

router.patch('/companies/:id/admin', superAdminAuth, adminWriteLimiter, asyncHandler(async (req, res) => {
  const company = await getCompany(req.params.id);
  if (!company.initialAdminId) throw fail(404, 'Initial company administrator has not been created');
  const password = await bcrypt.hash(validPassword(req.body?.password), 12);
  const user = await runWithTenant(String(company._id), async () => User.findOneAndUpdate({ _id: company.initialAdminId }, { $set: { password, role: 'Admin', isActive: true, permissions: company.modules }, $inc: { tokenVersion: 1 } }, { new: true, runValidators: true }));
  if (!user) throw fail(404, 'Initial company administrator not found');
  res.json({ success: true, data: publicUser(user, company), message: 'Administrator password reset; existing sessions revoked' });
}));

export default router;
