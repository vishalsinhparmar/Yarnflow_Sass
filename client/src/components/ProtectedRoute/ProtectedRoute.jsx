import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppInitializationLoader from '../common/AppInitializationLoader';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, canVisit, homePath, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppInitializationLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname.replace(/\/$/, '') !== '/app' && !canVisit(location.pathname)) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="max-w-lg rounded-2xl bg-white border p-8 text-center"><h1 className="text-2xl font-bold text-slate-900">Module access unavailable</h1><p className="mt-3 text-slate-600">Your company or account does not have access to this module. Contact your company administrator.</p><Link className="inline-block mt-6 text-orange-600 font-semibold" to={canVisit(homePath) ? homePath : '/'}>Return to available workspace</Link><button onClick={logout} className="mx-auto mt-4 block text-sm text-slate-500 underline">Sign out</button></div></div>;
  }

  return children;
};

export default ProtectedRoute;
