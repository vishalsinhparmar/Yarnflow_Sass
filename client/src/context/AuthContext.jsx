import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/authAPI';
import { ApiError } from '../services/common';
import { TENANT_TOKEN_KEY, canAccessModule, canAccessPath, MODULES } from '../services/saasAPI';
import toast from 'react-hot-toast';
import { clearAllDownloads } from '../components/reports/reportDownloadsManager';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const validateSession = response => {
  if (!response || response.success === false || !response.user || !response.company || response.company.status !== 'active' || response.user.isActive === false || !['Admin', 'User'].includes(response.user.role)) {
    throw new ApiError('This company or user does not have active access. Please contact your administrator.', { status: 403, code: 'ACCOUNT_DISABLED' });
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    let cancelled = false;
    const clear = () => {
      clearAllDownloads();
      localStorage.removeItem(TENANT_TOKEN_KEY);
      localStorage.removeItem('yarnflow-saas.tenant.user');
      setToken(null);
      setUser(null);
      setCompany(null);
    };
    const verifyUser = async () => {
      const storedToken = localStorage.getItem(TENANT_TOKEN_KEY);
      if (storedToken) {
        try {
          const response = await authAPI.verifyToken(storedToken);
          validateSession(response);
          if (!cancelled && localStorage.getItem(TENANT_TOKEN_KEY) === storedToken) {
            setUser(response.user);
            setCompany(response.company);
            setToken(storedToken);
          }
        } catch {
          if (!cancelled && localStorage.getItem(TENANT_TOKEN_KEY) === storedToken) clear();
        }
      } else if (!cancelled) {
        setUser(null);
        setCompany(null);
        setToken(null);
      }
      if (!cancelled) setLoading(false);
    };
    const storageChanged = event => {
      if (event.key === TENANT_TOKEN_KEY || event.key === null) {
        setToken(null); setUser(null); setCompany(null); setLoading(true); verifyUser();
      }
    };
    const onFocus = () => { if (localStorage.getItem(TENANT_TOKEN_KEY)) verifyUser(); };
    window.addEventListener('saas-session-expired', clear);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', onFocus);
    verifyUser();
    return () => {
      cancelled = true;
      window.removeEventListener('saas-session-expired', clear);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const login = async (companyCode, email, password, rememberMe = false) => {
    const response = await authAPI.login(companyCode, email, password);
    validateSession(response);
    if (!response.token) throw new Error('No session was returned. Please try again.');
    clearAllDownloads();
    localStorage.setItem(TENANT_TOKEN_KEY, response.token);
    setUser(response.user);
    setCompany(response.company);
    setToken(response.token);

    // Handle remember me — store email only, NEVER the password
    if (rememberMe) localStorage.setItem('yarnflow-saas.rememberedEmail', email);
    else localStorage.removeItem('yarnflow-saas.rememberedEmail');
    localStorage.removeItem('yarnflow-saas.rememberedPassword');
    toast.success('Login successful!');
    return response;
  };

  const register = companyData => authAPI.register(companyData);

  const logout = () => {
    clearAllDownloads();
    setUser(null);
    setCompany(null);
    setToken(null);
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem('yarnflow-saas.tenant.user');
    toast.success('Logged out successfully');
  };

  const canAccess = key => canAccessModule(user, company, key);
  const canVisit = path => canAccessPath(user, company, path);
  const homePath = MODULES.find(item => canAccess(item.key))?.path || '/app/dashboard';
  const value = { user, company, token, loading, login, register, logout, canAccess, canVisit, homePath, isAuthenticated: Boolean(user && company && token) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
