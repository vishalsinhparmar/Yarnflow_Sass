import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, ChevronDown, Shield, Mail, Menu } from 'lucide-react';

const NavBarApp = ({ onMobileMenuToggle = () => {} }) => {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 h-[var(--header-height)] border-b border-gray-700 bg-gray-900 shadow-lg">
      <div className="flex h-full items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* Logo Section */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg blur-md opacity-50"></div>
            <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-2">
              <Shield className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-white sm:text-2xl">YarnFlow</h1>
            <p className="hidden max-w-64 truncate text-xs text-gray-400 sm:block">{company?.companyName} · {company?.companyCode}</p>
          </div>
          <div className="hidden rounded-md bg-orange-600 px-2 py-1 sm:block">
            <span className="text-xs font-semibold text-white">{user?.role}</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center">
          {/* System Status Indicator
          <div className="hidden lg:flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-300 font-medium">System Online</span>
          </div> */}

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-3 px-3 py-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg transition-all duration-200 border border-white/20 group"
            >
              <div className="w-9 h-9 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-white">
                  {user?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {user?.role || 'Administrator'}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-all duration-200 ${
                  showDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-gray-800 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-700 overflow-hidden animate-fadeIn">
                {/* User Info Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {user?.email?.split('@')[0] || 'Admin User'}
                      </p>
                      <p className="text-xs text-orange-100 capitalize">
                        {user?.role || 'Administrator'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* User Details */}
                <div className="px-4 py-3 bg-gray-900/50">
                  <div className="flex items-center space-x-2 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <p className="text-xs truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>

                {/* Logout Button */}
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-left">Logout</span>
                    <ChevronDown className="w-4 h-4 -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBarApp;
