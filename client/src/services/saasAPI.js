import { API_BASE_URL, ApiError } from './common';

export const TENANT_TOKEN_KEY = 'yarnflow-saas.tenant.token';
export const SUPER_TOKEN_KEY = 'yarnflow-saas.super-admin.token';
export const MODULES = [
  ['dashboard', 'Dashboard', '/app/dashboard'],
  ['purchase-orders', 'Purchase orders', '/app/purchase-order'],
  ['grn', 'Goods receipt notes', '/app/goods-receipt'],
  ['inventory', 'Inventory', '/app/inventory'],
  ['sales-orders', 'Sales orders', '/app/sales-order'],
  ['sales-challans', 'Sales challans', '/app/sales-challan'],
  ['customers', 'Customers', '/app/master-data/customers'],
  ['suppliers', 'Suppliers', '/app/master-data/suppliers'],
  ['products', 'Products', '/app/master-data/products'],
  ['categories', 'Categories', '/app/master-data/categories'],
  ['sub-products', 'Sub-products', '/app/master-data/sub-products'],
  ['warehouses', 'Warehouses', '/app/configuration/warehouses'],
  ['reports', 'Reports', '/app/reports'],
  ['company-profile', 'Company profile', '/app/company-profile'],
  ['configuration', 'Configuration', '/app/configuration'],
  ['users', 'Users', '/app/configuration/users'],
].map(([key, label, path]) => ({ key, label, path }));

export const canAccessModule = (user, company, key) => Boolean(
  user && ['Admin', 'User'].includes(user.role) && company?.status === 'active' && user.isActive !== false &&
  Array.isArray(company.modules) && company.modules.includes(key) &&
  (key !== 'users' || user.role === 'Admin') &&
  (user.role === 'Admin' || (Array.isArray(user.permissions) && user.permissions.includes(key)))
);

export const canAccessPath = (user, company, path) => {
  const pathname = path.split('?')[0].replace(/\/$/, '');
  if (pathname === '/app/master-data') return ['customers', 'suppliers', 'products', 'categories', 'sub-products'].every(key => canAccessModule(user, company, key));
  const module = MODULES.find(item => item.path === pathname);
  return Boolean(module && canAccessModule(user, company, module.key));
};

export async function saasRequest(endpoint, { method = 'GET', body, superAdmin = false, signal } = {}) {
  const token = superAdmin ? localStorage.getItem(SUPER_TOKEN_KEY) : null;
  const controller = signal ? null : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), 15000) : null;
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method, signal: signal || controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      if (superAdmin && (response.status === 401 || response.status === 403) && localStorage.getItem(SUPER_TOKEN_KEY) === token) {
        localStorage.removeItem(SUPER_TOKEN_KEY);
        window.dispatchEvent(new Event('saas-super-session-expired'));
      }
      throw new ApiError(data.message || 'The request could not be completed.', { status: response.status });
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.name === 'AbortError' ? 'The request timed out. Please try again.' : 'Unable to connect to YarnFlow. Please try again.');
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export const saasAPI = {
  register: body => saasRequest('/saas/companies', { method: 'POST', body }),
  superLogin: body => saasRequest('/saas/super-admin/login', { method: 'POST', body }),
  companies: () => saasRequest('/saas/companies', { superAdmin: true }),
  modules: () => saasRequest('/saas/modules', { superAdmin: true }),
  updateCompany: (id, body) => saasRequest(`/saas/companies/${id}`, { method: 'PATCH', body, superAdmin: true }),
  createAdmin: (id, body) => saasRequest(`/saas/companies/${id}/admin`, { method: 'POST', body, superAdmin: true }),
  resetAdmin: (id, password) => saasRequest(`/saas/companies/${id}/admin`, { method: 'PATCH', body: { password }, superAdmin: true }),
};
