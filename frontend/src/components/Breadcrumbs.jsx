import React from 'react';
import { ChevronRight, Download, Folder, HardDrive } from 'lucide-react';
import { folderAPI } from '../api/client';

export default function Breadcrumbs({
  breadcrumbs = [],
  currentFolder,
  onNavigate,
}) {
  const handleDownloadZip = () => {
    if (!currentFolder?.id) return;
    const url = folderAPI.getDownloadZipUrl(currentFolder.id);
    window.location.href = url;
  };

  return (
    <div className="flex items-center justify-between py-2.5 px-4 sm:px-6 bg-slate-900/70 border-b border-slate-800 text-slate-200 shrink-0 gap-2">
      {/* Path Breadcrumbs */}
      <nav className="flex items-center gap-1 overflow-x-auto text-xs py-0.5 min-w-0 flex-1">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const isRoot = idx === 0;

          return (
            <React.Fragment key={crumb.id || 'root'}>
              <button
                onClick={() => onNavigate(crumb.id)}
                className={`flex items-center gap-1.5 py-1 px-2 sm:px-2.5 rounded-lg transition-colors whitespace-nowrap text-xs ${
                  isLast
                    ? 'font-bold text-slate-100 bg-slate-800 border border-slate-700 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                }`}
              >
                {isRoot ? (
                  <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="truncate max-w-[120px] sm:max-w-none">{crumb.name}</span>
              </button>
              {!isLast && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Action Buttons for current folder */}
      {currentFolder && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleDownloadZip}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all"
            title="Download folder as ZIP"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">ZIP</span>
          </button>
        </div>
      )}
    </div>
  );
}
