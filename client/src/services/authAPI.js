// Authentication API Service
import { apiRequest } from './common.js';

export const authAPI = {
  // Register new user
  register: async (company) => {
    return apiRequest('/saas/companies', {
      method: 'POST',
      anonymous: true,
      body: JSON.stringify(company),
    });
  },

  // Login user
  login: async (companyCode, email, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: JSON.stringify({ companyCode, email, password }),
    });
  },

  // Verify token
  verifyToken: async (token) => {
    return apiRequest('/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

export default authAPI;
