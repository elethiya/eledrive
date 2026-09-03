import React, { useState, useEffect } from 'react';
import {
  folderAPI,
  fileAPI,
} from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import FileCard from '../components/FileCard';
import {
  FolderPlus,
  Upload,
  HardDrive,
  UploadCloud,
} from 'lucide-react';

export default function DrivePage({
  viewMode,
  currentFolderId,
  setCurrentFolderId,
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
    breadcrumbs: [{ id: '', name: 'My Drive' }],
    subfolders: [],
    files: [],
    permission: 'owner',
  });
  const [loading, setLoading] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId]);

  const loadFolder = async (folderId) => {
    setLoading(true);
    try {
      const res = await folderAPI.getContents(folderId);
      if (res.data) {
        setFolderData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenItem = (item) => {
    if (item.mime_type === undefined) {
      // It's a folder
      setCurrentFolderId(item.id);
    } else {
      // It's a file
      onOpenPreview(item);
    }
  };

  const handleDownload = (item) => {
    if (item.mime_type === undefined) {
      // Folder -> zip
      window.location.href = folderAPI.getDownloadZipUrl(item.id);
    } else {
      window.location.href = fileAPI.getDownloadUrl(item.id);
    }
  };

  const handleToggleStar = async (item) => {
    try {
      if (item.mime_type === undefined) {
        await folderAPI.toggleStar(item.id);
      } else {
        await fileAPI.toggleStar(item.id);
      }
      loadFolder(currentFolderId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTrash = async (item) => {
    try {
      if (item.mime_type === undefined) {
        await folderAPI.trashFolder(item.id);
      } else {
        await fileAPI.trashFile(item.id);
      }
      loadFolder(currentFolderId);
    } catch (e) {
      alert(e.message);
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

  const { folder, breadcrumbs, subfolders, files } = folderData;
  const isEmpty = subfolders.length === 0 && files.length === 0;

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Breadcrumb Path */}
      <Breadcrumbs
        breadcrumbs={breadcrumbs}
        currentFolder={folder}
        onNavigate={(id) => setCurrentFolderId(id)}
        onShareFolder={() => onOpenShare(folder, 'folder')}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-600/10 border-2 border-dashed border-blue-500 z-40 flex items-center justify-center pointer-events-none backdrop-blur-xs">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-blue-600 font-bold text-sm">
            <UploadCloud className="w-6 h-6 animate-bounce" />
            <span>Drop files or folders here to upload</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
            Loading folder contents...
          </div>
        ) : isEmpty ? (
          <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <HardDrive className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">This folder is empty</h3>
            <p className="text-xs text-slate-600 mb-6">
              Drag & drop files or folders here, or click below to get started.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenNewFolder}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>New Folder</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Folders Section */}
            {subfolders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                  Folders ({subfolders.length})
                </h3>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5'
                      : 'space-y-1.5'
                  }
                >
                  {subfolders.map((sf) => (
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
                      onToggleStar={handleToggleStar}
                      onTrash={handleTrash}
                      onShowDetails={(item) => onOpenDetails(item, true)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Files Section */}
            {files.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                  Files ({files.length})
                </h3>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5'
                      : 'space-y-1.5'
                  }
                >
                  {files.map((fl) => (
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
