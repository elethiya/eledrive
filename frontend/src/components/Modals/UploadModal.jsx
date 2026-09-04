import React from 'react';
import { UploadCloud, DownloadCloud, CheckCircle, AlertCircle, X, Zap } from 'lucide-react';
import { formatBytes, formatSpeed } from '../../utils/formatters';

function formatETA(loaded, total, speed) {
  if (!speed || speed <= 0 || !total || total <= loaded) return null;
  const remainingBytes = total - loaded;
  const sec = Math.ceil(remainingBytes / speed);
  if (sec < 60) return `${sec}s left`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${mins}m ${remSec}s left`;
}

export default function UploadModal({
  uploadStatus,
  downloadStatus,
  onClose,
  onCloseUpload,
  onCloseDownload,
}) {
  if (!uploadStatus && !downloadStatus) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-50 flex flex-col gap-2.5 animate-in slide-in-from-bottom-5 duration-200 text-slate-100 pointer-events-none">
      {/* Upload Card */}
      {uploadStatus && (
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {uploadStatus.isUploading && (
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center animate-pulse shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
              )}
              {uploadStatus.success && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
              )}
              {uploadStatus.error && (
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-100 truncate">
                  {uploadStatus.isUploading
                    ? `Uploading ${uploadStatus.totalFiles} ${uploadStatus.totalFiles === 1 ? 'item' : 'items'}`
                    : uploadStatus.success
                    ? 'Upload Complete'
                    : 'Upload Failed'}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {uploadStatus.totalBytes > 0
                    ? `${formatBytes(uploadStatus.loadedBytes || 0)} of ${formatBytes(uploadStatus.totalBytes)}`
                    : `${uploadStatus.totalFiles || 1} ${uploadStatus.totalFiles === 1 ? 'file' : 'files'}`}
                </p>
              </div>
            </div>

            {!uploadStatus.isUploading && (
              <button
                onClick={onCloseUpload || onClose}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress bar and speed metrics */}
          {uploadStatus.isUploading && (
            <div className="space-y-2">
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300 shadow-xs shadow-blue-500/50"
                  style={{ width: `${Math.min(100, Math.max(0, uploadStatus.progress || 0))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5 text-blue-400 font-mono">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{formatSpeed(uploadStatus.speed || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {formatETA(uploadStatus.loadedBytes, uploadStatus.totalBytes, uploadStatus.speed) && (
                    <span className="text-slate-500 font-mono">
                      {formatETA(uploadStatus.loadedBytes, uploadStatus.totalBytes, uploadStatus.speed)}
                    </span>
                  )}
                  <span className="font-bold text-slate-200 font-mono">{uploadStatus.progress || 0}%</span>
                </div>
              </div>
            </div>
          )}

          {uploadStatus.error && (
            <p className="text-xs text-red-300 bg-red-950/50 border border-red-500/40 p-2.5 rounded-xl font-medium">
              {uploadStatus.error}
            </p>
          )}
        </div>
      )}

      {/* Download Card */}
      {downloadStatus && (
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {downloadStatus.isDownloading && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse shrink-0">
                  <DownloadCloud className="w-4 h-4" />
                </div>
              )}
              {downloadStatus.success && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
              )}
              {downloadStatus.error && (
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-100 truncate">
                  {downloadStatus.isDownloading
                    ? 'Downloading File'
                    : downloadStatus.success
                    ? 'Download Complete'
                    : 'Download Failed'}
                </h4>
                <p className="text-[11px] text-slate-400 truncate max-w-[210px]" title={downloadStatus.name}>
                  {downloadStatus.name}
                  {downloadStatus.totalBytes > 0 && ` • ${formatBytes(downloadStatus.totalBytes)}`}
                </p>
              </div>
            </div>

            {!downloadStatus.isDownloading && (
              <button
                onClick={onCloseDownload || onClose}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress bar and speed metrics */}
          {downloadStatus.isDownloading && (
            <div className="space-y-2">
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-xs shadow-emerald-500/50"
                  style={{ width: `${Math.min(100, Math.max(0, downloadStatus.progress || 0))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{formatSpeed(downloadStatus.speed || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono">
                    {formatBytes(downloadStatus.loadedBytes || 0)}
                    {downloadStatus.totalBytes > 0 && ` / ${formatBytes(downloadStatus.totalBytes)}`}
                  </span>
                  {formatETA(downloadStatus.loadedBytes, downloadStatus.totalBytes, downloadStatus.speed) && (
                    <span className="text-slate-500 font-mono">
                      ({formatETA(downloadStatus.loadedBytes, downloadStatus.totalBytes, downloadStatus.speed)})
                    </span>
                  )}
                  {downloadStatus.totalBytes > 0 && (
                    <span className="font-bold text-slate-200 font-mono">{downloadStatus.progress || 0}%</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {downloadStatus.error && (
            <p className="text-xs text-red-300 bg-red-950/50 border border-red-500/40 p-2.5 rounded-xl font-medium">
              {downloadStatus.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

