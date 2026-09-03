import React from 'react';
import { X, Info, Download, HardDrive, Calendar, User, FileType } from 'lucide-react';
import { formatBytes, formatDate } from '../../utils/formatters';
import { fileAPI, folderAPI } from '../../api/client';

export default function DetailsModal({ isOpen, onClose, item, isFolder }) {
  if (!isOpen || !item) return null;

  const handleDownload = () => {
    if (isFolder) {
      window.location.href = folderAPI.getDownloadZipUrl(item.id);
    } else {
      window.location.href = fileAPI.getDownloadUrl(item.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-800 p-4 sm:p-6 animate-in zoom-in-95 duration-150 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Item Details</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3.5 text-xs text-slate-300">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <FileType className="w-3.5 h-3.5" /> Type
            </span>
            <span className="font-semibold text-slate-200">{isFolder ? 'Folder' : item.mime_type || item.extension}</span>
          </div>

          {!isFolder && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> Size
              </span>
              <span className="font-semibold text-slate-200">{formatBytes(item.size)}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Owner
            </span>
            <span className="font-semibold text-slate-200">{item.owner_name || item.owner_email || 'You'}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Created
            </span>
            <span className="font-semibold text-slate-200">{formatDate(item.created_at)}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Modified
            </span>
            <span className="font-semibold text-slate-200">{formatDate(item.updated_at)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 pt-4 mt-5 border-t border-slate-800">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isFolder ? 'Download ZIP' : 'Download File'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
