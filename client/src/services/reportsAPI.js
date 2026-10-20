import { API_BASE_URL } from './common.js';

async function fetchWithAuth(endpoint, options = {}) {
  const token = localStorage.getItem('yarnflow-saas.tenant.token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Request failed: ${response.status}`);
  }

  if (options.responseType === 'blob') {
    return response.blob();
  }

  return response.json();
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

async function downloadExcel(endpoint, filename, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${endpoint}${qs ? `?${qs}` : ''}`;
  const blob = await fetchWithAuth(url, { responseType: 'blob' });
  downloadBlob(blob, filename);
}

export const reportsAPI = {
  // Legacy hard-coded Excel downloads (kept for backward compatibility)
  inventory:      (params) => downloadExcel('/reports/inventory',       `Inventory_Report_${Date.now()}.xlsx`,      params),
  grn:            (params) => downloadExcel('/reports/grn',             `GRN_Report_${Date.now()}.xlsx`,            params),
  purchaseOrders: (params) => downloadExcel('/reports/purchase-orders', `PurchaseOrder_Report_${Date.now()}.xlsx`,  params),
  salesOrders:    (params) => downloadExcel('/reports/sales-orders',    `SalesOrder_Report_${Date.now()}.xlsx`,     params),
  salesChallans:  (params) => downloadExcel('/reports/sales-challans',  `SalesChallan_Report_${Date.now()}.xlsx`,   params),
  masterData:     ()       => downloadExcel('/reports/master-data',     `MasterData_Report_${Date.now()}.xlsx`),

  // New dynamic report builder endpoints
  getReports: () => fetchWithAuth('/reports'),
  getDefinition: (reportKey) => fetchWithAuth(`/reports/${reportKey}/definition`),
  preview: (reportKey, payload) => fetchWithAuth(`/reports/${reportKey}/preview`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  export: async (reportKey, payload, filename) => {
    const response = await fetch(`${API_BASE_URL}/reports/${reportKey}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('yarnflow-saas.tenant.token') || ''}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Export failed: ${response.status}`);
    }
    const blob = await response.blob();
    // Download the file to browser AND return blob for further processing
    downloadBlob(blob, filename);
    return blob;
  },
  getLookupOptions: (reportKey, fieldKey) => fetchWithAuth(`/reports/${reportKey}/lookup-options/${fieldKey}`),
  
  exportPDF: async (reportKey, payload, filename) => {
    const response = await fetch(`${API_BASE_URL}/reports/${reportKey}/export-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('yarnflow-saas.tenant.token') || ''}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `PDF export failed: ${response.status}`);
    }
    const blob = await response.blob();
    // Download the file to browser AND return blob for further processing
    downloadBlob(blob, filename);
    return blob;
  },

  // Saved reports
  getSavedReports: () => fetchWithAuth('/reports/saved'),
  getSavedReport: (id) => fetchWithAuth(`/reports/saved/${id}`),
  createSavedReport: (reportKey, data) => fetchWithAuth(`/reports/${reportKey}/saved`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateSavedReport: (id, data) => fetchWithAuth(`/reports/saved/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteSavedReport: (id) => fetchWithAuth(`/reports/saved/${id}`, { method: 'DELETE' }),

  // Download tracking
  getDownloads: () => fetchWithAuth('/reports/downloads'),
  createDownload: (data) => fetchWithAuth('/reports/downloads', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  downloadFile: async (id) => {
    const token = localStorage.getItem('yarnflow-saas.tenant.token');
    const response = await fetch(`${API_BASE_URL}/reports/downloads/${id}/file`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Download failed: ${response.status}`);
    }
    
    return response.blob();
  },
  deleteDownload: (id) => fetchWithAuth(`/reports/downloads/${id}`, { method: 'DELETE' }),
  clearDownloads: () => fetchWithAuth('/reports/downloads', { method: 'DELETE' })
};

export default reportsAPI;
