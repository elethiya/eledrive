import React, { useState, useEffect } from 'react';
import { statsAPI, folderAPI, fileAPI } from '../api/client';
import FileCard from '../components/FileCard';
import { Star } from 'lucide-react';

export default function StarredPage({
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
    loadStarred();
  }, []);

  const loadStarred = async () => {
    setLoading(true);
    try {
      const res = await statsAPI.getStarred();
      if (res.data) setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async (item) => {
    try {
      if (item.mime_type === undefined) {
        await folderAPI.toggleStar(item.id);
      } else {
        await fileAPI.toggleStar(item.id);
      }
      loadStarred();
    } catch (e) {
      console.error(e);
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="h-14 px-6 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Starred</span>
        </div>
        <span className="text-xs text-slate-600">Quick access to marked files & folders</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
            Loading starred items...
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
              <Star className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">No starred items</h3>
            <p className="text-xs text-slate-600">
              Click the star icon on any file or folder to find it quickly here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.folders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                  Folders ({data.folders.length})
                </h3>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5'
                      : 'space-y-1.5'
                  }
                >
                  {data.folders.map((sf) => (
                    <FileCard
                      key={sf.id}
                      item={sf}
                      isFolder={true}
                      viewMode={viewMode}
                      onOpen={() => onOpenFolder(sf.id)}
                      onDownload={handleDownload}
                      onShare={(item) => onOpenShare(item, 'folder')}
                      onRename={(item) => onOpenRename(item, true)}
                      onMove={(item) => onOpenMove(item, true)}
                      onToggleStar={handleToggleStar}
                      onShowDetails={(item) => onOpenDetails(item, true)}
                    />
                  ))}
                </div>
              </div>
            )}

            {data.files.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                  Files ({data.files.length})
                </h3>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5'
                      : 'space-y-1.5'
                  }
                >
                  {data.files.map((fl) => (
                    <FileCard
                      key={fl.id}
                      item={fl}
                      isFolder={false}
                      viewMode={viewMode}
                      onOpen={onOpenPreview}
                      onDownload={handleDownload}
                      onShare={(item) => onOpenShare(item, 'file')}
                      onRename={(item) => onOpenRename(item, false)}
                      onMove={(item) => onOpenMove(item, false)}
                      onToggleStar={handleToggleStar}
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
