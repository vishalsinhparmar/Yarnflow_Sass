import express from 'express';
import {
  listReports,
  getDefinition,
  preview,
  exportExcel,
  exportPDF,
  lookupOptions,
  savedReportsList,
  savedReportDetail,
  createSaved,
  updateSaved,
  deleteSaved,
  listDownloads,
  createDownload,
  downloadFile,
  deleteDownload,
  clearDownloads
} from './report.controller.js';

import { reportAccess } from './report.access.js';

const router = express.Router();
router.use(reportAccess);

// Saved report CRUD — must come before dynamic :reportKey routes
router.get('/saved', savedReportsList);
router.get('/saved/:id', savedReportDetail);
router.post('/saved', createSaved);
router.put('/saved/:id', updateSaved);
router.delete('/saved/:id', deleteSaved);

// Download tracking CRUD — must come before catch-all routes
router.get('/downloads', listDownloads);
router.get('/downloads/:id/file', downloadFile);
router.post('/downloads', createDownload);
router.delete('/downloads/:id', deleteDownload);
router.delete('/downloads', clearDownloads);

// List and definition routes
router.get('/', listReports);
router.get('/:reportKey/definition', getDefinition);
router.get('/:reportKey/lookup-options/:fieldKey', lookupOptions);

// Preview and export routes
router.post('/:reportKey/preview', preview);
router.post('/:reportKey/export', exportExcel);
router.post('/:reportKey/export-pdf', exportPDF);

// Create saved report with reportKey in URL (must come last)
router.post('/:reportKey/saved', createSaved);

export default router;
