// Centralized API config and request helper
// Automatically detects environment and uses correct API URL

// Get environment variable from Vite (if set)
const VITE_API_URL = import.meta.env.VITE_SAAS_API_URL;

// Detect if we're in development or production
const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Set API URLs
const DEVELOPMENT_API = 'http://localhost:3051/api';

// Automatic selection: Use VITE env var if set, otherwise auto-detect
export const API_BASE_URL = (VITE_API_URL || DEVELOPMENT_API).replace(/\/$/, '');

// Log which API is being used (helpful for debugging)
console.log(`🌐 API Mode: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
console.log(`🔗 API URL: ${API_BASE_URL}`);

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', retryable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = options.anonymous ? null : localStorage.getItem('yarnflow-saas.tenant.token');

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  const requestController = options.signal ? null : new AbortController();
  const requestTimeout = requestController
    ? window.setTimeout(() => requestController.abort(), 15000)
    : null;
  if (requestController) config.signal = requestController.signal;

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError(
        'YarnFlow took too long to respond. Please try again.',
        { code: 'REQUEST_TIMEOUT', retryable: true },
      );
    }
    throw new ApiError(
      'Unable to connect to YarnFlow. Please check your connection and try again.',
      { code: 'NETWORK_ERROR', retryable: true },
    );
  } finally {
    if (requestTimeout) window.clearTimeout(requestTimeout);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const isPublicAuthRequest = options.anonymous === true || endpoint === '/auth/login' || endpoint === '/saas/companies';

    if ((response.status === 401 || (response.status === 403 && ['COMPANY_INACTIVE', 'USER_INACTIVE', 'COMPANY_DEACTIVATED', 'ACCOUNT_DISABLED'].includes(data.code))) && !isPublicAuthRequest) {
      // Token missing or expired — clear session and redirect to login
      if (localStorage.getItem('yarnflow-saas.tenant.token') === token) {
        localStorage.removeItem('yarnflow-saas.tenant.token');
        localStorage.removeItem('yarnflow-saas.tenant.user');
        window.dispatchEvent(new Event('saas-session-expired'));
      }
      throw new ApiError('Session expired. Please log in again.', {
        status: 401,
        code: 'SESSION_EXPIRED',
      });
    }
    const message = data?.message || `HTTP error! status: ${response.status}`;
    throw new ApiError(message, {
      status: response.status,
      code: data?.code || 'REQUEST_FAILED',
      retryable: data?.retryable === true || response.status >= 500,
    });
  }

  return data;
};

export default { API_BASE_URL, apiRequest };
