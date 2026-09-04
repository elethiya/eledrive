import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  folderAPI,
  fileAPI,
} from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { useRealtimeEvent, useRealtime } from '../context/RealtimeContext';
import Breadcrumbs from '../components/Breadcrumbs';
import FileCard from '../components/FileCard';
import {
  FolderPlus,
  HardDrive,
  UploadCloud,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Folder,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  Users,
  Image as ImageIcon,
  Film,
  Code2,
  Archive,
  Layers,
  RefreshCw,
  Search,
} from 'lucide-react';
import { formatBytes, formatDate, getFileTypeCategory } from '../utils/formatters';

export default function DrivePage({
  currentFolderId,
  setCurrentFolderId,
  searchQuery = '',
  onClearSearch,
  onOpenPreview,
  onOpenShare,
  onOpenRename,
  onOpenMove,
  onOpenDetails,
  onUploadFiles,
  onOpenNewFolder,
}) {
  const [folderData, setFolderData] = useState({
    folder: null,
    breadcrumbs: [],
    subfolders: [],
    files: [],
  });
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // Modern Content Listing System States
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortField, setSortField] = useState('name'); // 'name', 'size', 'updated_at', 'type'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadContent(false);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Load Folder Contents
  const loadContent = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const fetchFolder = folderAPI.getFolder || folderAPI.getContents;
      const res = await fetchFolder(currentFolderId || '');
      if (res.data) {
        setFolderData({
          folder: res.data.folder,
          breadcrumbs: res.data.breadcrumbs || [],
          subfolders: res.data.subfolders || [],
          files: res.data.files || [],
        });
      }
    } catch (err) {
      console.error('Failed to load drive content:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    loadContent(true);
  }, [loadContent]);

  // Real-time Event Subscription: load everything in real time without refreshing
  useRealtimeEvent(['file', 'folder', 'trash', 'sync', 'item'], () => {
    loadContent(false);
  });

  // Navigation handlers
  const handleOpenItem = (item) => {
    if (item.mime_type === undefined) {
      // It's a folder
      setCurrentFolderId(item.id);
      if (onClearSearch) onClearSearch();
      setCategoryFilter('all');
    } else {
      // It's a file
      onOpenPreview(item);
    }
  };

  const handleDownload = (item) => {
    if (item.mime_type === undefined) {
      // Download folder ZIP
      window.location.href = folderAPI.getDownloadZipUrl(item.id);
    } else {
      // Download single file
      window.location.href = fileAPI.getDownloadUrl(item.id);
    }
  };

  const handleToggleStar = async (item) => {
    const isFolder = item.mime_type === undefined;
    try {
      if (isFolder) {
        await folderAPI.toggleStar(item.id, !item.is_starred);
        setFolderData((prev) => ({
          ...prev,
          subfolders: prev.subfolders.map((sf) =>
            sf.id === item.id ? { ...sf, is_starred: !item.is_starred } : sf
          ),
        }));
      } else {
        await fileAPI.toggleStar(item.id, !item.is_starred);
        setFolderData((prev) => ({
          ...prev,
          files: prev.files.map((fl) =>
            fl.id === item.id ? { ...fl, is_starred: !item.is_starred } : fl
          ),
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrash = async (item) => {
    const isFolder = item.mime_type === undefined;
    const ok = await confirm({
      title: isFolder ? 'Move Folder to Trash' : 'Move File to Trash',
      message: `Are you sure you want to move "${item.name}" to trash? You can restore it anytime from Trash.`,
      confirmText: 'Move to Trash',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      if (isFolder) {
        await folderAPI.trashFolder(item.id);
        setFolderData((prev) => ({
          ...prev,
          subfolders: prev.subfolders.filter((sf) => sf.id !== item.id),
        }));
      } else {
        await fileAPI.trashFile(item.id);
        setFolderData((prev) => ({
          ...prev,
          files: prev.files.filter((fl) => fl.id !== item.id),
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag & drop upload handler
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const { folder, breadcrumbs, subfolders, files } = folderData;

  // Calculate Category Counts dynamically
  const categoryCounts = useMemo(() => {
    const counts = {
      all: (subfolders?.length || 0) + (files?.length || 0),
      folder: subfolders?.length || 0,
      image: 0,
      video: 0,
      document: 0,
      code: 0,
      archive: 0,
    };
    (files || []).forEach((f) => {
      const cat = getFileTypeCategory(f.mime_type, f.extension);
      if (counts[cat] !== undefined) counts[cat]++;
      else counts.document++;
    });
    return counts;
  }, [subfolders, files]);

  const filterText = (searchQuery || '').trim();

  // Filter and sort subfolders and files
  const { filteredFolders, filteredFiles, totalBytes } = useMemo(() => {
    let fList = [...(subfolders || [])];
    let fileList = [...(files || [])];

    // 1. Text filter from Navbar search bar
    if (filterText) {
      const q = filterText.toLowerCase();
      fList = fList.filter((f) => f.name.toLowerCase().includes(q));
      fileList = fileList.filter((fl) => fl.name.toLowerCase().includes(q));
    }

    // 2. Category filter
    if (categoryFilter === 'folder') {
      fileList = [];
    } else if (categoryFilter !== 'all') {
      fList = [];
      fileList = fileList.filter((fl) => {
        const cat = getFileTypeCategory(fl.mime_type, fl.extension);
        return cat === categoryFilter;
      });
    }

    // 3. Sort function
    const sorter = (a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'size') {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        comparison = sizeA - sizeB;
      } else if (sortField === 'updated_at') {
        comparison = new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
      } else if (sortField === 'type') {
        const typeA = a.extension || (a.mime_type ? a.mime_type : 'folder');
        const typeB = b.extension || (b.mime_type ? b.mime_type : 'folder');
        comparison = typeA.localeCompare(typeB);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    };

    fList.sort(sorter);
    fileList.sort(sorter);

    const bytes = fileList.reduce((acc, f) => acc + (f.size || 0), 0);

    return { filteredFolders: fList, filteredFiles: fileList, totalBytes: bytes };
  }, [subfolders, files, filterText, categoryFilter, sortField, sortOrder]);

  const isEmpty = (subfolders?.length === 0 && files?.length === 0);
  const isFilterEmpty = !isEmpty && filteredFolders.length === 0 && filteredFiles.length === 0;

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-950 text-slate-100"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Breadcrumbs Navigation Header */}
      <Breadcrumbs
        breadcrumbs={breadcrumbs}
        currentFolder={folder}
        onNavigate={(id) => setCurrentFolderId(id)}
      />

      {/* Modern Content Listing Toolbar (Always in same row as counting section) */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md shrink-0">
        <div className="px-3.5 sm:px-6 py-2 flex items-center justify-between gap-2.5 overflow-x-auto no-scrollbar">
          {/* Left: Folder Content Stats (Counting Section) & Filter Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap bg-slate-950/60 border border-slate-800/80 px-2.5 py-1 rounded-xl shadow-inner">
              {filteredFolders.length} {filteredFolders.length === 1 ? 'folder' : 'folders'}, {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
              {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`}
            </span>

            {filterText && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs rounded-xl shrink-0">
                <span>Filtered: <strong className="text-slate-200">"{filterText}"</strong></span>
                {onClearSearch && (
                  <button
                    onClick={onClearSearch}
                    className="text-slate-400 hover:text-slate-200 p-0.5 transition-colors"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: New Folder, Share Drive, Name (Sort) & Animated Refresh in the SAME ROW */}
          <div className="flex items-center gap-2 shrink-0">
            {/* New Folder quick button */}
            <button
              onClick={onOpenNewFolder}
              className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
              title="Create a new folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">New Folder</span>
            </button>

            {/* Share Drive with Team button (when in root My Drive) or Share Folder */}
            {!currentFolderId ? (
              <button
                onClick={() => onOpenShare({ id: 'root', name: 'My Drive' }, 'drive')}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
                title="Share entire My Drive with a team"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share Drive</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenShare(folder, 'folder')}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
                title="Share this folder with a team"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share Folder</span>
              </button>
            )}

            {/* Refresh button with Animation */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 group disabled:opacity-60"
              title="Refresh contents"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 transition-transform duration-500 ${
                  isRefreshing ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span className="hidden sm:inline text-[11px]">Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        {!isEmpty && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-3.5 sm:px-6 pb-2 pt-0 text-xs no-scrollbar">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                categoryFilter === 'all'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>All ({categoryCounts.all})</span>
            </button>

            {categoryCounts.folder > 0 && (
              <button
                onClick={() => setCategoryFilter('folder')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                  categoryFilter === 'folder'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Folder className="w-3 h-3 text-amber-400" />
                <span>Folders ({categoryCounts.folder})</span>
              </button>
            )}

            {categoryCounts.document > 0 && (
              <button
                onClick={() => setCategoryFilter('document')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                  categoryFilter === 'document'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileText className="w-3 h-3 text-blue-400" />
                <span>Documents ({categoryCounts.document})</span>
              </button>
            )}

            {categoryCounts.image > 0 && (
              <button
                onClick={() => setCategoryFilter('image')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                  categoryFilter === 'image'
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <ImageIcon className="w-3 h-3 text-pink-400" />
                <span>Images ({categoryCounts.image})</span>
              </button>
            )}

            {categoryCounts.video > 0 && (
              <button
                onClick={() => setCategoryFilter('video')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                  categoryFilter === 'video'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Film className="w-3 h-3 text-rose-400" />
                <span>Videos ({categoryCounts.video})</span>
              </button>
            )}

            {categoryCounts.code > 0 && (
              <button
                onClick={() => setCategoryFilter('code')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                  categoryFilter === 'code'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Code2 className="w-3 h-3 text-emerald-400" />
                <span>Code ({categoryCounts.code})</span>
              </button>
            )}

            {categoryCounts.archive > 0 && (
              <button
                onClick={() => setCategoryFilter('archive')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                  categoryFilter === 'archive'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Archive className="w-3 h-3 text-amber-500" />
                <span>Archives ({categoryCounts.archive})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-950/80 border-2 border-dashed border-blue-500 z-40 flex items-center justify-center pointer-events-none backdrop-blur-xs">
          <div className="bg-slate-900 border border-blue-500/50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-blue-400 font-bold text-sm">
            <UploadCloud className="w-6 h-6 animate-bounce" />
            <span>Drop files or project folders here to upload</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span>Loading drive contents...</span>
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-blue-400 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/5">
              <HardDrive className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">This folder is empty</h3>
            <p className="text-xs text-slate-400 mb-6">
              Drag & drop files or project folders here, or create a new folder to organize your work.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenNewFolder}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold transition-all shadow-md"
              >
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <span>New Folder</span>
              </button>
            </div>
          </div>
        ) : isFilterEmpty ? (
          <div className="h-64 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-3 shadow-inner">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-200 mb-1">No matches found</h4>
            <p className="text-xs text-slate-500 mb-3">
              No items matching your filter in this folder.
            </p>
            <button
              onClick={() => {
                if (onClearSearch) onClearSearch();
                setCategoryFilter('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Table List Header (Unified single Name & Sort header on desktop and mobile) */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none bg-slate-900/30 rounded-xl">
              <button
                onClick={() => handleHeaderSort('name')}
                className="flex items-center gap-1.5 hover:text-slate-200 transition-colors flex-1 text-left font-bold"
                title="Sort by Name"
              >
                <span>Name</span>
                {sortField === 'name' ? (
                  <span className="text-blue-400 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                )}
              </button>

              <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                <button
                  onClick={() => handleHeaderSort('size')}
                  className="text-right hover:text-slate-200 transition-colors font-bold flex items-center justify-end gap-1"
                  title="Sort by Size"
                >
                  <span>Size</span>
                  {sortField === 'size' && (
                    <span className="text-blue-400 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>

                <button
                  onClick={() => handleHeaderSort('updated_at')}
                  className="w-24 sm:w-28 text-right hidden sm:inline hover:text-slate-200 transition-colors"
                  title="Sort by Modified Date"
                >
                  <span>Modified</span>
                  {sortField === 'updated_at' && (
                    <span className="text-blue-400 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>

                <span className="w-16 sm:w-20 text-right pr-2 hidden sm:inline">Actions</span>
              </div>
            </div>

            {/* Folders Section */}
            {filteredFolders.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 py-1">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>Folders ({filteredFolders.length})</span>
                  </h3>
                </div>
                <div className="space-y-1">
                  {filteredFolders.map((sf) => (
                    <FileCard
                      key={sf.id}
                      item={sf}
                      isFolder={true}
                      onOpen={handleOpenItem}
                      onDownload={handleDownload}
                      onShare={(item) => onOpenShare(item, 'folder')}
                      onRename={(item) => onOpenRename(item, true)}
                      onMove={(item) => onOpenMove(item, true)}
                      onToggleStar={handleToggleStar}
                      onTrash={handleTrash}
                      onShowDetails={(item) => onOpenDetails(item, true)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Files Section */}
            {filteredFiles.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between px-1 py-1">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>Files ({filteredFiles.length})</span>
                  </h3>
                </div>
                <div className="space-y-1">
                  {filteredFiles.map((fl) => (
                    <FileCard
                      key={fl.id}
                      item={fl}
                      isFolder={false}
                      onOpen={handleOpenItem}
                      onDownload={handleDownload}
                      onShare={(item) => onOpenShare(item, 'file')}
                      onRename={(item) => onOpenRename(item, false)}
                      onMove={(item) => onOpenMove(item, false)}
                      onToggleStar={handleToggleStar}
                      onTrash={handleTrash}
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
