import React, { useState, useEffect } from 'react';
import { shareAPI, folderAPI, fileAPI } from '../api/client';
import FileCard from '../components/FileCard';
import { Users } from 'lucide-react';

export default function SharedWithMePage({
  viewMode,
  onOpenFolder,
  onOpenPreview,
  onOpenShare,
  onOpenRename,
  onOpenMove,
  onOpenDetails,
}) {
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShared();
  }, []);

  const loadShared = async () => {
    setLoading(true);
    try {
      const res = await shareAPI.getSharedWithMe();
      if (res.data) {
        setData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenItem = (item) => {
    if (item.mime_type === undefined) {
      onOpenFolder(item.id);
    } else {
      onOpenPreview(item);
    }
  };

  const handleDownload = (item) => {
    if (item.mime_type === undefined) {
      window.location.href = folderAPI.getDownloadZipUrl(item.id);
    } else {
      window.location.href = fileAPI.getDownloadUrl(item.id);
    }
  };

  const isEmpty = data.folders.length === 0 && data.files.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="h-14 px-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-xs">
          <Users className="w-4 h-4 text-blue-400" />
          <span>Shared with me</span>
        </div>
        <span className="text-xs text-slate-400">
          Items teammates have shared with you
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
            Loading shared items...
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center mb-4 shadow-xl">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">No shared files yet</h3>
            <p className="text-xs text-slate-400">
              When a team member shares a folder, project, or file with you, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.folders.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Shared Folders ({data.folders.length})
                </h3>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5'
                      : 'space-y-1.5'
                  }
                >
                  {data.folders.map((sf) => (
                    <FileCard
                      key={sf.id}
                      item={sf}
                      isFolder={true}
                      viewMode={viewMode}
                      onOpen={handleOpenItem}
                      onDownload={handleDownload}
                      onShare={(item) => onOpenShare(item, 'folder')}
                      onRename={(item) => onOpenRename(item, true)}
                      onMove={(item) => onOpenMove(item, true)}
                      onShowDetails={(item) => onOpenDetails(item, true)}
                    />
                  ))}
                </div>
              </div>
            )}

            {data.files.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Shared Files ({data.files.length})
                </h3>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5'
                      : 'space-y-1.5'
                  }
                >
                  {data.files.map((fl) => (
                    <FileCard
                      key={fl.id}
                      item={fl}
                      isFolder={false}
                      viewMode={viewMode}
                      onOpen={handleOpenItem}
                      onDownload={handleDownload}
                      onShare={(item) => onOpenShare(item, 'file')}
                      onRename={(item) => onOpenRename(item, false)}
                      onMove={(item) => onOpenMove(item, false)}
                      onShowDetails={(item) => onOpenDetails(item, false)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
