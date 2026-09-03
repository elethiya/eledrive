import React from 'react';
import { UploadCloud, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function UploadModal({ uploadStatus, onClose }) {
  if (!uploadStatus) return null;

  const { isUploading, progress, totalFiles, success, error } = uploadStatus;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-80 z-50 animate-in slide-in-from-bottom-5 duration-200 text-slate-100">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            {isUploading && (
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center animate-pulse">
                <UploadCloud className="w-4 h-4" />
              </div>
            )}
            {success && (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            )}
            {error && (
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-slate-100">
                {isUploading ? 'Uploading Items' : success ? 'Upload Complete' : 'Upload Failed'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {totalFiles} {totalFiles === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          {!isUploading && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isUploading && (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-sm shadow-blue-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>Uploading to cloud drive...</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-300 bg-red-950/50 border border-red-500/40 p-2.5 rounded-xl mt-2 font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
