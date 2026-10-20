import { createElement, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Database,
  Factory,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X
} from 'lucide-react';

const primaryItems = [
  { name: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Purchase Order (PO)', path: '/app/purchase-order', icon: ShoppingCart },
  { name: 'Goods Receipt Note (GRN)', path: '/app/goods-receipt', icon: ClipboardCheck },
  { name: 'Inventory Lots', path: '/app/inventory', icon: Package },
  { name: 'Sales Order (SO)', path: '/app/sales-order', icon: FileText },
  { name: 'Sales Challan', path: '/app/sales-challan', icon: Truck }
];

const masterDataItems = [
  { name: 'Dashboard', path: '/app/master-data', icon: LayoutDashboard },
  { name: 'Customers', path: '/app/master-data/customers', icon: Users },
  { name: 'Suppliers', path: '/app/master-data/suppliers', icon: Factory },
  { name: 'Products', path: '/app/master-data/products', icon: Boxes },
  { name: 'Categories', path: '/app/master-data/categories', icon: FolderOpen },
  { name: 'Sub Products', path: '/app/master-data/sub-products', icon: Layers }
];

const configurationItems = [
  { name: 'Warehouses', path: '/app/configuration/warehouses', icon: MapPin },
  { name: 'Users', path: '/app/configuration/users', icon: Users }
];

const NavLink = ({ item, active, collapsed, onNavigate, nested = false }) => {
  const { canVisit } = useAuth();
  if (!canVisit(item.path)) return null;
  return <Link
    to={item.path}
    onClick={onNavigate}
    title={collapsed ? item.name : undefined}
    aria-label={collapsed ? item.name : undefined}
    className={`group flex min-h-10 items-center rounded-lg transition-colors ${
      collapsed ? 'justify-center px-2' : nested ? 'gap-3 px-3 py-2.5' : 'gap-3 px-3 py-2.5'
    } ${
      active
        ? 'bg-orange-600 text-white shadow-sm'
        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`}
  >
    {createElement(item.icon, {
      className: `h-5 w-5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`
    })}
    {!collapsed && <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>}
    {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white" />}
  </Link>;
};

const SideBarApp = ({
  collapsed = false,
  onToggle = () => {},
  mobileOpen = false,
  onMobileClose = () => {}
}) => {
  const location = useLocation();
  const { canVisit } = useAuth();
  const visiblePrimary = primaryItems.filter(item => canVisit(item.path));
  const visibleMaster = masterDataItems.filter(item => canVisit(item.path));
  const visibleConfig = configurationItems.filter(item => canVisit(item.path));
  const isMasterDataActive = location.pathname.startsWith('/app/master-data');
  const isConfigActive = location.pathname.startsWith('/app/configuration');
  const [masterDataOpen, setMasterDataOpen] = useState(isMasterDataActive);
  const [configOpen, setConfigOpen] = useState(isConfigActive);

  useEffect(() => {
    if (isMasterDataActive) setMasterDataOpen(true);
  }, [isMasterDataActive]);

  useEffect(() => {
    if (isConfigActive) setConfigOpen(true);
  }, [isConfigActive]);

  const handleSectionToggle = (section) => {
    if (collapsed) {
      onToggle();
      if (section === 'master') setMasterDataOpen(true);
      if (section === 'config') setConfigOpen(true);
      return;
    }
    if (section === 'master') setMasterDataOpen((open) => !open);
    if (section === 'config') setConfigOpen((open) => !open);
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 top-[var(--header-height)] z-30 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close navigation"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`fixed bottom-0 left-0 top-[var(--header-height)] z-40 flex w-72 flex-col border-r border-gray-800 bg-gray-900 text-white shadow-xl transition-[width,transform] duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className={`flex h-12 flex-shrink-0 items-center border-b border-gray-800 ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
          {!collapsed && <span className="text-xs font-semibold uppercase text-gray-500">Navigation</span>}
          <button
            type="button"
            onClick={onToggle}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onMobileClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className={`erp-scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
          <ul className="space-y-1">
            {visiblePrimary.map((item) => (
              <li key={item.path}>
                <NavLink
                  item={item}
                  active={location.pathname === item.path}
                  collapsed={collapsed}
                  onNavigate={onMobileClose}
                />
              </li>
            ))}

            {visibleMaster.length > 0 && <li className="pt-4">
              {!collapsed && (
                <div className="mb-2 flex items-center gap-2 px-2">
                  <div className="h-px flex-1 bg-gray-800" />
                  <span className="text-xs font-semibold uppercase text-gray-500">Master Data</span>
                  <div className="h-px flex-1 bg-gray-800" />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleSectionToggle('master')}
                title={collapsed ? 'Master Data' : undefined}
                className={`flex min-h-10 w-full items-center rounded-lg transition-colors ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'
                } ${
                  isMasterDataActive
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                aria-expanded={!collapsed && masterDataOpen}
              >
                <Database className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm font-semibold">Master Data</span>
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${masterDataOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
              {!collapsed && masterDataOpen && (
                <ul className="mt-1 space-y-1 border-l border-gray-700 pl-2">
                  {visibleMaster.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        item={item}
                        active={location.pathname === item.path}
                        collapsed={false}
                        nested
                        onNavigate={onMobileClose}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>}

            <li className="pt-1">
              <NavLink
                item={{ name: 'Company Profile', path: '/app/company-profile', icon: Building2 }}
                active={location.pathname === '/app/company-profile'}
                collapsed={collapsed}
                onNavigate={onMobileClose}
              />
            </li>

            {visibleConfig.length > 0 && <li className="pt-1">
              <button
                type="button"
                onClick={() => handleSectionToggle('config')}
                title={collapsed ? 'Configuration' : undefined}
                className={`flex min-h-10 w-full items-center rounded-lg transition-colors ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3 py-2.5'
                } ${
                  isConfigActive
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                aria-expanded={!collapsed && configOpen}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm font-semibold">Configuration</span>
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${configOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
              {!collapsed && configOpen && (
                <ul className="mt-1 space-y-1 border-l border-gray-700 pl-2">
                  {visibleConfig.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        item={item}
                        active={location.pathname === item.path}
                        collapsed={false}
                        nested
                        onNavigate={onMobileClose}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>}

            <li className="pt-1">
              <NavLink
                item={{ name: 'Reports', path: '/app/reports', icon: BarChart3 }}
                active={location.pathname === '/app/reports'}
                collapsed={collapsed}
                onNavigate={onMobileClose}
              />
            </li>
          </ul>
        </nav>

        <div className={`flex h-12 flex-shrink-0 items-center border-t border-gray-800 px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {!collapsed && <span className="text-xs text-gray-400">System Online</span>}
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideBarApp;
