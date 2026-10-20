import { getReportDefinition } from './report.registry.js';
import SavedReport from './savedReport.model.js';
import ReportDownload from './reportDownload.model.js';

const modelModules = {
  PurchaseOrder: 'purchase-orders', GoodsReceiptNote: 'grn', InventoryLot: 'inventory',
  SalesOrder: 'sales-orders', SalesChallan: 'sales-challans', Customer: 'customers',
  Supplier: 'suppliers', Product: 'products', Category: 'categories',
  SubProduct: 'sub-products', WarehouseLocation: 'warehouses', User: 'users'
};

export function canReadModule(req, module) {
  return Boolean(module && req.company?.modules?.includes(module) && req.user?.permissions?.includes(module) && (module !== 'users' || req.user.role === 'Admin'));
}

export function canReadReport(req, key) {
  return canReadModule(req, 'reports') && canReadModule(req, modelModules[getReportDefinition(key)?.sourceModel]);
}

export async function reportAccess(req, res, next) {
  try {
    const [resource, id, action, fieldKey] = req.path.split('/').filter(Boolean);
    if (!resource) return next();
    let key = resource;
    if (resource === 'saved' || resource === 'downloads') {
      if (id) {
        const Model = resource === 'saved' ? SavedReport : ReportDownload;
        const document = await Model.findById(id).select('reportKey').lean();
        if (!document) return res.status(404).json({ success: false, message: 'Report not found' });
        key = document.reportKey;
      } else if (req.method === 'POST') {
        key = req.body?.reportKey;
      } else return next();
    }
    if (!canReadReport(req, key)) return res.status(403).json({ success: false, message: 'Report module access denied' });
    if (id === 'lookup-options') {
      const field = getReportDefinition(key)?.fields.find(item => item.key === action);
      const source = field?.reference || field?.hasLookup;
      if (!canReadModule(req, modelModules[source?.model])) return res.status(403).json({ success: false, message: 'Lookup module access denied' });
    }
    next();
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Report not found' });
    next(error);
  }
}
