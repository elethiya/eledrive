import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { ToastProvider } from './context/ToastContext';
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
import TeamsPage from './pages/TeamsPage';
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

import { Search, X } from 'lucide-react';
import FileCard from './components/FileCard';
import { folderAPI, fileAPI } from './api/client';

const VALID_VIEWS = ['drive', 'teams', 'shared', 'recent', 'starred', 'trash', 'profile', 'admin'];

function parseNavigationFromLocation() {
  const path = window.location.pathname;

  // Public share route takes precedence
  if (path.startsWith('/share/')) {
    return { view: 'drive', folderId: '' };
  }

  // Check URL paths
  if (path === '/admin' || path.startsWith('/admin/')) return { view: 'admin', folderId: '' };
  if (path === '/teams' || path.startsWith('/teams/')) return { view: 'teams', folderId: '' };
  if (path === '/shared' || path.startsWith('/shared/')) return { view: 'shared', folderId: '' };
  if (path === '/recent' || path.startsWith('/recent/')) return { view: 'recent', folderId: '' };
  if (path === '/starred' || path.startsWith('/starred/')) return { view: 'starred', folderId: '' };
  if (path === '/trash' || path.startsWith('/trash/')) return { view: 'trash', folderId: '' };
  if (path === '/profile' || path.startsWith('/profile/')) return { view: 'profile', folderId: '' };
  if (path.startsWith('/folder/')) {
    const folderId = path.split('/folder/')[1]?.split('/')[0] || '';
    return { view: 'drive', folderId };
  }

  // Check URL query parameters (e.g. ?view=teams or ?folder=123)
  try {
    const params = new URLSearchParams(window.location.search);
    const qView = params.get('view');
    const qFolder = params.get('folder');
    if (qView && VALID_VIEWS.includes(qView)) {
      return { view: qView, folderId: qFolder || '' };
    }
  } catch (e) {}

  // Fallback to localStorage persistence
  try {
    const savedView = localStorage.getItem('eledrive_current_view');
    const savedFolder = localStorage.getItem('eledrive_current_folder');
    if (savedView && VALID_VIEWS.includes(savedView)) {
      return {
        view: savedView,
        folderId: savedView === 'drive' && savedFolder ? savedFolder : '',
      };
    }
  } catch (e) {}

  return { view: 'drive', folderId: '' };
}

function AppContent() {
  const { user, loading, refreshUser } = useAuth();

  // Navigation & View state initialized from current URL and persistent storage
  const initialNav = parseNavigationFromLocation();
  const [currentView, setCurrentView] = useState(initialNav.view);
  const [currentFolderId, setCurrentFolderId] = useState(initialNav.folderId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Sync browser URL & localStorage whenever currentView or currentFolderId changes
  useEffect(() => {
    if (window.location.pathname.startsWith('/share/')) return;

    try {
      localStorage.setItem('eledrive_current_view', currentView);
      if (currentView === 'drive' && currentFolderId) {
        localStorage.setItem('eledrive_current_folder', currentFolderId);
      } else {
        localStorage.removeItem('eledrive_current_folder');
      }
    } catch (e) {}

    let targetPath = '/';
    if (currentView === 'admin') targetPath = '/admin';
    else if (currentView === 'teams') targetPath = '/teams';
    else if (currentView === 'shared') targetPath = '/shared';
    else if (currentView === 'recent') targetPath = '/recent';
    else if (currentView === 'starred') targetPath = '/starred';
    else if (currentView === 'trash') targetPath = '/trash';
    else if (currentView === 'profile') targetPath = '/profile';
    else if (currentView === 'drive') {
      targetPath = currentFolderId ? `/folder/${currentFolderId}` : '/';
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: currentView, folderId: currentFolderId }, '', targetPath);
    }
  }, [currentView, currentFolderId]);

  // Handle browser popstate (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p.startsWith('/share/')) return;
      const nav = parseNavigationFromLocation();
      setCurrentView(nav.view);
      setCurrentFolderId(nav.folderId);
      setSearchResults(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prevent non-admin/owner users from lingering on /admin
  useEffect(() => {
    if (user && currentView === 'admin' && user.role !== 'admin' && user.role !== 'owner') {
      setCurrentView('drive');
    }
  }, [user, currentView]);

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
          <span className="text-[10px] text-slate-600 font-medium tracking-wide">Developed & Powered by ELETHIYA</span>
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
          onSearch={handleSearch}
          onNavigateProfile={() => {
            setCurrentView('profile');
            setSearchResults(null);
          }}
          onNavigateAdmin={() => {
            setCurrentView('admin');
            setSearchResults(null);
          }}
        />

        {/* View Pages */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {searchResults !== null ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
              {/* Search Results Header */}
              <div className="h-14 px-3 sm:px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-100 truncate min-w-0">
                  <Search className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">Results: <span className="text-blue-400 font-mono">"{searchQuery}"</span></span>
                  <span className="text-slate-500 font-normal shrink-0">({searchResults.length})</span>
                </div>

                <button
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
                  title="Exit Search"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Search</span>
                </button>
              </div>

              {/* Search Results Content */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
                {searchResults.length === 0 ? (
                  <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-4 shadow-xl">
                      <Search className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-slate-100 mb-1">No matching files found</h3>
                    <p className="text-xs text-slate-400 mb-4">No files matched your search query across all folders.</p>
                    <button
                      onClick={() => {
                        setSearchResults(null);
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-blue-600/20"
                    >
                      Return to Drive
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden sm:flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none bg-slate-900/30 rounded-xl">
                      <span className="flex-1">Name</span>
                      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                        <span className="w-20 sm:w-24 text-right">Size</span>
                        <span className="w-24 sm:w-28 text-right hidden md:inline">Modified</span>
                        <span className="w-20 text-right pr-2">Actions</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {searchResults.map((fl) => (
                        <FileCard
                          key={fl.id}
                          item={fl}
                          isFolder={false}
                          onOpen={(file) => setPreviewModalFile(file)}
                          onDownload={(file) => {
                            window.location.href = fileAPI.getDownloadUrl(file.id);
                          }}
                          onShare={(file) => {
                            setShareModalItem(file);
                            setShareModalType('file');
                          }}
                          onRename={(file) => {
                            setRenameModalItem(file);
                            setIsRenameFolder(false);
                          }}
                          onMove={(file) => {
                            setMoveModalItem(file);
                            setIsMoveFolder(false);
                          }}
                          onShowDetails={(file) => {
                            setDetailsModalItem(file);
                            setIsDetailsFolder(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {currentView === 'drive' && (
                <DrivePage
                  searchQuery={searchQuery}
                  onClearSearch={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
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

              {currentView === 'teams' && (
                <TeamsPage
                  onOpenFolder={(folderId) => {
                    setCurrentView('drive');
                    setCurrentFolderId(folderId);
                  }}
                  onOpenPreview={(file) => setPreviewModalFile(file)}
                />
              )}

              {currentView === 'shared' && (
                <SharedWithMePage
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
            </>
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
      <ConfirmProvider>
        <RealtimeProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </RealtimeProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
