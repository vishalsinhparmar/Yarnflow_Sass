import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import NavBarApp from "../components/NavbarApp/NavbarApp";
import SideBarApp from "../components/SideBarApp/SideBarApp";

const Layout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('yarnflow-saas.sidebar-collapsed') === 'true'
  );
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('yarnflow-saas.sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="h-screen overflow-hidden bg-gray-100"
      style={{
        '--sidebar-width': sidebarCollapsed ? '5rem' : '16rem',
        '--header-height': '4rem'
      }}
    >
      <NavBarApp onMobileMenuToggle={() => setMobileNavigationOpen((open) => !open)} />

      <SideBarApp
        collapsed={sidebarCollapsed && !mobileNavigationOpen}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        mobileOpen={mobileNavigationOpen}
        onMobileClose={() => setMobileNavigationOpen(false)}
      />

      <main
        data-erp-main
        className="erp-main-scroll fixed bottom-0 left-0 right-0 top-[var(--header-height)] overflow-y-auto overflow-x-hidden bg-gray-100 transition-[left] duration-200 lg:left-[var(--sidebar-width)]"
      >
        <div className="min-w-0 p-3 sm:p-4 lg:p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
