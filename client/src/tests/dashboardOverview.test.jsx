import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../pages/Dashboard';
import { useDashboard } from '../hooks/useDashboard';

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn()
}));

vi.mock('../services/dashboardAPI', () => ({
  dashboardUtils: {
    formatNumber: (value) => new Intl.NumberFormat('en-IN').format(value),
    getRelativeTime: () => 'just now'
  }
}));

const refreshDashboard = vi.fn();

const dashboardData = {
  summary: {
    totalCustomers: 8,
    totalSuppliers: 4,
    totalCategories: 3,
    totalProducts: 12,
    activePOs: 2,
    openSalesOrders: 3,
    inventoryWeight: 1250
  },
  masterData: {
    customers: 8,
    suppliers: 4,
    categories: 3,
    products: 12
  },
  operations: {
    purchaseOrders: { open: 2, thisMonth: 4, overdue: 1 },
    grns: { total: 6, complete: 5 },
    salesOrders: { open: 3, processing: 2, overdue: 1 },
    challans: { open: 2, dispatched: 1 }
  },
  inventory: {
    activeLots: 9,
    currentWeight: 1250,
    lowStockCount: 1,
    outOfStockCount: 0,
    categoryDistribution: [
      { categoryId: 'cat-1', categoryName: 'Viscose Yarn', weight: 900, quantity: 18, lots: 5 },
      { categoryId: 'cat-2', categoryName: 'Cotton Yarn', weight: 350, quantity: 7, lots: 4 }
    ],
    unitTotals: [
      { unit: 'Bags', quantity: 20, reservedQuantity: 2, weight: 1000 },
      { unit: 'Rolls', quantity: 5, reservedQuantity: 0, weight: 250 }
    ],
    lowStockProducts: [
      { productId: 'p-1', productName: '10 No Panipat', unit: 'Bags', quantity: 3 }
    ],
    outOfStockProducts: []
  },
  monthlyFlow: [
    { month: 'Feb', year: 2026, receivedWeight: 100, dispatchedWeight: 80 },
    { month: 'Mar', year: 2026, receivedWeight: 140, dispatchedWeight: 90 },
    { month: 'Apr', year: 2026, receivedWeight: 120, dispatchedWeight: 110 },
    { month: 'May', year: 2026, receivedWeight: 180, dispatchedWeight: 130 },
    { month: 'Jun', year: 2026, receivedWeight: 210, dispatchedWeight: 160 },
    { month: 'Jul', year: 2026, receivedWeight: 250, dispatchedWeight: 200 }
  ],
  alerts: {
    total: 3,
    overduePurchaseOrders: 1,
    overdueSalesOrders: 1
  },
  recentActivity: [
    {
      id: 'grn-1',
      type: 'grn',
      reference: 'PKRK/GRN/012',
      party: 'Apex International',
      documentStatus: 'Complete',
      timestamp: '2026-07-30T10:00:00.000Z'
    }
  ]
};

const renderDashboard = () => render(
  <MemoryRouter>
    <Dashboard />
  </MemoryRouter>
);

describe('Dashboard operational overview', () => {
  beforeEach(() => {
    refreshDashboard.mockClear();
    useDashboard.mockReturnValue({
      dashboardData,
      realtimeMetrics: {
        alerts: { total: 3 }
      },
      loading: false,
      error: null,
      lastUpdated: new Date('2026-07-30T10:00:00.000Z'),
      refreshDashboard,
      clearError: vi.fn()
    });
  });

  it('renders inventory, movement, pipeline, and exception data from the API', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'YarnFlow Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Inventory by category')).toBeInTheDocument();
    expect(screen.getByText('Viscose Yarn')).toBeInTheDocument();
    expect(screen.getByText('10 No Panipat')).toBeInTheDocument();
    expect(screen.getByText('PKRK/GRN/012')).toBeInTheDocument();
    expect(screen.getByLabelText('Jul received 250 kg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Purchase orders/i })).toHaveAttribute('href', '/app/purchase-order');
  });

  it('refreshes all dashboard sources from the header control', () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    expect(refreshDashboard).toHaveBeenCalledOnce();
  });
});
