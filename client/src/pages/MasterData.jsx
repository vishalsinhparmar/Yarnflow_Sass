import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMasterData } from '../hooks/useMasterData';
import ExcelImportButton from '../components/common/ExcelImportButton';

const CUSTOMER_SAMPLE_HEADERS = ['companyName', 'gstNumber', 'panNumber', 'city', 'notes'];
const CUSTOMER_SAMPLE_DATA = [
  { companyName: 'ABC Textiles Pvt Ltd', gstNumber: '27AABCU9603R1ZM', panNumber: 'AABCU9603R', city: 'Surat', notes: 'Key customer' },
];
const SUPPLIER_SAMPLE_HEADERS = ['companyName', 'gstNumber', 'panNumber', 'city', 'notes'];
const SUPPLIER_SAMPLE_DATA = [
  { companyName: 'Ramesh Yarn Traders', gstNumber: '24AABCR1234A1Z9', panNumber: 'AABCR1234A', city: 'Surat', notes: 'Primary supplier' },
];
const PRODUCT_SAMPLE_HEADERS = ['productName', 'category', 'description', 'subProducts'];
const PRODUCT_SAMPLE_DATA = [
  { productName: '600 Gaze', category: 'LD Category', description: 'LD plastic product', subProducts: '6,8,10,12,14' },
];
const CATEGORY_SAMPLE_HEADERS = ['categoryName', 'description', 'hasSubProducts'];
const CATEGORY_SAMPLE_DATA = [
  { categoryName: 'LD Category', description: 'Plastic LD products with size variants', hasSubProducts: 'true' },
];

const MasterData = () => {
  const navigate = useNavigate();
  const {
    stats,
    customers,
    suppliers,
    categories,
    loading,
    error,
    fetchCustomers,
    fetchSuppliers,
    fetchStats
  } = useMasterData();

  const handleImportSuccess = () => {
    fetchStats();
    fetchCustomers();
    fetchSuppliers();
  };

  if (loading && !stats) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center rounded-lg border border-gray-200 bg-white">
        <div aria-live="polite" className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-orange-600" />
          <p className="text-sm font-medium text-gray-700">Loading master data</p>
          <p className="mt-1 text-xs text-gray-500">Refreshing customers, suppliers, and products.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <span className="text-red-500 text-xl mr-3">⚠️</span>
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
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/app/master-data/customers')} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Manage →</button>
          </div>
        </div>
      </div>

      {/* Master Data Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-xl">👥</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.customers?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Customers</h3>
          <p className="text-sm text-gray-600 mb-3">
            Total customers count
          </p>
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/app/master-data/customers')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Manage Customers
            </button>
            <ExcelImportButton
              type="customers"
              accentColor="blue"
              fullWidth
              sampleHeaders={CUSTOMER_SAMPLE_HEADERS}
              sampleData={CUSTOMER_SAMPLE_DATA}
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl">🏭</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.suppliers?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Suppliers</h3>
          <p className="text-sm text-gray-600 mb-3">
            Total suppliers count
          </p>
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/app/master-data/suppliers')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Manage Suppliers
            </button>
            <ExcelImportButton
              type="suppliers"
              accentColor="purple"
              fullWidth
              sampleHeaders={SUPPLIER_SAMPLE_HEADERS}
              sampleData={SUPPLIER_SAMPLE_DATA}
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-xl">🧶</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.products?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Products</h3>
          <p className="text-sm text-gray-600 mb-3">
            {stats?.products?.lowStock || 0} low stock alerts
          </p>
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/app/master-data/products')}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Manage Products
            </button>
            <ExcelImportButton
              type="products"
              accentColor="green"
              fullWidth
              sampleHeaders={PRODUCT_SAMPLE_HEADERS}
              sampleData={PRODUCT_SAMPLE_DATA}
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 text-xl">📂</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              {stats?.categories?.total || 0}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Categories</h3>
          <p className="text-sm text-gray-600 mb-3">Product categories and classifications</p>
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/app/master-data/categories')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Manage Categories
            </button>
            <ExcelImportButton
              type="categories"
              accentColor="orange"
              fullWidth
              sampleHeaders={CATEGORY_SAMPLE_HEADERS}
              sampleData={CATEGORY_SAMPLE_DATA}
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>
      </div>

      {/* Recent Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
            <button 
              onClick={() => navigate('/app/master-data/customers')}
              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
            >
              View All
            </button>
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
                <button
                  onClick={() => navigate('/app/master-data/customers')}
                  className="text-blue-600 hover:text-blue-900 text-sm mt-2"
                >
                  Add First Customer
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Suppliers</h2>
            <button 
              onClick={() => navigate('/app/master-data/suppliers')}
              className="text-purple-600 hover:text-purple-900 text-sm font-medium"
            >
              View All
            </button>
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
                  <div key={supplier._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-purple-600 font-semibold text-xs">{initials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{supplier.companyName}</p>
                        <p className="text-xs text-gray-500">{supplier.address?.city}, {supplier.address?.state}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-400">Supplier</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">No suppliers found</p>
                <button 
                  onClick={() => navigate('/app/master-data/suppliers')}
                  className="text-purple-600 hover:text-purple-900 text-sm mt-2"
                >
                  Add First Supplier
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Categories */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Product Categories</h2>
          <button 
            onClick={() => navigate('/app/master-data/categories')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Manage Categories
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories && categories.length > 0 ? (
            categories.map((category) => {
              const categoryColors = {
                'Cotton Yarn': 'bg-green-100 text-green-800',
                'Polyester': 'bg-blue-100 text-blue-800',
                'Blended Yarn': 'bg-purple-100 text-purple-800',
                'Raw Material': 'bg-orange-100 text-orange-800',
                'Finished Goods': 'bg-indigo-100 text-indigo-800'
              };
              
              const colorClass = categoryColors[category.categoryType] || 'bg-gray-100 text-gray-800';
              
              return (
                <div key={category._id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{category.categoryName}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${colorClass}`}>
                      {category.categoryType}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {category.description || 'No description available'}
                  </p>
                  
                  {/* Specifications */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Unit:</span>
                      <span className="font-medium">{category.specifications?.unit}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Standard Weight:</span>
                      <span className="font-medium">{category.specifications?.standardWeight} kg</span>
                    </div>
                  </div>
                  
                  {/* Yarn Counts */}
                  {category.specifications?.yarnCount && category.specifications.yarnCount.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Available Counts:</p>
                      <div className="flex flex-wrap gap-1">
                        {category.specifications.yarnCount.slice(0, 4).map((count, index) => (
                          <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {count}
                          </span>
                        ))}
                        {category.specifications.yarnCount.length > 4 && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            +{category.specifications.yarnCount.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Blend Ratio for blended yarns */}
                  {category.specifications?.blendRatio && (
                    <div className="mt-2">
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Blend: {category.specifications.blendRatio}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-3 text-center py-8">
              <p className="text-gray-500 mb-4">No categories found</p>
              <button 
                onClick={() => navigate('/app/master-data/categories')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create First Category
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default MasterData;
