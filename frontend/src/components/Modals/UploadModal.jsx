import React from 'react';
import { UploadCloud, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function UploadModal({ uploadStatus, onClose }) {
  if (!uploadStatus) return null;

  const { isUploading, progress, totalFiles, success, error } = uploadStatus;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-4">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2.5">
            {isUploading && (
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse">
                <UploadCloud className="w-4 h-4" />
              </div>
            )}
            {success && (
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            )}
            {error && (
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                {isUploading ? 'Uploading Items' : success ? 'Upload Complete' : 'Upload Failed'}
              </h4>
              <p className="text-[11px] text-slate-600">
                {totalFiles} {totalFiles === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          {!isUploading && (
            <button
              onClick={onClose}
              className="p-1 text-slate-600 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isUploading && (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 font-medium">
              <span>Uploading to cloud...</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded-xl mt-2 font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
