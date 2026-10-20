import { useMasterData } from '../hooks/useMasterData';
import { Link } from 'react-router-dom';
import { Users, Factory, Boxes, FolderOpen, GitBranch, AlertTriangle, Loader2 } from 'lucide-react';
import ExcelImportButton from '../components/common/ExcelImportButton';

const CUSTOMER_SAMPLE_HEADERS = ['companyName', 'gstNumber', 'panNumber', 'city', 'notes'];
const CUSTOMER_SAMPLE_DATA = [{ companyName: 'ABC Textiles Pvt Ltd', gstNumber: '27AABCU9603R1ZM', panNumber: 'AABCU9603R', city: 'Surat', notes: 'Key customer' }];
const SUPPLIER_SAMPLE_HEADERS = ['companyName', 'gstNumber', 'panNumber', 'city', 'notes'];
const SUPPLIER_SAMPLE_DATA = [{ companyName: 'Ramesh Yarn Traders', gstNumber: '24AABCR1234A1Z9', panNumber: 'AABCR1234A', city: 'Surat', notes: 'Primary supplier' }];
const PRODUCT_SAMPLE_HEADERS = ['productName', 'category', 'description', 'subProducts'];
const PRODUCT_SAMPLE_DATA = [{ productName: '600 Gaze', category: 'LD Category', description: 'LD plastic product', subProducts: '6,8,10,12,14' }];
const CATEGORY_SAMPLE_HEADERS = ['categoryName', 'description', 'hasSubProducts'];
const CATEGORY_SAMPLE_DATA = [{ categoryName: 'LD Category', description: 'Plastic LD products with size variants', hasSubProducts: 'true' }];

const MasterDataDashboard = () => {
  const {
    stats,
    customers,
    suppliers,
    categories,
    loading,
    error,
    fetchStats,
    fetchCustomers,
    fetchSuppliers
  } = useMasterData();

  const handleImportSuccess = () => {
    fetchStats();
    fetchCustomers();
    fetchSuppliers();
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-700 font-medium text-lg">Loading Master Data...</p>
          <p className="text-gray-500 text-sm mt-2">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertTriangle className="text-red-500 w-6 h-6 mr-3" />
          <div>
            <h3 className="text-red-800 font-semibold">Error Loading Data</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Master Data Management</h1>
            <p className="text-gray-600">Manage customers, suppliers, products, and categories</p>
          </div>
        </div>
      </div>

      {/* Master Data Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600 w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.customers?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Customers</h3>
          <div className="space-y-2">
            <Link to="/app/master-data/customers" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center block">
              Manage Customers
            </Link>
            <ExcelImportButton type="customers" accentColor="blue" fullWidth sampleHeaders={CUSTOMER_SAMPLE_HEADERS} sampleData={CUSTOMER_SAMPLE_DATA} onImportSuccess={handleImportSuccess} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Factory className="text-purple-600 w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.suppliers?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Suppliers</h3>
          <div className="space-y-2">
            <Link to="/app/master-data/suppliers" className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center block">
              Manage Suppliers
            </Link>
            <ExcelImportButton type="suppliers" accentColor="purple" fullWidth sampleHeaders={SUPPLIER_SAMPLE_HEADERS} sampleData={SUPPLIER_SAMPLE_DATA} onImportSuccess={handleImportSuccess} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Boxes className="text-green-600 w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.products?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Products</h3>
          <div className="space-y-2">
            <Link to="/app/master-data/products" className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center block">
              Manage Products
            </Link>
            <ExcelImportButton type="products" accentColor="green" fullWidth sampleHeaders={PRODUCT_SAMPLE_HEADERS} sampleData={PRODUCT_SAMPLE_DATA} onImportSuccess={handleImportSuccess} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="text-orange-600 w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.categories?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Categories</h3>
          <div className="space-y-2">
            <Link to="/app/master-data/categories" className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center block">
              Manage Categories
            </Link>
            <ExcelImportButton type="categories" accentColor="orange" fullWidth sampleHeaders={CATEGORY_SAMPLE_HEADERS} sampleData={CATEGORY_SAMPLE_DATA} onImportSuccess={handleImportSuccess} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
              <GitBranch className="text-pink-600 w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.subProducts?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sub-Products</h3>
          <div className="space-y-2">
            <Link to="/app/master-data/sub-products" className="w-full bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center block">
              Manage Sub-Products
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
            <Link 
              to="/app/master-data/customers"
              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {customers && customers.length > 0 ? (
              customers.slice(0, 3).map((customer) => {
                const initials = customer.companyName
                  .split(' ')
                  .map(word => word[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
                
                return (
                  <div key={customer._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-semibold text-xs">{initials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{customer.companyName}</p>
                        <p className="text-xs text-gray-500">
                          {customer.address?.city}, {customer.address?.state}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">No customers found</p>
                <Link to="/app/master-data/customers" className="text-blue-600 hover:text-blue-900 text-sm mt-2 block">
                  Add First Customer
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Suppliers</h2>
            <Link 
              to="/app/master-data/suppliers"
              className="text-purple-600 hover:text-purple-900 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {suppliers && suppliers.length > 0 ? (
              suppliers.slice(0, 3).map((supplier) => {
                const initials = supplier.companyName
                  .split(' ')
                  .map(word => word[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
                
                return (
                  <div key={supplier._id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-purple-600 font-semibold text-xs">{initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{supplier.companyName}</p>
                      <p className="text-xs text-gray-500">{supplier.city || supplier.address?.city || ''}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">No suppliers found</p>
                <Link 
                  to="/app/master-data/suppliers"
                  className="text-purple-600 hover:text-purple-900 text-sm mt-2 block"
                >
                  Add First Supplier
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Categories Preview */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Product Categories</h2>
          <Link 
            to="/app/master-data/categories"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Manage Categories
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories && categories.length > 0 ? (
            categories.slice(0, 3).map((category) => {
              return (
                <div key={category._id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{category.categoryName}</h3>
                    {category.hasSubProducts && (
                      <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">Sub Products</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {category.description || 'No description available'}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="col-span-3 text-center py-8">
              <p className="text-gray-500 mb-4">No categories found</p>
              <Link 
                to="/app/master-data/categories"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-block"
              >
                Create First Category
              </Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default MasterDataDashboard;
