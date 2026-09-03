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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Item Details</h3>
              <p className="text-xs text-slate-600 truncate max-w-[240px]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-600 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3.5 text-xs text-slate-700">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <FileType className="w-3.5 h-3.5" /> Type
            </span>
            <span className="font-semibold">{isFolder ? 'Folder' : item.mime_type || item.extension}</span>
          </div>

          {!isFolder && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-600 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> Size
              </span>
              <span className="font-semibold">{formatBytes(item.size)}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Owner
            </span>
            <span className="font-semibold">{item.owner_name || item.owner_email || 'You'}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Created
            </span>
            <span className="font-semibold">{formatDate(item.created_at)}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Modified
            </span>
            <span className="font-semibold">{formatDate(item.updated_at)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 pt-4 mt-5 border-t border-slate-100">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isFolder ? 'Download ZIP' : 'Download File'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
