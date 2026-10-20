import mongoose from 'mongoose';

// Import all reportable models so they are registered in the Mongoose model registry
import '../models/PurchaseOrder.js';
import '../models/GoodsReceiptNote.js';
import '../models/InventoryLot.js';
import '../models/SalesOrder.js';
import '../models/SalesChallan.js';
import '../models/Customer.js';
import '../models/Supplier.js';
import '../models/Product.js';
import '../models/Category.js';
import '../models/WarehouseLocation.js';
import '../models/user.model.js';

import { getReportDefinition, listReportDefinitions } from './report.registry.js';
import SavedReport from './savedReport.model.js';
import { getReferenceOptions } from './report.field-resolver.js';
import { buildPreviewPipeline, buildExportPipeline } from './report.queryBuilder.js';
import { parsePreviewResult } from './report.pagination.js';
import { generateExcelBuffer, generateFilename } from './report.export.service.js';
import { validateReportKey, validatePayload, validatePagination, validateSavedReport, REPORT_EXPORT_LIMIT } from './report.validator.js';

export const getReportsList = () => listReportDefinitions();

export const getReportDefinitionService = (reportKey) => {
  const definition = validateReportKey(reportKey);
  return sanitizeDefinition(definition);
};

const sanitizeDefinition = (definition) => ({
  key: definition.key,
  name: definition.name,
  description: definition.description,
  category: definition.category,
  icon: definition.icon,
  itemArrayPath: definition.itemArrayPath || null,
  defaultFields: definition.defaultFields,
  fields: definition.fields.map(f => ({
    key: f.key,
    label: f.label,
    type: f.type,
    operators: f.operators,
    allowedValues: f.allowedValues || [],
    reference: f.reference || null,
    group: f.group,
    exportable: f.exportable,
    filterable: f.filterable,
    sortable: f.sortable,
    isItemField: f.isItemField || false,
    width: f.width
  }))
});

const getModel = (definition) => mongoose.model(definition.sourceModel);

export const previewReport = async (reportKey, payload, query) => {
  const definition = validateReportKey(reportKey);
  const validated = validatePayload(definition, payload);
  const pagination = validatePagination(query);

  const model = getModel(definition);
  const pipeline = buildPreviewPipeline(definition, validated, pagination);
  const [result] = await model.aggregate(pipeline).allowDiskUse(true);

  const { total, data } = parsePreviewResult(result);
  return {
    reportKey,
    total,
    page: pagination.page,
    limit: pagination.limit,
    data: transformRows(definition, data, validated.selectedFields)
  };
};

export const exportReport = async (reportKey, payload) => {
  const definition = validateReportKey(reportKey);
  const validated = validatePayload(definition, payload);

  const model = getModel(definition);
  const pipeline = buildExportPipeline(definition, validated, REPORT_EXPORT_LIMIT);
  const rows = await model.aggregate(pipeline).allowDiskUse(true);

  const transformed = transformRows(definition, rows, validated.selectedFields);
  const buffer = generateExcelBuffer(definition, validated.selectedFields, transformed, definition.name);
  return { buffer, filename: generateFilename(definition) };
};

export const getLookupOptions = async (reportKey, fieldKey) => {
  return getReferenceOptions(reportKey, fieldKey);
};

const transformRows = (definition, rows, selectedFields) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  if (typeof definition.transform !== 'function') return rows;

  try {
    return definition.transform(rows);
  } catch (err) {
    // If transform fails, return original rows to avoid blocking exports
    return rows;
  }
};

// Saved reports
export const listSavedReports = async (user) => {
  const userId = user?.email || 'System';
  return SavedReport.find({
    $or: [{ createdBy: userId }, { isShared: true }]
  }).sort({ updatedAt: -1 }).lean();
};

export const getSavedReportById = async (id, user) => {
  const userId = user?.email || 'System';
  const report = await SavedReport.findById(id).lean();
  if (!report) {
    const error = new Error('Saved report not found');
    error.status = 404;
    throw error;
  }
  if (report.createdBy !== userId && !report.isShared) {
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }
  return report;
};

export const createSavedReport = async (reportKey, body, user) => {
  const definition = validateReportKey(reportKey || body.reportKey);
  const data = validateSavedReport(definition, body, user);
  const report = new SavedReport(data);
  await report.save();
  return report.toObject();
};

const requireReportOwner = (report, user) => {
  if (report.createdBy !== user.email && user.role !== 'Admin') {
    const error = new Error('Only the report owner or company administrator may modify this report');
    error.status = 403;
    throw error;
  }
};

export const updateSavedReport = async (id, body, user) => {
  const existing = await getSavedReportById(id, user);
  requireReportOwner(existing, user);
  const definition = validateReportKey(existing.reportKey);
  const data = validateSavedReport(definition, body, user);
  const updated = await SavedReport.findByIdAndUpdate(
    id,
    {
      name: data.name,
      config: data.config,
      isShared: body.isShared === true
    },
    { new: true, runValidators: true }
  ).lean();
  return updated;
};

export const deleteSavedReport = async (id, user) => {
  const existing = await getSavedReportById(id, user);
  requireReportOwner(existing, user);
  await SavedReport.findByIdAndDelete(id);
  return { success: true };
};
