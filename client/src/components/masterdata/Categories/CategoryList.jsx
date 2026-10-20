import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Loader2, Search, Layers, ArrowRight } from 'lucide-react';
import { categoryAPI, handleAPIError } from '../../../services/masterDataAPI';
import Pagination from '../../common/Pagination';
import SimpleDeleteModal from '../../common/SimpleDeleteModal';
import useToast from '../../../hooks/useToast';

const CategoryList = ({ onEdit, onRefresh, refreshTrigger }) => {
  const navigate = useNavigate();
  const { categoryToasts } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, category: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch categories
  const fetchCategories = async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = {
        page,
        limit: itemsPerPage
      };
      
      if (searchTerm) queryParams.search = searchTerm;
      
      const response = await categoryAPI.getAll(queryParams);
      
      if (response.success) {
        setCategories(response.data);
        setPagination(response.pagination);
      }
    } catch (err) {
      setError(handleAPIError(err, 'Failed to fetch categories'));
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchCategories(newPage);
  };

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
    fetchCategories(1);
  }, [searchTerm]);

  // Refresh when trigger changes
  useEffect(() => {
    fetchCategories(currentPage);
  }, [refreshTrigger]);

  // Handle delete category
  const handleDeleteClick = (category) => {
    setDeleteModal({ isOpen: true, category });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.category) return;
    
    try {
      setDeleteLoading(true);
      const response = await categoryAPI.delete(deleteModal.category._id);
      if (response.success) {
        categoryToasts.deleteSuccess(deleteModal.category.categoryName);
        setDeleteModal({ isOpen: false, category: null });
        fetchCategories();
        onRefresh?.();
      }
    } catch (err) {
      categoryToasts.deleteError();
      setError(handleAPIError(err, 'Failed to delete category'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, category: null });
  };


  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex justify-between items-center">
        <div className="flex-1 max-w-md relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search categories by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 text-orange-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-700 font-medium text-lg">Loading categories...</p>
          <p className="text-gray-500 text-sm mt-1">Please wait while we fetch the data</p>
        </div>
      )}

      {/* Categories Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.length > 0 ? (
            categories.map((category, index) => (
              <div key={category._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-orange-300 transition-all bg-white">
                {/* Category Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      #{(pagination.current - 1) * itemsPerPage + index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900 truncate">
                      {category.categoryName}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-3">
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {category.description || 'No description available'}
                  </p>
                </div>

                {/* Sub Products Badge */}
                {category.hasSubProducts && (
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                      <Layers className="w-3 h-3" />
                      Has Sub Products
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t gap-2">
                  <button
                    onClick={() => navigate(`/app/master-data/products?category=${category._id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors flex-1 justify-center"
                    title="View products in this category"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    View Products
                  </button>
                  <button
                    onClick={() => onEdit(category)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
                    title="Edit category"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(category)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-8">
              <div className="text-gray-500 mb-4">
                <span className="text-4xl">📂</span>
                <p className="mt-2">No categories found</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && categories.length > 0 && (
        <Pagination
          currentPage={pagination.current}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={handlePageChange}
          itemsPerPage={itemsPerPage}
        />
      )}

      {/* Delete Confirmation Modal */}
      <SimpleDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteModal.category?.categoryName}
        loading={deleteLoading}
      />
    </div>
  );
};

export default CategoryList;
