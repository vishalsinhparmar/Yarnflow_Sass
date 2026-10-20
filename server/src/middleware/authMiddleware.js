import User from '../models/user.model.js';
import Company from '../saas/company.model.js';
import { runWithTenant } from '../saas/tenantContext.js';
import { bearerToken, verifySaasToken } from '../saas/security.js';
import { effectivePermissions } from '../saas/modules.js';

export const publicCompany = company => ({ id: String(company._id), _id: String(company._id), name: company.name, companyName: company.name, companyCode: company.companyCode, status: company.status, modules: company.modules });
export const publicUser = (user, company) => ({ id: String(user._id), _id: String(user._id), name: user.name, username: user.username, email: user.email, role: user.role, isActive: user.isActive, mobileAccess: user.mobileAccess, permissions: effectivePermissions(user, company) });

// Sanitize request body to remove tenantId (it will be injected by tenant plugin)
function sanitizeRequestBody(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (/^tenant_?id$/i.test(key)) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeRequestBody(obj[key]);
    }
  }
}

export const authMiddleware = async (req, res, next) => {
  let claims;
  try {
    claims = verifySaasToken(bearerToken(req), 'company');
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired company token' });
  }
  try {
    const company = await Company.findById(claims.tenantId);
    if (!company || company.status !== 'active') return res.status(403).json({ success: false, message: 'Company access is not active' });
    if (claims.companyAuthVersion !== company.authVersion) return res.status(401).json({ success: false, message: 'Company session is no longer valid' });
    return await runWithTenant(String(company._id), async () => {
      const user = await User.findById(claims.sub).select('+tokenVersion');
      if (!user || !user.isActive || String(user.tenantId) !== String(company._id) || user.tokenVersion !== claims.tokenVersion) {
        return res.status(401).json({ success: false, message: 'Account session is no longer valid' });
      }
      // Sanitize request body to remove any tenantId fields
      sanitizeRequestBody(req.body);
      req.user = publicUser(user, company);
      req.company = publicCompany(company);
      req.tenantId = String(company._id);
      next();
    });
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
