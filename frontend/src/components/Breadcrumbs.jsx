import React from 'react';
import { ChevronRight, Download, Share2, Folder, HardDrive } from 'lucide-react';
import { folderAPI } from '../api/client';

export default function Breadcrumbs({
  breadcrumbs = [],
  currentFolder,
  onNavigate,
  onShareFolder,
}) {
  const handleDownloadZip = () => {
    if (!currentFolder?.id) return;
    const url = folderAPI.getDownloadZipUrl(currentFolder.id);
    window.location.href = url;
  };

  return (
    <div className="flex items-center justify-between py-3 px-6 bg-slate-50/50 border-b border-slate-200/80">
      {/* Path Breadcrumbs */}
      <nav className="flex items-center gap-1.5 overflow-x-auto text-sm">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const isRoot = idx === 0;

          return (
            <React.Fragment key={crumb.id || 'root'}>
              <button
                onClick={() => onNavigate(crumb.id)}
                className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors whitespace-nowrap ${
                  isLast
                    ? 'font-bold text-slate-800 bg-white shadow-xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 font-medium'
                }`}
              >
                {isRoot ? (
                  <HardDrive className="w-4 h-4 text-blue-600" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500" />
                )}
                <span>{crumb.name}</span>
              </button>
              {!isLast && <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Action Buttons for current folder */}
      {currentFolder && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onShareFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-300 rounded-xl text-xs font-semibold shadow-xs transition-all"
            title="Share this folder with team or generate public link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Folder</span>
          </button>

          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all"
            title="Download entire folder and subfolders as ZIP"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download ZIP</span>
          </button>
        </div>
      )}
    </div>
  );
}
