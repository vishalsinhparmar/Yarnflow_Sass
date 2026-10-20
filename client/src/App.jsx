import { Link, Route, BrowserRouter as Router, Routes, Navigate } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { Landing, SuperAdminLogin, SuperAdminDashboard } from './pages/SaaSPages';
import { useAuth } from './context/AuthContext';
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import PurchaseOrder from "./pages/PurchaseOrder";
import GoodsReceipt from "./pages/GoodsReceipt";
import Inventory from "./pages/Inventory";
import SalesOrder from "./pages/SalesOrder";
import SalesChallan from "./pages/SalesChallan";
import MasterDataDashboard from "./pages/MasterDataDashboard";
import CustomersPage from "./pages/CustomersPage";
import SuppliersPage from "./pages/SuppliersPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import SubProductsPage from "./pages/SubProductsPage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import WarehouseLocationsPage from "./pages/WarehouseLocationsPage";
import UsersPage from "./pages/UsersPage";
import ReportsPage from "./pages/ReportsPage";

const WorkspaceIndex = () => {
  const { homePath } = useAuth();
  return <Navigate to={homePath} replace />;
};

const ConfigurationIndex = () => {
  const { canVisit } = useAuth();
  return <section className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Configuration</h1><p className="mt-2 text-sm text-slate-500">Manage your available company settings.</p><div className="mt-5 flex flex-wrap gap-3">{[['Warehouses', '/app/configuration/warehouses'], ['Users', '/app/configuration/users']].filter(([, path]) => canVisit(path)).map(([label, path]) => <Link key={path} className="rounded-lg border px-5 py-3 font-medium text-orange-600" to={path}>{label}</Link>)}</div></section>;
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" containerStyle={{ top: '5rem', right: '1rem' }} />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/dashboard" element={<Navigate to="/super-admin" replace />} />
          {/* <Route path="/register" element={<Register />} /> */}

          {/* Protected Routes - Main Layout */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Default route - Dashboard */}
            <Route index element={<WorkspaceIndex />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="purchase-order" element={<PurchaseOrder />} />
            <Route path="goods-receipt" element={<GoodsReceipt />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="sales-order" element={<SalesOrder />} />
            <Route path="sales-challan" element={<SalesChallan />} />
            <Route path="master-data" element={<MasterDataDashboard />} />
            <Route path="master-data/customers" element={<CustomersPage />} />
            <Route path="master-data/suppliers" element={<SuppliersPage />} />
            <Route path="master-data/products" element={<ProductsPage />} />
            <Route path="master-data/categories" element={<CategoriesPage />} />
            <Route path="master-data/sub-products" element={<SubProductsPage />} />
            <Route path="company-profile" element={<CompanyProfilePage />} />
            <Route path="configuration" element={<ConfigurationIndex />} />
            <Route path="configuration/warehouses" element={<WarehouseLocationsPage />} />
            <Route path="configuration/users" element={<UsersPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          {/* Test route outside main layout */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
