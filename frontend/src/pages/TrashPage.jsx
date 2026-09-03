import React, { useState, useEffect } from 'react';
import { statsAPI, folderAPI, fileAPI } from '../api/client';
import { Trash2, RotateCcw, AlertTriangle, Folder, File } from 'lucide-react';
import { formatBytes, formatDate } from '../utils/formatters';

export default function TrashPage() {
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    setLoading(true);
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
      alert(e.message);
    }
  };

  const handlePermanentDelete = async (item, isFolder) => {
    if (!confirm(`Permanently delete "${item.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      if (isFolder) {
        await folderAPI.permanentDeleteFolder(item.id);
      } else {
        await fileAPI.permanentDeleteFile(item.id);
      }
      loadTrash();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Are you sure you want to empty the trash permanently? All items will be permanently erased.')) {
      return;
    }
    try {
      await statsAPI.emptyTrash();
      loadTrash();
    } catch (e) {
      alert(e.message);
    }
  };

  const isEmpty = data.folders.length === 0 && data.files.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Trash2 className="w-4 h-4 text-red-500" />
          <span>Trash</span>
        </div>

        {!isEmpty && (
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
            Loading trash...
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-600 flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Trash is empty</h3>
            <p className="text-xs text-slate-600">
              Items moved to trash will appear here before being permanently removed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-amber-800 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Items in trash will be permanently erased if you click Empty Trash.</span>
            </div>

            {/* List */}
            <div className="space-y-1.5">
              {data.folders.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-3 truncate pr-4">
                    <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{f.name}</span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-slate-600 hidden sm:inline">
                      Trashed {formatDate(f.trashed_at)}
                    </span>
                    <button
                      onClick={() => handleRestore(f, true)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Restore folder"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(f, true)}
                      className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
                  className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-3 truncate pr-4">
                    <File className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-800 block truncate">{fl.name}</span>
                      <span className="text-[10px] text-slate-600 block">{formatBytes(fl.size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-slate-600 hidden sm:inline">
                      Trashed {formatDate(fl.trashed_at)}
                    </span>
                    <button
                      onClick={() => handleRestore(fl, false)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Restore file"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(fl, false)}
                      className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
