import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Code2, Eye, File, Music } from 'lucide-react';
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
  const extLabel = (file.extension || file.name.split('.').pop() || category || '').replace('.', '').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-8 bg-slate-950 sm:bg-slate-950/80 sm:backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="bg-slate-950 sm:bg-slate-900 rounded-none sm:rounded-3xl max-w-4xl w-full h-full sm:h-[85vh] shadow-none sm:shadow-2xl sm:shadow-black/80 border-0 sm:border border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="h-14 sm:h-16 px-3.5 sm:px-6 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/90 sm:bg-slate-950/60 backdrop-blur-md gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              {category === 'code' ? (
                <Code2 className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : category === 'document' ? (
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : category === 'audio' ? (
                <Music className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
              ) : (
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate leading-snug">{file.name}</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                {formatBytes(file.size)} • <span className="font-mono uppercase font-semibold text-slate-300">{extLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href={downloadUrl}
              download={file.name}
              className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
              title="Download file"
            >
              <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition-colors"
              title="Close preview"
            >
              <X className="w-5 h-5 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-slate-950 text-slate-100 overflow-auto flex items-center justify-center relative">
          {loading && (
            <div className="text-center text-slate-400 text-xs">Loading preview...</div>
          )}

          {error && (
            <div className="text-center text-red-400 text-xs p-4 sm:p-6 max-w-md">
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
                <div className="w-full h-full p-2.5 sm:p-4 overflow-auto bg-slate-950 text-slate-200 font-mono text-[11px] sm:text-xs leading-relaxed selection:bg-blue-600 selection:text-white">
                  <pre className="whitespace-pre min-w-full">
                    {previewData.content.split('\n').map((line, idx) => (
                      <div key={idx} className="table-row hover:bg-slate-900/60">
                        <span className="table-cell select-none pr-3 sm:pr-4 text-slate-600 text-right w-8 sm:w-10 text-[10px] sm:text-xs shrink-0">
                          {idx + 1}
                        </span>
                        <span className="table-cell break-all sm:break-normal">{line || ' '}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              )}

              {/* Image Preview */}
              {category === 'image' && (
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
                  <img
                    src={inlineUrl}
                    alt={file.name}
                    className="max-h-[calc(100vh-4.5rem)] sm:max-h-[70vh] max-w-full object-contain rounded-sm sm:rounded-lg shadow-xl"
                  />
                </div>
              )}

              {/* Video Preview */}
              {category === 'video' && (
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
                  <video
                    src={inlineUrl}
                    controls
                    autoPlay={false}
                    className="max-h-[calc(100vh-4.5rem)] sm:max-h-[70vh] max-w-full rounded-xl shadow-2xl"
                  />
                </div>
              )}

              {/* Audio Preview */}
              {category === 'audio' && (
                <div className="p-6 sm:p-8 bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center gap-3 sm:gap-4 max-w-sm w-full mx-4">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-1">
                    <Music className="w-8 h-8" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-white truncate max-w-full text-center">{file.name}</p>
                  <audio src={inlineUrl} controls className="w-full max-w-xs" />
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
                  <div className="text-center p-4 sm:p-8 max-w-sm mx-auto">
                    <File className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600 mx-auto mb-3" />
                    <h4 className="text-xs sm:text-sm font-bold text-white mb-1">No instant preview for this file type</h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 mb-4">
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
