// Sales Challan API Service
import { apiRequest, API_BASE_URL } from './common.js';

// Generic API request handler moved to ./common.js

// ============ SALES CHALLAN API ============
export const salesChallanAPI = {
  // Get all sales challans with pagination and filters
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/sales-challans?${queryString}` : '/sales-challans';
    return apiRequest(endpoint);
  },

  // Get sales challan by ID
  getById: async (id) => {
    return apiRequest(`/sales-challans/${id}`);
  },

  // Get all challans issued against one sales order
  getBySalesOrder: async (salesOrderId) => {
    return apiRequest(`/sales-challans/by-sales-order/${salesOrderId}`);
  },

  // Get dispatched quantities for a sales order
  getDispatchedQuantities: async (salesOrderId) => {
    return apiRequest(`/sales-challans/dispatched/${salesOrderId}`);
  },

  // Create sales challan from sales order
  create: async (challanData) => {
    return apiRequest('/sales-challans', {
      method: 'POST',
      body: JSON.stringify(challanData),
    });
  },

  // Update challan status
  updateStatus: async (id, statusData) => {
    return apiRequest(`/sales-challans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    });
  },

  // Get challan statistics for dashboard
  getStats: async () => {
    return apiRequest('/sales-challans/stats');
  },

  // Generate PDF for single challan
  generatePDF: async (id) => {
    const url = `${API_BASE_URL}/sales-challans/${id}/pdf/download`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('yarnflow-saas.tenant.token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the blob
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Sales_Challan_${id}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      console.error('Error downloading PDF:', error);
      throw error;
    }
  },

  // Preview PDF — returns a blob URL for in-app modal embedding
  previewPDF: async (id) => {
    const url = `${API_BASE_URL}/sales-challans/${id}/pdf/preview`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('yarnflow-saas.tenant.token') || ''}` }
    });
    if (!response.ok) throw new Error('Failed to preview PDF');
    const blob = await response.blob();
    return { success: true, blobUrl: window.URL.createObjectURL(blob) };
  },

  // Generate Consolidated PDF for SO (download)
  generateConsolidatedPDF: async (soId) => {
    const url = `${API_BASE_URL}/sales-challans/so/${soId}/pdf/download`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('yarnflow-saas.tenant.token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate consolidated PDF');
      }

      // Get the blob
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `SO_Consolidated_${soId}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, message: 'Consolidated PDF downloaded successfully' };
    } catch (error) {
      console.error('Error downloading consolidated PDF:', error);
      throw error;
    }
  },

  // Preview Consolidated PDF for SO — returns a blob URL for in-app modal embedding
  previewConsolidatedPDF: async (soId) => {
    const url = `${API_BASE_URL}/sales-challans/so/${soId}/pdf/preview`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('yarnflow-saas.tenant.token') || ''}` }
    });
    if (!response.ok) throw new Error('Failed to preview consolidated PDF');
    const blob = await response.blob();
    return { success: true, blobUrl: window.URL.createObjectURL(blob) };
  }
};

// ============ SALES CHALLAN UTILITIES ============
export const salesChallanUtils = {
  // Format status for display
  formatStatus: (status) => {
    const statusMap = {
      'Prepared': 'Prepared',
      'Dispatched': 'Dispatched',
      'Delivered': 'Delivered',
      'Cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
  },

  // Get status color
  getStatusColor: (status) => {
    const colorMap = {
      'Prepared': 'bg-blue-100 text-blue-800',
      'Dispatched': 'bg-orange-100 text-orange-800',
      'Delivered': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-gray-100 text-gray-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  },

  // Format date for display
  formatDate: (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Format currency
  formatCurrency: (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
};
