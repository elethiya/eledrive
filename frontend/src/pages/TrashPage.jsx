import React, { useState, useEffect } from 'react';
import { statsAPI, folderAPI, fileAPI } from '../api/client';
import { Trash2, RotateCcw, AlertTriangle, Folder, File, RefreshCw } from 'lucide-react';
import { formatBytes, formatDate } from '../utils/formatters';

import { useConfirm } from '../context/ConfirmContext';
import { useRealtimeEvent } from '../context/RealtimeContext';

export default function TrashPage() {
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    loadTrash();
  }, []);

  // Real-time Event Subscription for Trash
  useRealtimeEvent(['trash', 'file', 'folder', 'sync'], () => {
    loadTrash(false);
  });

  const loadTrash = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await statsAPI.getTrash();
      if (res.data) setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item, isFolder) => {
    try {
      if (isFolder) {
        await folderAPI.restoreFolder(item.id);
      } else {
        await fileAPI.restoreFile(item.id);
      }
      loadTrash();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePermanentDelete = async (item, isFolder) => {
    const ok = await confirm({
      title: isFolder ? 'Permanently Delete Folder' : 'Permanently Delete File',
      message: `Are you sure you want to permanently delete "${item.name}"? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      if (isFolder) {
        await folderAPI.permanentDeleteFolder(item.id);
      } else {
        await fileAPI.permanentDeleteFile(item.id);
      }
      loadTrash();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm({
      title: 'Empty Trash Permanently',
      message: 'Are you sure you want to empty the trash permanently? All items will be permanently erased.',
      confirmText: 'Empty Trash',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await statsAPI.emptyTrash();
      loadTrash();
    } catch (e) {
      console.error(e);
    }
  };

  const isEmpty = data.folders.length === 0 && data.files.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="h-14 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-xs">
          <Trash2 className="w-4 h-4 text-rose-500" />
          <span>Trash</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await loadTrash(false);
              } finally {
                setTimeout(() => setIsRefreshing(false), 600);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-xl text-xs font-semibold transition-all group disabled:opacity-60 shadow-xs"
            title="Refresh trash"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isRefreshing ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {!isEmpty && (
            <button
              onClick={handleEmptyTrash}
              className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold shadow-xs transition-colors"
              title="Empty Trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Empty Trash</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
            Loading trash...
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-4 shadow-xl">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">Trash is empty</h3>
            <p className="text-xs text-slate-400">
              Items moved to trash will appear here before being permanently removed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-amber-300 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Items in trash will be permanently erased if you click Empty Trash.</span>
            </div>

            {/* List */}
            <div className="space-y-1.5">
              {data.folders.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-200"
                >
                  <div className="flex items-center gap-3 truncate pr-4">
                    <Folder className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="font-semibold text-slate-200 truncate">{f.name}</span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-slate-500 hidden sm:inline text-[11px]">
                      Trashed {formatDate(f.trashed_at)}
                    </span>
                    <button
                      onClick={() => handleRestore(f, true)}
                      className="flex items-center justify-center gap-1 text-blue-400 hover:text-blue-300 font-semibold p-1.5 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Restore folder"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(f, true)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {data.files.map((fl) => (
                <div
                  key={fl.id}
                  className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-200"
                >
                  <div className="flex items-center gap-3 truncate pr-4">
                    <File className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-200 block truncate">{fl.name}</span>
                      <span className="text-[10px] text-slate-500 block">{formatBytes(fl.size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-slate-500 hidden sm:inline text-[11px]">
                      Trashed {formatDate(fl.trashed_at)}
                    </span>
                    <button
                      onClick={() => handleRestore(fl, false)}
                      className="flex items-center justify-center gap-1 text-blue-400 hover:text-blue-300 font-semibold p-1.5 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Restore file"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(fl, false)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
