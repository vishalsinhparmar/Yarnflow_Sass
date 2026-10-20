// Master Data API Service for YarnFlow Frontend
import { apiRequest as baseRequest } from './common.js';

// Prefix all master data endpoints with '/master-data'
const apiRequest = (endpoint, options = {}) => baseRequest(`/master-data${endpoint}`, options);

// ============ MASTER DATA STATS ============
export const getMasterDataStats = async () => {
  return apiRequest('/stats');
};

// ============ IMPORT API ============
export const importMasterData = async (type, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Use fetch directly for file upload (FormData requires different handling)
  const { API_BASE_URL } = await import('./common.js');
  const token = localStorage.getItem('yarnflow-saas.tenant.token');
  
  const response = await fetch(`${API_BASE_URL}/master-data/import/${type}`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — browser sets multipart/form-data with boundary automatically
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const message = data?.message || `HTTP error! status: ${response.status}`;
    throw new Error(message);
  }
  
  return data;
};

// ============ CUSTOMER API ============
export const customerAPI = {
  // Get all customers with pagination and filters
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/customers?${queryString}` : '/customers';
    return apiRequest(endpoint);
  },

  // Get customer by ID
  getById: async (id) => {
    return apiRequest(`/customers/${id}`);
  },

  // Create new customer
  create: async (customerData) => {
    return apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  },

  // Update customer
  update: async (id, customerData) => {
    return apiRequest(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });
  },

  // Delete customer
  delete: async (id) => {
    return apiRequest(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  // Search customers
  search: async (searchTerm, filters = {}) => {
    const params = { search: searchTerm, ...filters };
    return customerAPI.getAll(params);
  },
};

// ============ SUPPLIER API ============
export const supplierAPI = {
  // Get all suppliers with pagination and filters
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/suppliers?${queryString}` : '/suppliers';
    return apiRequest(endpoint);
  },

  // Get supplier by ID
  getById: async (id) => {
    return apiRequest(`/suppliers/${id}`);
  },

  // Create new supplier
  create: async (supplierData) => {
    return apiRequest('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData),
    });
  },

  // Update supplier
  update: async (id, supplierData) => {
    return apiRequest(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData),
    });
  },

  // Delete supplier
  delete: async (id) => {
    return apiRequest(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  }
};

// ============ CATEGORY API ============
export const categoryAPI = {
  // Get all categories
  getAll: async (includeSubcategories = false) => {
    const params = includeSubcategories ? { includeSubcategories: 'true' } : {};
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/categories?${queryString}` : '/categories';
    return apiRequest(endpoint);
  },

  // Create new category
  create: async (categoryData) => {
    return apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  // Update category
  update: async (categoryId, categoryData) => {
    return apiRequest(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  // Delete category
  delete: async (categoryId) => {
    return apiRequest(`/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }
};

// ============ PRODUCT API ============
export const productAPI = {
  // Get all products with pagination and filters
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/products?${queryString}` : '/products';
    return apiRequest(endpoint);
  },

  // Get product by ID
  getById: async (id) => {
    return apiRequest(`/products/${id}`);
  },

  // Create new product
  create: async (productData) => {
    return apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  // Update product
  update: async (id, productData) => {
    return apiRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  // Delete product
  delete: async (id) => {
    return apiRequest(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Get products by category
  getByCategory: async (categoryId, params = {}) => {
    return productAPI.getAll({ category: categoryId, ...params });
  },

  // Get products by supplier
  getBySupplier: async (supplierId, params = {}) => {
    return productAPI.getAll({ supplier: supplierId, ...params });
  },

  // Get low stock products
  getLowStock: async () => {
    // This would need to be implemented on the backend
    // For now, we'll filter on the frontend
    const response = await productAPI.getAll({ limit: 100 });
    return {
      ...response,
      data: response.data.filter(product => product.isLowStock)
    };
  },

  // Search products
  search: async (searchTerm, filters = {}) => {
    const params = { search: searchTerm, ...filters };
    return productAPI.getAll(params);
  },
};

// ============ SUB-PRODUCT API ============
export const subProductAPI = {
  // Get all sub-products for a product
  getAll: async (productId) => {
    return apiRequest(`/products/${productId}/sub-products`);
  },

  // Bulk add multiple sub-products at once (names: string[])
  bulkAdd: async (productId, names) => {
    return apiRequest(`/products/${productId}/sub-products/bulk`, {
      method: 'POST',
      body: JSON.stringify({ names }),
    });
  },

  // Update a single sub-product by its own ID
  update: async (id, data) => {
    return apiRequest(`/sub-products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete a single sub-product by its own ID
  delete: async (id) => {
    return apiRequest(`/sub-products/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============ UNIT API ============
export const unitAPI = {
  // Get all units
  getAll: async () => {
    return apiRequest('/units');
  },

  // Create new unit
  create: async (unitData) => {
    return apiRequest('/units', {
      method: 'POST',
      body: JSON.stringify(unitData),
    });
  },

  // Update unit
  update: async (id, unitData) => {
    return apiRequest(`/units/${id}`, {
      method: 'PUT',
      body: JSON.stringify(unitData),
    });
  },

  // Delete unit
  delete: async (id) => {
    return apiRequest(`/units/${id}`, {
      method: 'DELETE',
    });
  }
};

// ============ UTILITY FUNCTIONS ============

// Get dropdown options for forms
export const getDropdownOptions = async () => {
  try {
    const [categoriesResponse, suppliersResponse] = await Promise.all([
      categoryAPI.getAll(),
      supplierAPI.getAll({ limit: 100 })
    ]);

    return {
      categories: categoriesResponse.data.map(cat => ({
        value: cat._id,
        label: cat.categoryName
      })),
      suppliers: suppliersResponse.data.map(sup => ({
        value: sup._id,
        label: sup.companyName
      })),
      paymentTerms: [
        { value: 'Cash', label: 'Cash' },
        { value: 'Credit-15', label: 'Credit 15 Days' },
        { value: 'Credit-30', label: 'Credit 30 Days' },
        { value: 'Credit-45', label: 'Credit 45 Days' },
        { value: 'Credit-60', label: 'Credit 60 Days' }
      ],
      supplierTypes: [
        { value: 'Cotton Yarn', label: 'Cotton Yarn' },
        { value: 'Polyester', label: 'Polyester' },
        { value: 'Blended Yarn', label: 'Blended Yarn' },
        { value: 'Raw Cotton', label: 'Raw Cotton' },
        { value: 'Chemicals', label: 'Chemicals' },
        { value: 'Other', label: 'Other' }
      ],
      materials: [
        { value: 'Cotton', label: 'Cotton' },
        { value: 'Polyester', label: 'Polyester' },
        { value: 'Cotton-Polyester', label: 'Cotton-Polyester' },
        { value: 'Viscose', label: 'Viscose' },
        { value: 'Wool', label: 'Wool' },
        { value: 'Silk', label: 'Silk' }
      ],
      packingTypes: [
        { value: 'Bags', label: 'Bags' },
        { value: 'Rolls', label: 'Rolls' },
        { value: 'Cones', label: 'Cones' },
        { value: 'Hanks', label: 'Hanks' }
      ],
      qualityTypes: [
        { value: 'Premium', label: 'Premium' },
        { value: 'Standard', label: 'Standard' },
        { value: 'Economy', label: 'Economy' }
      ]
    };
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
    return {
      categories: [],
      suppliers: [],
      paymentTerms: [],
      supplierTypes: [],
      materials: [],
      packingTypes: [],
      qualityTypes: []
    };
  }
};

// Error handler for components
export const handleAPIError = (error, defaultMessage = 'An error occurred') => {
  console.error('API Error:', error);
  
  if (error.message) {
    return error.message;
  }
  
  return defaultMessage;
};

// Default export with all APIs
export default {
  customers: customerAPI,
  suppliers: supplierAPI,
  categories: categoryAPI,
  products: productAPI,
  subProducts: subProductAPI,
  units: unitAPI,
  stats: {
    get: getMasterDataStats
  },
  utils: {
    getDropdownOptions,
    handleAPIError
  }
};
