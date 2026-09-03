import React, { useState, useEffect } from 'react';
import { statsAPI, fileAPI } from '../api/client';
import FileCard from '../components/FileCard';
import { Clock } from 'lucide-react';

export default function RecentPage({
  viewMode,
  onOpenPreview,
  onOpenShare,
  onOpenRename,
  onOpenMove,
  onOpenDetails,
}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecent();
  }, []);

  const loadRecent = async () => {
    setLoading(true);
    try {
      const res = await statsAPI.getRecent();
      if (res.data) setFiles(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (item) => {
    window.location.href = fileAPI.getDownloadUrl(item.id);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="h-14 px-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-xs">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>Recent Files</span>
        </div>
        <span className="text-xs text-slate-400">Files opened or uploaded recently</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
            Loading recent files...
          </div>
        ) : files.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-blue-400 flex items-center justify-center mb-4 shadow-xl">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">No recent activity</h3>
            <p className="text-xs text-slate-400">Files you upload or edit will appear here.</p>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5'
                : 'space-y-1.5'
            }
          >
            {files.map((fl) => (
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
                onShowDetails={(item) => onOpenDetails(item, false)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
