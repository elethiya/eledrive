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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl shadow-black/80 border border-slate-800 p-4 sm:p-6 animate-in zoom-in-95 duration-150 text-slate-100 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-md shadow-blue-500/10">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Item Details</h3>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-[240px]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3.5 text-xs text-slate-300 relative z-10">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <FileType className="w-3.5 h-3.5" /> Type
            </span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px] text-right">{isFolder ? 'Folder' : item.mime_type || item.extension}</span>
          </div>

          {!isFolder && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> Size
              </span>
              <span className="font-semibold text-slate-200 font-mono">{formatBytes(item.size)}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Owner
            </span>
            <div className="text-right truncate max-w-[200px]">
              <span className="font-semibold text-slate-200 block truncate">{item.owner_name || item.owner_email || 'You'}</span>
              {(item.owner_username || (item.owner_name && item.owner_email)) && (
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  {item.owner_username ? `@${item.owner_username}` : item.owner_email}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Created
            </span>
            <span className="font-semibold text-slate-200 font-mono text-[11px]">{formatDate(item.created_at)}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Modified
            </span>
            <span className="font-semibold text-slate-200 font-mono text-[11px]">{formatDate(item.updated_at)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 pt-4 mt-5 border-t border-slate-800 relative z-10">
          <button
            onClick={handleDownload}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isFolder ? 'Download ZIP' : 'Download'}</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
