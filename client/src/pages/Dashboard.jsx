import { createElement } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  Clock3,
  Factory,
  FolderOpen,
  Loader2,
  PackageCheck,
  RefreshCw,
  Scale,
  ShoppingCart,
  Truck,
  Users,
  Warehouse
} from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { dashboardUtils } from '../services/dashboardAPI';

const number = (value) => dashboardUtils.formatNumber(Number(value) || 0);
const weight = (value) => `${number(Math.round((Number(value) || 0) * 100) / 100)} kg`;

const DashboardLoadingState = () => (
  <div aria-live="polite" className="space-y-5">
    <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
      <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
      Loading dashboard
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-lg border border-gray-200 bg-white" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="h-80 animate-pulse rounded-lg border border-gray-200 bg-white xl:col-span-3" />
      <div className="h-80 animate-pulse rounded-lg border border-gray-200 bg-white xl:col-span-2" />
    </div>
  </div>
);

const MetricCard = ({ icon, label, value, detail, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    red: 'bg-red-50 text-red-700 border-red-100'
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}>
          {createElement(icon, { 'aria-hidden': true, className: 'h-5 w-5' })}
        </div>
      </div>
    </div>
  );
};

const InventoryCategoryChart = ({ categories }) => {
  const maxWeight = Math.max(...categories.map((item) => Number(item.weight) || 0), 1);

  return (
    <div className="space-y-4">
      {categories.length > 0 ? categories.map((item) => {
        const percentage = Math.max(2, ((Number(item.weight) || 0) / maxWeight) * 100);
        return (
          <div key={item.categoryId || item.categoryName}>
            <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
              <span className="truncate font-medium text-gray-800">{item.categoryName}</span>
              <span className="flex-shrink-0 font-semibold text-gray-950">{weight(item.weight)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {number(item.lots)} lots · {number(item.quantity)} units on hand
            </p>
          </div>
        );
      }) : (
        <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
          No active inventory by category
        </div>
      )}
    </div>
  );
};

const MonthlyFlowChart = ({ rows }) => {
  const maxWeight = Math.max(
    ...rows.flatMap((row) => [Number(row.receivedWeight) || 0, Number(row.dispatchedWeight) || 0]),
    1
  );

  return (
    <div>
      <div className="mb-5 flex items-center gap-5 text-xs text-gray-600">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-600" />
          Received
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-orange-600" />
          Dispatched
        </span>
      </div>
      <div className="grid h-52 grid-cols-6 gap-2 border-b border-gray-200 sm:gap-4">
        {rows.map((row) => {
          const receivedHeight = Math.max(2, ((Number(row.receivedWeight) || 0) / maxWeight) * 100);
          const dispatchedHeight = Math.max(2, ((Number(row.dispatchedWeight) || 0) / maxWeight) * 100);
          return (
            <div key={`${row.month}-${row.year}`} className="flex min-w-0 flex-col">
              <div className="flex min-h-0 flex-1 items-end justify-center gap-1">
                <div
                  aria-label={`${row.month} received ${weight(row.receivedWeight)}`}
                  className="w-3 min-w-0 rounded-t-sm bg-green-600 sm:w-5"
                  style={{ height: `${receivedHeight}%` }}
                  title={`${row.month}: ${weight(row.receivedWeight)} received`}
                />
                <div
                  aria-label={`${row.month} dispatched ${weight(row.dispatchedWeight)}`}
                  className="w-3 min-w-0 rounded-t-sm bg-orange-600 sm:w-5"
                  style={{ height: `${dispatchedHeight}%` }}
                  title={`${row.month}: ${weight(row.dispatchedWeight)} dispatched`}
                />
              </div>
              <span className="py-2 text-center text-xs font-medium text-gray-500">{row.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PipelineStage = ({ icon, label, value, detail, to }) => (
  <Link
    className="group flex min-w-0 items-center gap-3 px-4 py-4 transition-colors hover:bg-gray-50"
    to={to}
  >
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
      {createElement(icon, { 'aria-hidden': true, className: 'h-4.5 w-4.5' })}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-semibold uppercase text-gray-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold text-gray-950">{number(value)}</span>
        <span className="truncate text-xs text-gray-500">{detail}</span>
      </div>
    </div>
    <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600" />
  </Link>
);

const activityMeta = {
  purchase_order: { icon: ShoppingCart, className: 'bg-blue-50 text-blue-700' },
  grn: { icon: ClipboardCheck, className: 'bg-green-50 text-green-700' },
  sales_order: { icon: PackageCheck, className: 'bg-violet-50 text-violet-700' },
  sales_challan: { icon: Truck, className: 'bg-orange-50 text-orange-700' }
};

const Dashboard = () => {
  const {
    dashboardData,
    realtimeMetrics,
    loading,
    error,
    lastUpdated,
    refreshDashboard,
    clearError
  } = useDashboard(true);

  if (loading && !dashboardData) return <DashboardLoadingState />;

  if (error && !dashboardData) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h1 className="font-semibold text-red-900">Error loading dashboard</h1>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            onClick={() => {
              clearError();
              refreshDashboard();
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = dashboardData?.summary || {};
  const masterData = dashboardData?.masterData || {};
  const operations = dashboardData?.operations || {};
  const inventory = dashboardData?.inventory || {};
  const alerts = dashboardData?.alerts || {};
  const recentActivity = dashboardData?.recentActivity || [];
  const monthlyFlow = dashboardData?.monthlyFlow || [];
  const categoryDistribution = inventory.categoryDistribution || [];
  const unitTotals = inventory.unitTotals || [];
  const lowStockProducts = inventory.lowStockProducts || [];
  const outOfStockProducts = inventory.outOfStockProducts || [];
  const realtimeAlerts = realtimeMetrics?.alerts?.total;

  return (
    <div className="space-y-5 pb-4">
      <header className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-950">YarnFlow Dashboard</h1>
            <span className="flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Live
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Inventory, Purchase & Sales Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock3 className="h-3.5 w-3.5" />
              Updated {dashboardUtils.getRelativeTime(lastUpdated)}
            </span>
          )}
          <button
            aria-label="Refresh dashboard"
            className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={refreshDashboard}
            title="Refresh dashboard"
            type="button"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          // detail={`${number(inventory.activeLots)}`}
          icon={Scale}
          label="Total Stock Available"
          tone="blue"
          value={weight(inventory.currentWeight ?? summary.inventoryWeight)}
        />
        <MetricCard
          detail={`${number(inventory.outOfStockCount)} products out of stock`}
          icon={AlertTriangle}
          label="Low stock products"
          tone="red"
          value={number(inventory.lowStockCount ?? summary.lowStockItems)}
        />
        <MetricCard
          detail={`${number(operations.purchaseOrders?.overdue)} (overdue)`}
          icon={ShoppingCart}
          label="Pending Purchase Orders"
          tone="orange"
          value={number(operations.purchaseOrders?.open ?? summary.activePOs)}
        />
        <MetricCard
          detail={`${number(operations.salesOrders?.overdue)} (overdue)`}
          icon={PackageCheck}
          label="Pending sales orders"
          tone="green"
          value={number(operations.salesOrders?.open ?? summary.openSalesOrders)}
        />
      </section>

      <section aria-labelledby="pipeline-heading" className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 id="pipeline-heading" className="text-sm font-semibold text-gray-900">Business Workflow</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-gray-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <PipelineStage
            detail={`${number(operations.purchaseOrders?.thisMonth)} Created This Month`}
            icon={ShoppingCart}
            label="Purchase orders"
            to="/app/purchase-order"
            value={operations.purchaseOrders?.open}
          />
          <PipelineStage
            detail={`${number(operations.grns?.complete)} complete`}
            icon={ClipboardCheck}
            label="Goods receipts"
            to="/app/goods-receipt"
            value={operations.grns?.total}
          />
          <PipelineStage
            detail={`${number(operations.salesOrders?.processing)} processing`}
            icon={PackageCheck}
            label="Sales orders"
            to="/app/sales-order"
            value={operations.salesOrders?.open}
          />
          <PipelineStage
            detail={`${number(operations.challans?.dispatched)} in transit`}
            icon={Truck}
            label="Sales challans"
            to="/app/sales-challan"
            value={operations.challans?.open}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <section aria-labelledby="category-heading" className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="category-heading" className="text-base font-semibold text-gray-950">Inventory by category</h2>
              <p className="mt-1 text-xs text-gray-500">Available stock by category</p>
            </div>
            <Warehouse className="h-5 w-5 text-blue-600" />
          </div>
          <InventoryCategoryChart categories={categoryDistribution} />
        </section>

        <section aria-labelledby="unit-heading" className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 id="unit-heading" className="text-base font-semibold text-gray-950">Stock by unit</h2>
              <p className="mt-1 text-xs text-gray-500">Available stock by unit</p>
            </div>
            <Boxes className="h-5 w-5 text-green-600" />
          </div>
          {unitTotals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Unit</th>
                    <th className="px-3 py-3 text-right font-semibold">Available</th>
                    <th className="px-3 py-3 text-right font-semibold">Reserved</th>
                    <th className="px-5 py-3 text-right font-semibold">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unitTotals.map((unit) => (
                    <tr key={unit.unit}>
                      <td className="px-5 py-3 font-semibold text-gray-900">{unit.unit}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{number(unit.quantity)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{number(unit.reservedQuantity)}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{weight(unit.weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
              No active stock units
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <section aria-labelledby="movement-heading" className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4">
            <h2 id="movement-heading" className="text-base font-semibold text-gray-950">Stock movement</h2>
            <p className="mt-1 text-xs text-gray-500">Stock received and dispatched during the last 6 months</p>
          </div>
          {monthlyFlow.length > 0 ? (
            <MonthlyFlowChart rows={monthlyFlow} />
          ) : (
            <div className="flex h-52 items-center justify-center text-sm text-gray-500">
              No movement history available
            </div>
          )}
        </section>

        <section aria-labelledby="attention-heading" className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 id="attention-heading" className="text-base font-semibold text-gray-950">Needs attention</h2>
              <p className="mt-1 text-xs text-gray-500">Items that need your attention</p>
            </div>
            <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
              {number(realtimeAlerts ?? alerts.total)}
            </span>
          </div>
          <div className="grid grid-cols-2 border-b border-gray-200">
            <div className="border-r border-gray-200 px-5 py-3">
              <p className="text-xs text-gray-500">Overdue PO</p>
              <p className="mt-1 text-lg font-bold text-gray-950">{number(alerts.overduePurchaseOrders)}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs text-gray-500">Overdue SO</p>
              <p className="mt-1 text-lg font-bold text-gray-950">{number(alerts.overdueSalesOrders)}</p>
            </div>
          </div>
          <div className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
            {lowStockProducts.map((product) => (
              <div key={`low-${product.productId}-${product.unit}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-orange-700">Low stock</p>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-gray-900">
                  {number(product.quantity)} {product.unit}
                </span>
              </div>
            ))}
            {outOfStockProducts.map((product) => (
              <div key={`out-${product.productId}-${product.unit}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{product.productName}</p>
                  <p className="text-xs text-red-700">Out of stock</p>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-red-700">0 {product.unit}</span>
              </div>
            ))}
            {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                No inventory exceptions
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <section aria-labelledby="activity-heading" className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm xl:col-span-3">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 id="activity-heading" className="text-base font-semibold text-gray-950">Recent Business Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.length > 0 ? recentActivity.map((activity) => {
              const meta = activityMeta[activity.type] || activityMeta.purchase_order;
              const Icon = meta.icon;
              return (
                <div key={activity.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{activity.reference}</p>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                        {activity.documentStatus}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {activity.party || activity.title}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-500">
                    {dashboardUtils.getRelativeTime(activity.timestamp)}
                  </span>
                </div>
              );
            }) : (
              <div className="px-5 py-10 text-center text-sm text-gray-500">No recent activity</div>
            )}
          </div>
        </section>

        <section aria-labelledby="master-heading" className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 id="master-heading" className="text-base font-semibold text-gray-950">Master data</h2>
          <p className="mt-1 text-xs text-gray-500">Active ERP catalog records</p>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200">
            {[
              { label: 'Products', value: masterData.products ?? summary.totalProducts, icon: Boxes },
              { label: 'Categories', value: masterData.categories ?? summary.totalCategories, icon: FolderOpen },
              { label: 'Suppliers', value: masterData.suppliers ?? summary.totalSuppliers, icon: Factory },
              { label: 'Customers', value: masterData.customers ?? summary.totalCustomers, icon: Users }
            ].map((item) => (
              <div key={item.label} className="bg-white p-4">
                <item.icon className="h-4 w-4 text-gray-500" />
                <p className="mt-3 text-xl font-bold text-gray-950">{number(item.value)}</p>
                <p className="mt-1 text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
          <Link
            className="mt-4 flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            to="/app/master-data"
          >
            Open master data
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
