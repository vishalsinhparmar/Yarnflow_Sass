import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock all external API services before any imports
vi.mock('../services/authAPI', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    verifyToken: vi.fn()
  }
}));

vi.mock('../services/dashboardAPI', () => ({
  dashboardUtils: {
    getRelativeTime: vi.fn(() => 'just now'),
    formatCurrency: vi.fn((v) => `₹${v}`),
    formatNumber: vi.fn((v) => String(v))
  },
  dashboardAPI: {
    getStats: vi.fn(() => Promise.resolve({ data: {} })),
    getRealtimeMetrics: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn(() => ({
    dashboardData: null,
    realtimeMetrics: null,
    loading: true,
    error: null,
    lastUpdated: null,
    refreshDashboard: vi.fn(),
    clearError: vi.fn()
  }))
}));

vi.mock('../services/purchaseOrderAPI', () => ({
  purchaseOrderAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [], pagination: {} })),
    getStats: vi.fn(() => Promise.resolve({ data: {} }))
  },
  poUtils: {}
}));

vi.mock('../services/grnAPI', () => ({
  grnAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [], pagination: {} })),
    getStats: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

vi.mock('../services/salesOrderAPI', () => ({
  salesOrderAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [], pagination: {} })),
    getStats: vi.fn(() => Promise.resolve({ data: {} }))
  },
  soUtils: {}
}));

vi.mock('../services/salesChallanAPI', () => ({
  salesChallanAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [], pagination: {} })),
    getStats: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

vi.mock('../services/inventoryAPI', () => ({
  inventoryAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
    getStats: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

vi.mock('../services/warehouseAPI', () => ({
  warehouseAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [] }))
  }
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // Keep real AuthProvider but mock authAPI so verifyToken never resolves (loading stays false)
  };
});

// Import components AFTER mocks
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import PurchaseOrder from '../pages/PurchaseOrder';
import { AuthProvider } from '../context/AuthContext';

// Wrapper: Router + AuthProvider (authAPI.verifyToken is mocked so no network calls)
const WithRouter = ({ children, path = '/' }) => (
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      {children}
    </AuthProvider>
  </MemoryRouter>
);

describe('🎨 YarnFlow Client Components Production Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  describe('🔐 Login Page', () => {

    it('✅ renders brand name, email field, password field and submit button', () => {
      render(<WithRouter><Login /></WithRouter>);

      expect(screen.getByText('YarnFlow')).toBeInTheDocument();
      expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in to dashboard/i })).toBeInTheDocument();
    });

    it('✅ password field has type=password (not exposed in DOM)', () => {
      render(<WithRouter><Login /></WithRouter>);
      const pwd = screen.getByLabelText(/^password$/i);
      expect(pwd).toHaveAttribute('type', 'password');
    });

    it('✅ show/hide password toggle changes field type', () => {
      render(<WithRouter><Login /></WithRouter>);
      const pwd = screen.getByLabelText(/^password$/i);
      expect(pwd).toHaveAttribute('type', 'password');

      // The toggle button sits inside the password field wrapper
      const toggle = pwd.closest('div').querySelector('button[type="button"]');
      fireEvent.click(toggle);
      expect(pwd).toHaveAttribute('type', 'text');

      fireEvent.click(toggle);
      expect(pwd).toHaveAttribute('type', 'password');
    });

    it('✅ remember me checkbox is present', () => {
      render(<WithRouter><Login /></WithRouter>);
      expect(screen.getByLabelText(/remember my email/i)).toBeInTheDocument();
    });

    it('✅ company registration link is available', () => {
      render(<WithRouter><Login /></WithRouter>);
      expect(screen.getByRole('link', { name: /register your company/i })).toHaveAttribute('href', '/register');
    });

    it('✅ XSS payload in email field does not execute script', () => {
      render(<WithRouter><Login /></WithRouter>);
      const emailInput = screen.getByLabelText(/email or username/i);
      const xss = '<script>window.__xss=1</script>';
      fireEvent.change(emailInput, { target: { value: xss } });
      expect(emailInput.value).toBe(xss);
      expect(window.__xss).toBeUndefined();
    });

    it('✅ email field has correct HTML type', () => {
      render(<WithRouter><Login /></WithRouter>);
      expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText(/company code or name/i)).toBeRequired();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('📊 Dashboard', () => {

    it('✅ shows loading spinner while fetching', () => {
      // useDashboard mock returns loading:true by default
      render(<WithRouter><Dashboard /></WithRouter>);
      expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
    });

    it('✅ shows error + retry button when useDashboard returns error', async () => {
      const { useDashboard } = await import('../hooks/useDashboard');
      useDashboard.mockReturnValueOnce({
        dashboardData: null,
        loading: false,
        error: 'Failed to fetch',
        realtimeMetrics: null,
        lastUpdated: null,
        refreshDashboard: vi.fn(),
        clearError: vi.fn()
      });

      render(<WithRouter><Dashboard /></WithRouter>);
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('✅ renders dashboard content when data is available', async () => {
      const { useDashboard } = await import('../hooks/useDashboard');
      useDashboard.mockReturnValueOnce({
        dashboardData: {
          summary: { totalPOs: 5, totalGRNs: 3, totalSOs: 8, inventoryBags: 200 },
          recentActivity: []
        },
        loading: false,
        error: null,
        realtimeMetrics: null,
        lastUpdated: new Date(),
        refreshDashboard: vi.fn(),
        clearError: vi.fn()
      });

      render(<WithRouter><Dashboard /></WithRouter>);
      expect(screen.getByText(/yarnflow dashboard/i)).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('🛒 Purchase Order Page', () => {

    it('✅ renders page heading and New PO button', async () => {
      render(<WithRouter><PurchaseOrder /></WithRouter>);
      await waitFor(() => {
        expect(screen.getByText(/purchase orders \(po\)/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /new po/i })).toBeInTheDocument();
    });

    it('✅ search input accepts text', async () => {
      render(<WithRouter><PurchaseOrder /></WithRouter>);
      await waitFor(() => expect(screen.getByPlaceholderText(/search pos/i)).toBeInTheDocument());

      const search = screen.getByPlaceholderText(/search pos/i);
      fireEvent.change(search, { target: { value: 'PKRK/PO/001' } });
      expect(search.value).toBe('PKRK/PO/001');
    });

    it('✅ status filter select is present', async () => {
      render(<WithRouter><PurchaseOrder /></WithRouter>);
      await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('✅ shows empty state when no POs returned', async () => {
      render(<WithRouter><PurchaseOrder /></WithRouter>);
      await waitFor(() => {
        // Empty state shows "No purchase orders found" or "Create your first"
        const empty = screen.queryByText(/no purchase orders/i) ||
                      screen.queryByText(/create your first/i);
        expect(empty).toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('🔒 Security', () => {

    it('✅ auth context: isAuthenticated is false without token', async () => {
      const { AuthProvider, useAuth } = await import('../context/AuthContext');
      // authAPI.verifyToken is already mocked to vi.fn() (returns undefined = throws)
      // So AuthProvider will clear token and set user=null

      const TestConsumer = () => {
        const { isAuthenticated } = useAuth();
        return <div data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</div>;
      };

      render(
        <WithRouter>
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        </WithRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth')).toHaveTextContent('no');
      });
    });

    it('✅ ProtectedRoute redirects unauthenticated users', async () => {
      const ProtectedRouteModule = await import('../components/ProtectedRoute/ProtectedRoute');
      const ProtectedRoute = ProtectedRouteModule.default;
      const { AuthProvider } = await import('../context/AuthContext');

      render(
        <MemoryRouter initialEntries={['/app/dashboard']}>
          <AuthProvider>
            <ProtectedRoute>
              <div>Secret Content</div>
            </ProtectedRoute>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('🧩 Service Layer', () => {

    it('✅ common.js apiRequest attaches Bearer token from localStorage', async () => {
      const { apiRequest } = await import('../services/common');

      global.localStorage.getItem = vi.fn((key) => key === 'yarnflow-saas.tenant.token' ? 'test-jwt' : null);
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
      );

      await apiRequest('/test-endpoint');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt'
          })
        })
      );
    });

    it('✅ common.js apiRequest throws on non-ok response', async () => {
      const { apiRequest } = await import('../services/common');

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Unauthorized' })
        })
      );

      await expect(apiRequest('/secured')).rejects.toThrow(
        'Session expired. Please log in again.'
      );
    });

    it('✅ common.js apiRequest handles JSON parse failure gracefully', async () => {
      const { apiRequest } = await import('../services/common');

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('invalid json'))
        })
      );

      const result = await apiRequest('/empty-response');
      expect(result).toEqual({});
    });
  });
});
