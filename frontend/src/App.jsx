import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DrivePage from './pages/DrivePage';
import SharedWithMePage from './pages/SharedWithMePage';
import RecentPage from './pages/RecentPage';
import StarredPage from './pages/StarredPage';
import TrashPage from './pages/TrashPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import PublicSharePage from './pages/PublicSharePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Modals
import NewFolderModal from './components/Modals/NewFolderModal';
import RenameModal from './components/Modals/RenameModal';
import MoveModal from './components/Modals/MoveModal';
import ShareModal from './components/Modals/ShareModal';
import PreviewModal from './components/Modals/PreviewModal';
import DetailsModal from './components/Modals/DetailsModal';
import UploadModal from './components/Modals/UploadModal';

import { folderAPI, fileAPI } from './api/client';

function AppContent() {
  const { user, loading, refreshUser } = useAuth();

  // Navigation & View state
  const initialPath = window.location.pathname;
  const isInitialAdmin = initialPath === '/admin' || initialPath.startsWith('/admin/');
  const [currentView, setCurrentView] = useState(isInitialAdmin ? 'admin' : 'drive'); // 'drive' | 'shared' | 'recent' | 'starred' | 'trash' | 'profile' | 'admin'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchResults, setSearchResults] = useState(null);

  // Modals state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameModalItem, setRenameModalItem] = useState(null);
  const [isRenameFolder, setIsRenameFolder] = useState(false);
  const [moveModalItem, setMoveModalItem] = useState(null);
  const [isMoveFolder, setIsMoveFolder] = useState(false);
  const [shareModalItem, setShareModalItem] = useState(null);
  const [shareModalType, setShareModalType] = useState('folder');
  const [previewModalFile, setPreviewModalFile] = useState(null);
  const [detailsModalItem, setDetailsModalItem] = useState(null);
  const [isDetailsFolder, setIsDetailsFolder] = useState(false);

  // Upload status tracker
  const [uploadStatus, setUploadStatus] = useState(null);

  // Sync browser URL with currentView (for /admin and /)
  useEffect(() => {
    if (currentView === 'admin') {
      if (window.location.pathname !== '/admin') {
        window.history.pushState({}, '', '/admin');
      }
    } else if (!window.location.pathname.startsWith('/share/')) {
      if (window.location.pathname === '/admin') {
        window.history.pushState({}, '', '/');
      }
    }
  }, [currentView]);

  // Handle browser popstate
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/admin' || p.startsWith('/admin/')) {
        setCurrentView('admin');
      } else if (!p.startsWith('/share/')) {
        setCurrentView('drive');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check if current URL is a public share link
  const path = window.location.pathname;
  const isShareRoute = path.startsWith('/share/');
  const shareToken = isShareRoute ? path.split('/share/')[1] : null;

  // Handle public share view
  if (isShareRoute && shareToken) {
    return (
      <PublicSharePage
        token={shareToken}
        onBackToDrive={() => {
          window.location.pathname = '/';
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Loading EleDrive...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'register') {
      return <RegisterPage onNavigateLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onNavigateRegister={() => setAuthView('register')} />;
  }

  // Handle Search
  const handleSearch = async (overrideQuery) => {
    const q = overrideQuery !== undefined ? overrideQuery : searchQuery;
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fileAPI.search(q, searchType);
      if (res.data) {
        setSearchResults(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Upload Files or Folders/Projects
  const handleUploadFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;

    setUploadStatus({
      isUploading: true,
      progress: 0,
      totalFiles: filesList.length,
      success: false,
      error: null,
    });

    const formData = new FormData();
    if (currentFolderId) {
      formData.append('folder_id', currentFolderId);
    }

    filesList.forEach((file) => {
      formData.append('files', file);
      if (file.webkitRelativePath) {
        formData.append('paths', file.webkitRelativePath);
      }
    });

    try {
      await fileAPI.uploadFiles(formData, (percent) => {
        setUploadStatus((prev) => (prev ? { ...prev, progress: percent } : null));
      });

      setUploadStatus((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              progress: 100,
              success: true,
            }
          : null
      );

      refreshUser();
      const temp = currentFolderId;
      setCurrentFolderId('__temp');
      setTimeout(() => setCurrentFolderId(temp), 50);

      setTimeout(() => {
        setUploadStatus(null);
      }, 4000);
    } catch (err) {
      setUploadStatus((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              error: err.message,
            }
          : null
      );
    }
  };

  // Create New Folder
  const handleCreateFolder = async (name, color) => {
    await folderAPI.createFolder(name, currentFolderId || null, color);
    refreshUser();
    const temp = currentFolderId;
    setCurrentFolderId('__temp');
    setTimeout(() => setCurrentFolderId(temp), 50);
  };

  // Rename
  const handleRename = async (item, newName) => {
    if (isRenameFolder) {
      await folderAPI.updateFolder(item.id, { name: newName });
    } else {
      await fileAPI.renameFile(item.id, newName);
    }
    const temp = currentFolderId;
    setCurrentFolderId('__temp');
    setTimeout(() => setCurrentFolderId(temp), 50);
  };

  // Move
  const handleMove = async (item, targetParentId) => {
    if (isMoveFolder) {
      await folderAPI.moveFolder(item.id, targetParentId);
    } else {
      await fileAPI.moveFile(item.id, targetParentId);
    }
    const temp = currentFolderId;
    setCurrentFolderId('__temp');
    setTimeout(() => setCurrentFolderId(temp), 50);
  };

  return (
    <div className="dark bg-slate-950 text-slate-100 flex h-screen w-screen overflow-hidden font-sans select-none">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          setCurrentFolderId('');
          setSearchResults(null);
        }}
        onNewFolder={() => setNewFolderOpen(true)}
        onUploadFiles={handleUploadFiles}
        onUploadFolder={handleUploadFiles}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
        {/* Top Navbar */}
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchType={searchType}
          setSearchType={setSearchType}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onSearch={handleSearch}
          onNavigateProfile={() => setCurrentView('profile')}
          onNavigateAdmin={() => setCurrentView('admin')}
        />

        {/* View Pages */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentView === 'drive' && (
            <DrivePage
              viewMode={viewMode}
              currentFolderId={currentFolderId === '__temp' ? '' : currentFolderId}
              setCurrentFolderId={setCurrentFolderId}
              onOpenPreview={(file) => setPreviewModalFile(file)}
              onOpenShare={(item, type) => {
                setShareModalItem(item);
                setShareModalType(type);
              }}
              onOpenRename={(item, isFolder) => {
                setRenameModalItem(item);
                setIsRenameFolder(isFolder);
              }}
              onOpenMove={(item, isFolder) => {
                setMoveModalItem(item);
                setIsMoveFolder(isFolder);
              }}
              onOpenDetails={(item, isFolder) => {
                setDetailsModalItem(item);
                setIsDetailsFolder(isFolder);
              }}
              onUploadFiles={handleUploadFiles}
              onOpenNewFolder={() => setNewFolderOpen(true)}
            />
          )}

          {currentView === 'shared' && (
            <SharedWithMePage
              viewMode={viewMode}
              onOpenFolder={(folderId) => {
                setCurrentView('drive');
                setCurrentFolderId(folderId);
              }}
              onOpenPreview={(file) => setPreviewModalFile(file)}
              onOpenShare={(item, type) => {
                setShareModalItem(item);
                setShareModalType(type);
              }}
              onOpenRename={(item, isFolder) => {
                setRenameModalItem(item);
                setIsRenameFolder(isFolder);
              }}
              onOpenMove={(item, isFolder) => {
                setMoveModalItem(item);
                setIsMoveFolder(isFolder);
              }}
              onOpenDetails={(item, isFolder) => {
                setDetailsModalItem(item);
                setIsDetailsFolder(isFolder);
              }}
            />
          )}

          {currentView === 'recent' && (
            <RecentPage
              viewMode={viewMode}
              onOpenPreview={(file) => setPreviewModalFile(file)}
              onOpenShare={(item, type) => {
                setShareModalItem(item);
                setShareModalType(type);
              }}
              onOpenRename={(item, isFolder) => {
                setRenameModalItem(item);
                setIsRenameFolder(isFolder);
              }}
              onOpenMove={(item, isFolder) => {
                setMoveModalItem(item);
                setIsMoveFolder(isFolder);
              }}
              onOpenDetails={(item, isFolder) => {
                setDetailsModalItem(item);
                setIsDetailsFolder(isFolder);
              }}
            />
          )}

          {currentView === 'starred' && (
            <StarredPage
              viewMode={viewMode}
              onOpenFolder={(folderId) => {
                setCurrentView('drive');
                setCurrentFolderId(folderId);
              }}
              onOpenPreview={(file) => setPreviewModalFile(file)}
              onOpenShare={(item, type) => {
                setShareModalItem(item);
                setShareModalType(type);
              }}
              onOpenRename={(item, isFolder) => {
                setRenameModalItem(item);
                setIsRenameFolder(isFolder);
              }}
              onOpenMove={(item, isFolder) => {
                setMoveModalItem(item);
                setIsMoveFolder(isFolder);
              }}
              onOpenDetails={(item, isFolder) => {
                setDetailsModalItem(item);
                setIsDetailsFolder(isFolder);
              }}
            />
          )}

          {currentView === 'trash' && <TrashPage />}

          {currentView === 'profile' && <ProfilePage />}

          {currentView === 'admin' && (
            <AdminPage onBackToDrive={() => setCurrentView('drive')} />
          )}
        </div>
      </div>

      {/* Global Modals */}
      <NewFolderModal
        isOpen={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      <RenameModal
        isOpen={!!renameModalItem}
        onClose={() => setRenameModalItem(null)}
        item={renameModalItem}
        onRename={handleRename}
      />

      <MoveModal
        isOpen={!!moveModalItem}
        onClose={() => setMoveModalItem(null)}
        item={moveModalItem}
        onMove={handleMove}
      />

      <ShareModal
        isOpen={!!shareModalItem}
        onClose={() => setShareModalItem(null)}
        item={shareModalItem}
        itemType={shareModalType}
      />

      <PreviewModal
        isOpen={!!previewModalFile}
        onClose={() => setPreviewModalFile(null)}
        file={previewModalFile}
      />

      <DetailsModal
        isOpen={!!detailsModalItem}
        onClose={() => setDetailsModalItem(null)}
        item={detailsModalItem}
        isFolder={isDetailsFolder}
      />

      <UploadModal
        uploadStatus={uploadStatus}
        onClose={() => setUploadStatus(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
