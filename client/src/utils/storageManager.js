/**
 * Storage Manager - Production-Level Storage Handling
 * Handles localStorage/sessionStorage with fallback and browser compatibility
 */

/**
 * Check if storage is available
 * @param {string} type - 'localStorage' or 'sessionStorage'
 * @returns {boolean} - True if storage is available
 */
export const isStorageAvailable = (type = 'localStorage') => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    // Storage not available (private browsing, quota exceeded, etc.)
    console.warn(`${type} is not available:`, e.message);
    return false;
  }
};

/**
 * In-memory fallback storage for when localStorage/sessionStorage is not available
 */
const memoryStorage = new Map();

/**
 * Get item from storage with fallback
 * @param {string} key - Storage key
 * @param {string} type - 'localStorage' or 'sessionStorage'
 * @returns {string|null} - Stored value or null
 */
export const getStorageItem = (key, type = 'localStorage') => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    if (isStorageAvailable(type)) {
      return storage.getItem(key);
    }
  } catch (e) {
    console.warn(`Error reading from ${type}:`, e.message);
  }

  // Fallback to memory storage
  return memoryStorage.get(key) || null;
};

/**
 * Set item in storage with fallback
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @param {string} type - 'localStorage' or 'sessionStorage'
 * @returns {boolean} - True if successful
 */
export const setStorageItem = (key, value, type = 'localStorage') => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    if (isStorageAvailable(type)) {
      storage.setItem(key, value);
      return true;
    }
  } catch (e) {
    console.warn(`Error writing to ${type}:`, e.message);
  }

  // Fallback to memory storage
  memoryStorage.set(key, value);
  return true;
};

/**
 * Remove item from storage
 * @param {string} key - Storage key
 * @param {string} type - 'localStorage' or 'sessionStorage'
 * @returns {boolean} - True if successful
 */
export const removeStorageItem = (key, type = 'localStorage') => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    if (isStorageAvailable(type)) {
      storage.removeItem(key);
      return true;
    }
  } catch (e) {
    console.warn(`Error removing from ${type}:`, e.message);
  }

  // Fallback to memory storage
  memoryStorage.delete(key);
  return true;
};

/**
 * Clear all items from storage
 * @param {string} type - 'localStorage' or 'sessionStorage'
 * @returns {boolean} - True if successful
 */
export const clearStorage = (type = 'localStorage') => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    if (isStorageAvailable(type)) {
      Object.keys(storage).filter(key => key.startsWith('yarnflow-saas.tenant.')).forEach(key => storage.removeItem(key));
      return true;
    }
  } catch (e) {
    console.warn(`Error clearing ${type}:`, e.message);
  }

  // Fallback to memory storage
  memoryStorage.clear();
  return true;
};

/**
 * Get all keys from storage
 * @param {string} type - 'localStorage' or 'sessionStorage'
 * @returns {string[]} - Array of keys
 */
export const getStorageKeys = (type = 'localStorage') => {
  try {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    if (isStorageAvailable(type)) {
      return Object.keys(storage);
    }
  } catch (e) {
    console.warn(`Error getting keys from ${type}:`, e.message);
  }

  // Fallback to memory storage
  return Array.from(memoryStorage.keys());
};

/**
 * Token Manager - Secure token handling
 */
export const tokenManager = {
  /**
   * Get stored token
   * @returns {string|null} - Token or null
   */
  getToken: () => {
    return getStorageItem('yarnflow-saas.tenant.token', 'localStorage');
  },

  /**
   * Set token
   * @param {string} token - Token to store
   * @returns {boolean} - True if successful
   */
  setToken: (token) => {
    if (!token) {
      return tokenManager.clearToken();
    }
    return setStorageItem('yarnflow-saas.tenant.token', token, 'localStorage');
  },

  /**
   * Clear token
   * @returns {boolean} - True if successful
   */
  clearToken: () => {
    removeStorageItem('yarnflow-saas.tenant.token', 'localStorage');
    removeStorageItem('yarnflow-saas.tenant.user', 'localStorage');
    return true;
  },

  /**
   * Check if token exists
   * @returns {boolean} - True if token exists
   */
  hasToken: () => {
    return !!tokenManager.getToken();
  },

  /**
   * Get token expiry time
   * @returns {number|null} - Expiry time in ms or null
   */
  getTokenExpiry: () => {
    const token = tokenManager.getToken();
    if (!token) return null;

    try {
      // Decode JWT payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch (e) {
      console.warn('Error decoding token:', e.message);
      return null;
    }
  },

  /**
   * Check if token is expired
   * @returns {boolean} - True if expired
   */
  isTokenExpired: () => {
    const expiry = tokenManager.getTokenExpiry();
    if (!expiry) return false;
    return Date.now() >= expiry;
  },

  /**
   * Get time until token expires (in seconds)
   * @returns {number|null} - Seconds until expiry or null
   */
  getTimeUntilExpiry: () => {
    const expiry = tokenManager.getTokenExpiry();
    if (!expiry) return null;
    const secondsUntilExpiry = Math.floor((expiry - Date.now()) / 1000);
    return Math.max(0, secondsUntilExpiry);
  }
};

/**
 * User Manager - User data handling
 */
export const userManager = {
  /**
   * Get stored user data
   * @returns {object|null} - User data or null
   */
  getUser: () => {
    const userJson = getStorageItem('yarnflow-saas.tenant.user', 'localStorage');
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch (e) {
      console.warn('Error parsing user data:', e.message);
      return null;
    }
  },

  /**
   * Set user data
   * @param {object} user - User data to store
   * @returns {boolean} - True if successful
   */
  setUser: (user) => {
    if (!user) {
      return userManager.clearUser();
    }
    try {
      return setStorageItem('yarnflow-saas.tenant.user', JSON.stringify(user), 'localStorage');
    } catch (e) {
      console.warn('Error storing user data:', e.message);
      return false;
    }
  },

  /**
   * Clear user data
   * @returns {boolean} - True if successful
   */
  clearUser: () => {
    return removeStorageItem('yarnflow-saas.tenant.user', 'localStorage');
  },

  /**
   * Check if user is logged in
   * @returns {boolean} - True if logged in
   */
  isLoggedIn: () => {
    return !!userManager.getUser() && tokenManager.hasToken();
  }
};

/**
 * Session Manager - Session handling
 */
export const sessionManager = {
  /**
   * Start session
   * @param {object} user - User data
   * @param {string} token - Auth token
   * @returns {boolean} - True if successful
   */
  startSession: (user, token) => {
    const userSet = userManager.setUser(user);
    const tokenSet = tokenManager.setToken(token);
    return userSet && tokenSet;
  },

  /**
   * End session
   * @returns {boolean} - True if successful
   */
  endSession: () => {
    userManager.clearUser();
    tokenManager.clearToken();
    clearStorage('sessionStorage');
    return true;
  },

  /**
   * Check if session is valid
   * @returns {boolean} - True if valid
   */
  isValid: () => {
    return userManager.isLoggedIn() && !tokenManager.isTokenExpired();
  },

  /**
   * Get session info
   * @returns {object} - Session info
   */
  getInfo: () => {
    return {
      user: userManager.getUser(),
      hasToken: tokenManager.hasToken(),
      isExpired: tokenManager.isTokenExpired(),
      timeUntilExpiry: tokenManager.getTimeUntilExpiry(),
      isValid: sessionManager.isValid()
    };
  }
};

export default {
  isStorageAvailable,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  clearStorage,
  getStorageKeys,
  tokenManager,
  userManager,
  sessionManager
};
