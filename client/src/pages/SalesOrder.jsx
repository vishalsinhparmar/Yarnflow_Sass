import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, CheckCircle, FileEdit, Plus, Search, Eye, Trash2, XCircle } from 'lucide-react';
import { salesOrderAPI, salesOrderUtils } from '../services/salesOrderAPI';
import NewSalesOrderModal from '../components/SalesOrders/NewSalesOrderModal';
import SalesOrderDetailModal from '../components/SalesOrders/SalesOrderDetailModal';

const SalesOrder = () => {
  const navigate = useNavigate();
  
  // State management
  const [salesOrders, setSalesOrders] = useState([]);
  const [salesOrderStats, setSalesOrderStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Filter and pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch sales orders
  const fetchSalesOrders = async (page = currentPage, search = searchTerm, status = statusFilter) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        search,
        status
      };
      
      const response = await salesOrderAPI.getAll(params);
      setSalesOrders(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalCount(response.pagination?.totalCount || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching sales orders:', err);
      setError('Failed to fetch sales orders');
      setSalesOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await salesOrderAPI.getStats();
      setSalesOrderStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Initial data fetch and re-fetch on filter/page change
  useEffect(() => {
    fetchSalesOrders(currentPage, searchTerm, statusFilter);
    fetchStats();
  }, [currentPage, searchTerm, statusFilter]);

  // Handle order actions
  const handleOrderAction = async (action, order) => {
    try {
      switch (action) {
        case 'view':
          setSelectedOrder(order);
          setShowDetailModal(true);
          break;
        case 'edit':
          setSelectedOrder(order);
          setShowNewOrderModal(true);
          break;
        case 'cancel':
          if (confirm('Are you sure you want to cancel this order?')) {
            await salesOrderAPI.cancel(order._id, { 
              cancellationReason: 'Cancelled by admin',
              cancelledBy: 'Admin'
            });
            await fetchSalesOrders();
            await fetchStats();
            alert('Order cancelled successfully');
          }
          break;
        case 'delete':
          if (confirm('Are you sure you want to permanently delete this cancelled order? This action cannot be undone.')) {
            await salesOrderAPI.delete(order._id);
            await fetchSalesOrders();
            await fetchStats();
            alert('Order deleted successfully');
          }
          break;
        case 'createChallan':
          // Navigate to sales-challan page with SO pre-selected
          navigate('/app/sales-challan', { state: { selectedSalesOrderId: order._id, openCreateModal: true } });
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error performing action:', err);
      alert('Failed to perform action');
    }
  };

  // Handle modal close and refresh
  const handleModalClose = () => {
    setShowNewOrderModal(false);
    setShowDetailModal(false);
    setSelectedOrder(null);
    setCurrentPage(1);
    fetchSalesOrders(1, searchTerm, statusFilter);
    fetchStats();
  };

  return (
    <div className="space-y-6">
      {/* Compact Header with Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Orders (SO)</h1>
                <p className="text-sm text-gray-600">Manage and track customer orders</p>
              </div>
            </div>
            <button 
              onClick={() => setShowNewOrderModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Sales Order
            </button>
          </div>

          {/* Compact Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total SOs</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {salesOrderStats?.overview?.totalOrders || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Delivered</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {salesOrderStats?.statusBreakdown?.find(s => s._id === 'Delivered')?.count || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Draft</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {salesOrderStats?.statusBreakdown?.find(s => s._id === 'Draft')?.count || 0}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                  <FileEdit className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search orders, customers, SO numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === '' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('Draft')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === 'Draft' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setStatusFilter('Delivered')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === 'Delivered' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Delivered
            </button>
            <button
              onClick={() => setStatusFilter('Cancelled')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === 'Cancelled' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancelled
            </button>
          </div>
        </div>
      </div>

      {/* Sales Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sales Orders</h2>
          {!loading && salesOrders.length > 0 && totalCount > 0 && (
            <span className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{totalCount}</span> total orders
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="bg-white p-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 rounded-full mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
            <p className="text-lg font-medium text-gray-700">Loading sales orders...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we fetch your data</p>
          </div>
        ) : error ? (
          <div className="bg-white p-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-50 rounded-full mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <p className="text-lg font-medium text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => fetchSalesOrders(currentPage, searchTerm, statusFilter)}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {salesOrders && salesOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SO Number</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Delivery Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {salesOrders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 flex items-center justify-center">
                              {order.status !== 'Delivered' && order.status !== 'Cancelled' && order.status !== 'Returned' && (
                                <button
                                  onClick={() => handleOrderAction('createChallan', order)}
                                  className="group relative p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                                  title="Create Sales Challan"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span className="absolute left-8 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    + Create Challan
                                  </span>
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <ShoppingCart className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="text-sm font-semibold text-gray-900">{order.soNumber}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{order.customerDetails?.companyName || order.customer?.companyName || 'Unknown Customer'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700">
                            {order.category?.categoryName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700 font-medium">{salesOrderUtils.formatDate(order.orderDate)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700 font-medium">{salesOrderUtils.formatDate(order.expectedDeliveryDate)}</div>
                          {salesOrderUtils.isOverdue(order.expectedDeliveryDate, order.status) && (
                            <div className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                              <XCircle className="w-3 h-3" />
                              Overdue
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-lg ${salesOrderUtils.getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOrderAction('view', order)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-medium rounded-lg transition-all shadow-sm"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            {order.status === 'Draft' && (
                              <button
                                onClick={() => handleOrderAction('edit', order)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-xs font-medium rounded-lg transition-all shadow-sm"
                                title="Edit"
                              >
                                <FileEdit className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            )}
                            {order.status !== 'Cancelled' && order.status !== 'Delivered' && (
                              <button
                                onClick={() => handleOrderAction('cancel', order)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium rounded-lg transition-all"
                                title="Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            )}
                            {order.status === 'Cancelled' && (
                              <button
                                onClick={() => handleOrderAction('delete', order)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-all"
                                title="Delete Permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-full mb-6">
                  <ShoppingCart className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-lg font-medium text-gray-700 mb-2">No sales orders found</p>
                <p className="text-sm text-gray-500 mb-6">Create your first sales order to get started</p>
                <button 
                  onClick={() => setShowNewOrderModal(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  New Sales Order
                </button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-5 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * 10) + 1}</span> to{' '}
                    <span className="font-semibold text-gray-900">{Math.min(currentPage * 10, ((currentPage - 1) * 10) + salesOrders.length)}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalCount}</span> Sales Orders
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    <span className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold shadow-sm">
                      {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showNewOrderModal && (
        <NewSalesOrderModal
          isOpen={showNewOrderModal}
          onClose={handleModalClose}
          order={selectedOrder}
        />
      )}

      {showDetailModal && selectedOrder && (
        <SalesOrderDetailModal
          isOpen={showDetailModal}
          onClose={handleModalClose}
          order={selectedOrder}
        />
      )}

    </div>
  );
};

export default SalesOrder;
