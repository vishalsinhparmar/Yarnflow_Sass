import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import AuthErrorCard from '../components/common/AuthErrorCard';
import { getAuthErrorDetails } from '../utils/authError';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, homePath } = useAuth();
  
  const [formData, setFormData] = useState({
    companyCode: '',
    email: '',
    password: '',
    rememberMe: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Load remembered email on mount (password is never persisted)
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('yarnflow-saas.rememberedEmail');
    if (rememberedEmail) {
      setFormData((prev) => ({
        ...prev,
        email: rememberedEmail,
        rememberMe: true,
      }));
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(homePath, { replace: true });
    }
  }, [isAuthenticated, navigate, homePath]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setIsLoading(true);

    try {
      await login(formData.companyCode.trim(), formData.email.trim(), formData.password, formData.rememberMe);
    } catch (error) {
      setSubmitError(getAuthErrorDetails(error, 'login'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-6 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-md w-full space-y-4 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl blur-md opacity-50"></div>
              <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 shadow-2xl">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">YarnFlow</h1>
          <h2 className="text-xl font-semibold text-white mb-1">Welcome Back</h2>
          <p className="text-sm text-gray-400">
            Sign in to access your management system
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 space-y-6">
          <AuthErrorCard
            error={submitError}
            onDismiss={() => setSubmitError(null)}
            onRetry={submitError?.canRetry ? handleSubmit : undefined}
            isRetrying={isLoading}
          />
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="companyCode" className="block text-sm font-medium text-gray-200 mb-2">Company code or name</label>
              <input id="companyCode" name="companyCode" autoComplete="organization" required value={formData.companyCode} onChange={handleChange} placeholder="Enter your approved company code or name" className="block w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500" />
            </div>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                Email or username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-orange-400 transition-colors" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  aria-invalid={submitError?.type === 'credentials'}
                  className="block w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="admin@yarnflow.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-orange-400 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  aria-invalid={submitError?.type === 'credentials'}
                  className="block w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-orange-400 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-orange-400 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer bg-white/10"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-300 cursor-pointer">
                Remember my email / username
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Signing in...
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>

          <div className="text-center text-sm text-gray-300"><Link to="/register" className="font-semibold text-orange-400 hover:text-orange-300">Register your company</Link><span className="mx-3">·</span><Link to="/" className="hover:text-white">Back to home</Link></div>
          {/* Register Link */}
          {/* <div className="text-center pt-4 border-t border-white/20">
            <p className="text-sm text-gray-300">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-orange-400 hover:text-orange-300 transition-colors"
              >
                Create one now
              </Link>
            </p>
          </div> */}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} YarnFlow. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
