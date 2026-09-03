import React, { useState, useEffect } from 'react';
import { statsAPI, folderAPI, fileAPI } from '../api/client';
import { useRealtimeEvent } from '../context/RealtimeContext';
import FileCard from '../components/FileCard';
import { Star, RefreshCw } from 'lucide-react';

export default function StarredPage({
  onOpenFolder,
  onOpenPreview,
  onOpenShare,
  onOpenRename,
  onOpenMove,
  onOpenDetails,
}) {
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadStarred();
  }, []);

  // Real-time Event Subscription for Starred items
  useRealtimeEvent(['file', 'folder', 'sync'], () => {
    loadStarred();
  });

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="h-14 px-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-xs">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>Starred</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">Quick access to marked files & folders</span>
          <button
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await loadStarred();
              } finally {
                setTimeout(() => setIsRefreshing(false), 600);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-xl text-xs font-semibold transition-all group disabled:opacity-60 shadow-xs"
            title="Refresh starred items"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isRefreshing ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
            Loading starred items...
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-amber-400 flex items-center justify-center mb-4 shadow-xl">
              <Star className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">No starred items</h3>
            <p className="text-xs text-slate-400">
              Click the star icon on any file or folder to find it quickly here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="hidden sm:flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none bg-slate-900/30 rounded-xl">
              <span className="flex-1">Name</span>
              <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                <span className="w-20 sm:w-24 text-right">Size</span>
                <span className="w-24 sm:w-28 text-right hidden md:inline">Modified</span>
                <span className="w-20 text-right pr-2">Actions</span>
              </div>
            </div>

            {data.folders.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Folders ({data.folders.length})
                </h3>
                <div className="space-y-1">
                  {data.folders.map((sf) => (
                    <FileCard
                      key={sf.id}
                      item={sf}
                      isFolder={true}
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
              <div className="space-y-1.5 pt-2">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Files ({data.files.length})
                </h3>
                <div className="space-y-1">
                  {data.files.map((fl) => (
                    <FileCard
                      key={fl.id}
                      item={fl}
                      isFolder={false}
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
