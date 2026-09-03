import React, { useState, useEffect } from 'react';
import { X, FolderInput, Folder, HardDrive, ChevronRight } from 'lucide-react';
import { folderAPI } from '../../api/client';

export default function MoveModal({ isOpen, onClose, item, onMove }) {
  const [folders, setFolders] = useState([]);
  const [currentParent, setCurrentParent] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: '', name: 'My Drive' }]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFolders('');
    }
  }, [isOpen]);

  const loadFolders = async (folderId) => {
    setLoading(true);
    try {
      const res = await folderAPI.getContents(folderId);
      if (res.data) {
        const subs = (res.data.subfolders || []).filter((f) => f.id !== item?.id);
        setFolders(subs);
        setBreadcrumbs(res.data.breadcrumbs || [{ id: '', name: 'My Drive' }]);
        setCurrentParent(folderId);
        setSelectedFolderId(folderId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onMove(item, selectedFolderId || null);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-800 p-4 sm:p-6 animate-in zoom-in-95 duration-150 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Move Item</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Directory Navigator */}
        <div className="mt-4">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-2 overflow-x-auto pb-1">
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={b.id || 'root'}>
                <button
                  onClick={() => loadFolders(b.id)}
                  className="hover:text-blue-400 font-medium whitespace-nowrap"
                >
                  {b.name}
                </button>
                {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600" />}
              </React.Fragment>
            ))}
          </div>

          <div className="border border-slate-800 rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1 bg-slate-950">
            <button
              onClick={() => setSelectedFolderId(currentParent)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                selectedFolderId === currentParent
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>Current Folder ({breadcrumbs[breadcrumbs.length - 1]?.name})</span>
            </button>

            {folders.length === 0 && !loading && (
              <p className="text-center py-4 text-xs text-slate-500">No subfolders here</p>
            )}

            {folders.map((f) => (
              <div
                key={f.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  selectedFolderId === f.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
                onClick={() => setSelectedFolderId(f.id)}
                onDoubleClick={() => loadFolders(f.id)}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadFolders(f.id);
                  }}
                  className="text-[11px] text-blue-400 hover:underline px-2 py-0.5"
                >
                  Open →
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-md shadow-blue-600/20 transition-all"
          >
            {loading ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
}
