import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Code2, Eye, File } from 'lucide-react';
import { fileAPI } from '../../api/client';
import { formatBytes, getFileTypeCategory } from '../../utils/formatters';

export default function PreviewModal({ isOpen, onClose, file }) {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && file) {
      setLoading(true);
      setError(null);
      setPreviewData(null);

      const category = getFileTypeCategory(file.mime_type, file.extension);

      if (category === 'code' || file.mime_type?.startsWith('text/')) {
        fileAPI
          .getPreview(file.id)
          .then((res) => {
            if (res.data) setPreviewData(res.data);
          })
          .catch((err) => {
            setError(err.message);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const category = getFileTypeCategory(file.mime_type, file.extension);
  const downloadUrl = fileAPI.getDownloadUrl(file.id, false);
  const inlineUrl = fileAPI.getDownloadUrl(file.id, true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-8 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl max-w-4xl w-full h-[92vh] sm:h-[85vh] shadow-2xl shadow-black/80 border border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2.5 sm:gap-3 truncate pr-2 sm:pr-4">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              {category === 'code' ? (
                <Code2 className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : category === 'document' ? (
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div className="truncate">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{file.name}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400">
                {formatBytes(file.size)} • {file.mime_type || 'Unknown type'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href={downloadUrl}
              download={file.name}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-slate-950 text-slate-100 overflow-auto flex items-center justify-center relative">
          {loading && (
            <div className="text-center text-slate-400 text-xs">Loading preview...</div>
          )}

          {error && (
            <div className="text-center text-red-400 text-xs p-6 max-w-md">
              <p className="font-semibold mb-1">Preview unavailable</p>
              <p className="text-[11px] text-slate-400 mb-4">{error}</p>
              <a
                href={downloadUrl}
                download={file.name}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
              >
                Download to view
              </a>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Code / Text Preview */}
              {(category === 'code' || file.mime_type?.startsWith('text/')) && previewData && (
                <div className="w-full h-full p-4 overflow-auto bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed selection:bg-blue-600 selection:text-white">
                  <pre className="whitespace-pre">
                    {previewData.content.split('\n').map((line, idx) => (
                      <div key={idx} className="table-row hover:bg-slate-900/60">
                        <span className="table-cell select-none pr-4 text-slate-600 text-right w-10">
                          {idx + 1}
                        </span>
                        <span className="table-cell">{line || ' '}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              )}

              {/* Image Preview */}
              {category === 'image' && (
                <div className="p-4 max-h-full flex items-center justify-center">
                  <img
                    src={inlineUrl}
                    alt={file.name}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              )}

              {/* Video Preview */}
              {category === 'video' && (
                <video
                  src={inlineUrl}
                  controls
                  autoPlay={false}
                  className="max-h-[70vh] max-w-full rounded-xl shadow-2xl"
                />
              )}

              {/* Audio Preview */}
              {category === 'audio' && (
                <div className="p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center gap-4">
                  <p className="text-sm font-semibold text-white">{file.name}</p>
                  <audio src={inlineUrl} controls className="w-80" />
                </div>
              )}

              {/* PDF Preview */}
              {category === 'pdf' && (
                <iframe
                  src={inlineUrl}
                  title={file.name}
                  className="w-full h-full border-0 bg-slate-900"
                />
              )}

              {/* Generic non-previewable */}
              {category !== 'code' &&
                category !== 'image' &&
                category !== 'video' &&
                category !== 'audio' &&
                category !== 'pdf' &&
                !file.mime_type?.startsWith('text/') && (
                  <div className="text-center p-8">
                    <File className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-white mb-1">No instant preview for this file type</h4>
                    <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                      Download the file to open it with your system's native application.
                    </p>
                    <a
                      href={downloadUrl}
                      download={file.name}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      Download File
                    </a>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
