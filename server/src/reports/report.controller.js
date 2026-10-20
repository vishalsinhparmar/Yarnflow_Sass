import {
  getReportsList,
  getReportDefinitionService,
  previewReport,
  exportReport,
  getLookupOptions,
  listSavedReports,
  getSavedReportById,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport
} from './report.service.js';
import { sendExcel } from './report.export.service.js';
import { generateReportPDF } from '../utils/reportPdfGenerator.js';
import { canReadReport } from './report.access.js';

export const listReports = async (req, res) => {
  try {
    const reports = getReportsList().filter(report => canReadReport(req, report.key));
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDefinition = async (req, res) => {
  try {
    const definition = getReportDefinitionService(req.params.reportKey);
    res.json({ success: true, data: definition });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const preview = async (req, res) => {
  try {
    const result = await previewReport(req.params.reportKey, req.body, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const exportExcel = async (req, res) => {
  try {
    const { buffer, filename } = await exportReport(req.params.reportKey, req.body);
    sendExcel(res, buffer, filename);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const exportPDF = async (req, res) => {
  try {
    const { buffer, filename } = await generateReportPDF(req.params.reportKey, req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const lookupOptions = async (req, res) => {
  try {
    const options = await getLookupOptions(req.params.reportKey, req.params.fieldKey);
    res.json({ success: true, data: options });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const savedReportsList = async (req, res) => {
  try {
    const reports = (await listSavedReports(req.user)).filter(report => canReadReport(req, report.reportKey));
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const savedReportDetail = async (req, res) => {
  try {
    const report = await getSavedReportById(req.params.id, req.user);
    res.json({ success: true, data: report });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const createSaved = async (req, res) => {
  try {
    const report = await createSavedReport(req.params.reportKey, req.body, req.user);
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const updateSaved = async (req, res) => {
  try {
    const report = await updateSavedReport(req.params.id, req.body, req.user);
    res.json({ success: true, data: report });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const deleteSaved = async (req, res) => {
  try {
    const result = await deleteSavedReport(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// Download tracking endpoints
import ReportDownload from './reportDownload.model.js';

export const listDownloads = async (req, res) => {
  try {
    const userEmail = req.user?.email || 'System';
    const downloads = await ReportDownload.find({ createdBy: userEmail })
      .sort({ generatedAt: -1 })
      .lean();
    res.json({ success: true, data: downloads.filter(download => canReadReport(req, download.reportKey)) });
  } catch (err) {
    console.error('Error listing downloads:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createDownload = async (req, res) => {
  try {
    const { reportName, reportKey, dateRange, filename, fileData } = req.body;
    
    if (!reportName || !reportKey || !filename) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const userEmail = req.user?.email || 'System';
    
    // Convert base64 fileData to Buffer if provided
    let fileBuffer = null;
    if (fileData) {
      try {
        fileBuffer = Buffer.from(fileData, 'base64');
      } catch (err) {
        console.error('Error converting file data:', err);
      }
    }

    const download = new ReportDownload({
      reportName,
      reportKey,
      dateRange: dateRange || '',
      filename,
      fileData: fileBuffer,
      createdBy: userEmail
    });

    await download.save();
    res.status(201).json({ success: true, data: { _id: download._id, reportName, reportKey, dateRange, filename, generatedAt: download.generatedAt } });
  } catch (err) {
    console.error('Error creating download:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Download ID is required' });
    }

    const userEmail = req.user?.email || 'System';
    const download = await ReportDownload.findOne({
      _id: id,
      createdBy: userEmail
    });

    if (!download) {
      return res.status(404).json({ success: false, message: 'Download not found' });
    }

    if (!download.fileData) {
      return res.status(404).json({ success: false, message: 'File data not available' });
    }

    // Send file as attachment
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
    res.send(download.fileData);
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteDownload = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ success: false, message: 'Download ID is required' });
    }

    const userEmail = req.user?.email || 'System';
    const download = await ReportDownload.findOneAndDelete({
      _id: id,
      createdBy: userEmail
    });

    if (!download) {
      return res.status(404).json({ success: false, message: 'Download not found' });
    }

    res.json({ success: true, data: download });
  } catch (err) {
    console.error('Error deleting download:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const clearDownloads = async (req, res) => {
  try {
    const userEmail = req.user?.email || 'System';
    const result = await ReportDownload.deleteMany({ createdBy: userEmail });
    res.json({ success: true, data: { deletedCount: result.deletedCount } });
  } catch (err) {
    console.error('Error clearing downloads:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
