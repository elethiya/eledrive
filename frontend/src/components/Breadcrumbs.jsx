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
    <div className="flex items-center justify-between py-3 px-6 bg-slate-900/70 border-b border-slate-800 text-slate-200 shrink-0">
      {/* Path Breadcrumbs */}
      <nav className="flex items-center gap-1.5 overflow-x-auto text-xs">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const isRoot = idx === 0;

          return (
            <React.Fragment key={crumb.id || 'root'}>
              <button
                onClick={() => onNavigate(crumb.id)}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-colors whitespace-nowrap ${
                  isLast
                    ? 'font-bold text-slate-100 bg-slate-800 border border-slate-700 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
                }`}
              >
                {isRoot ? (
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{crumb.name}</span>
              </button>
              {!isLast && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Action Buttons for current folder */}
      {currentFolder && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onShareFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold shadow-xs transition-all"
            title="Share this folder with team or generate public link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Folder</span>
          </button>

          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all"
            title="Download entire folder and subfolders as ZIP"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Download ZIP</span>
          </button>
        </div>
      )}
    </div>
  );
}
