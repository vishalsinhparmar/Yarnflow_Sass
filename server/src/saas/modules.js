export const MODULES = Object.freeze([
  'dashboard', 'purchase-orders', 'grn', 'inventory', 'sales-orders',
  'sales-challans', 'customers', 'suppliers', 'products', 'categories',
  'sub-products', 'warehouses', 'reports', 'company-profile', 'configuration', 'users'
]);

export const moduleCatalog = MODULES.map(id => ({ id, name: id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ') }));
export function validateModules(value, allowed = MODULES) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !allowed.includes(item))) {
    const error = new Error('Permissions must contain only enabled company modules');
    error.status = 400;
    throw error;
  }
  return [...new Set(value)];
}

export const effectivePermissions = (user, company) => company.modules.filter(module => user.permissions.includes(module));
export const requireModules = (...modules) => (req, res, next) => {
  if (!req.user || !req.company || modules.some(module => !req.company.modules.includes(module) || !req.user.permissions.includes(module))) {
    return res.status(403).json({ success: false, message: 'Module access denied' });
  }
  next();
};
export const requireCompanyAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') return res.status(403).json({ success: false, message: 'Company administrator access required' });
  next();
};

export function masterDataAccess(req, res, next) {
  const parts = req.path.split('/').filter(Boolean);
  const resource = parts[0] === 'import' ? parts[1] : parts[0];
  if (resource === 'stats') return requireModules('customers', 'suppliers', 'products', 'categories', 'sub-products')(req, res, next);
  if (parts.includes('sub-products')) return requireModules('products', 'sub-products')(req, res, next);
  const module = resource === 'units' ? 'configuration' : resource;
  if (!['customers', 'suppliers', 'products', 'categories', 'sub-products', 'configuration'].includes(module)) {
    return res.status(403).json({ success: false, message: 'Module access denied' });
  }
  return requireModules(module)(req, res, next);
}
