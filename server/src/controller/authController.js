import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Company from '../saas/company.model.js';
import { runWithTenant } from '../saas/tenantContext.js';
import { issueToken, text } from '../saas/security.js';
import { publicCompany, publicUser } from '../middleware/authMiddleware.js';

export const register = async (req, res) => res.status(403).json({ success: false, message: 'Direct user signup is disabled. Register a company at /api/saas/companies and await approval.' });

export const login = async (req, res, next) => {
  try {
    const body = req.body || {};
    const companyCode = text(body.companyCode, 40).toUpperCase();
    const companyName = text(body.companyName);
    const identity = text(body.email || body.username, 254).toLowerCase();
    if ((!companyCode && !companyName) || !identity || typeof body.password !== 'string' || !body.password || Buffer.byteLength(body.password, 'utf8') > 72) {
      return res.status(400).json({ success: false, message: 'Company code or exact company name, email or username, and password are required' });
    }
    const company = await Company.findOne(companyCode ? { companyCode } : { name: companyName });
    const denied = () => res.status(401).json({ success: false, message: 'Invalid company or credentials, or account is not active' });
    if (!company || company.status !== 'active') return denied();
    return await runWithTenant(String(company._id), async () => {
      const user = await User.findOne({ $or: [{ email: identity }, { username: identity }] }).select('+password +tokenVersion');
      if (!user || !user.isActive || !(await bcrypt.compare(body.password, user.password))) return denied();
      return res.json({ success: true, token: issueToken('company', user, company._id, company.authVersion), user: publicUser(user, company), company: publicCompany(company) });
    });
  } catch (error) {
    next(error);
  }
};

export const verifyToken = async (req, res) => res.json({ success: true, user: req.user, company: req.company });
