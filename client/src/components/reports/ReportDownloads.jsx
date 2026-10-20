import { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, Calendar, FileText } from 'lucide-react';
import { setGlobalDownloadsSetter, setGlobalDownloads } from './reportDownloadsManager';

export default function ReportDownloads() {
  const [downloads, setDownloads] = useState([]);

  // Initialize global setter
  useEffect(() => {
    setGlobalDownloadsSetter(setDownloads);
    return () => setGlobalDownloadsSetter(null);
  }, []);

  // Load downloads from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('yarnflow-saas.tenant.reportDownloads');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setGlobalDownloads(parsed);
        setDownloads(parsed);
      } catch {
        setDownloads([]);
      }
    }
  }, []);

  // Save downloads to localStorage
  const saveDownloads = useCallback((newDownloads) => {
    setGlobalDownloads(newDownloads);
    setDownloads(newDownloads);
    localStorage.setItem('yarnflow-saas.tenant.reportDownloads', JSON.stringify(newDownloads));
  }, []);

  const removeDownload = useCallback((id) => {
    saveDownloads(downloads.filter(d => d.id !== id));
  }, [downloads, saveDownloads]);

  const downloadAgain = useCallback((download) => {
    // Create a link to re-download
    // In production, this would fetch from server
    const link = document.createElement('a');
    link.href = download.blobUrl || '#';
    link.download = download.filename || 'report.xlsx';
    if (download.blobUrl) {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-900 text-base">Report Downloads</h3>
        {downloads.length > 0 && (
          <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
            {downloads.length} file{downloads.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {downloads.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No reports downloaded yet.</p>
      ) : (
        <div className="space-y-2 max-h-[20rem] overflow-y-auto">
          {downloads.map((download) => (
            <div
              key={download.id}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FileText className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={download.reportName}>
                  {download.reportName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {download.module} • {download.dateRange}
                </p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {download.generatedAt}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => downloadAgain(download)}
                  className="p-1.5 rounded hover:bg-orange-50 text-orange-600 hover:text-orange-700"
                  title="Download again"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeDownload(download.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {downloads.length > 0 && (
        <button
          onClick={() => saveDownloads([])}
          className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700 py-2 rounded-lg hover:bg-gray-50"
        >
          Clear history
        </button>
      )}
    </div>
  );
}

