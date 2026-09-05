import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { RealtimeProvider, useRealtimeEvent } from './context/RealtimeContext';
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
import ForensicPage from './pages/ForensicPage';
import PublicSharePage from './pages/PublicSharePage';
import TeamsPage from './pages/TeamsPage';
import MembersPage from './pages/MembersPage';
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

import { Search, X, Wrench, AlertTriangle, RefreshCw } from 'lucide-react';
import FileCard from './components/FileCard';
import { folderAPI, fileAPI, systemAPI, downloadWithProgress } from './api/client';

const VALID_VIEWS = ['drive', 'teams', 'members', 'shared', 'recent', 'starred', 'trash', 'profile', 'admin', 'forensics'];

function parseNavigationFromLocation() {
  const path = window.location.pathname;

  // Public share route takes precedence
  if (path.startsWith('/share/')) {
    return { view: 'drive', folderId: '' };
  }

  // Check URL paths
  if (path === '/admin' || path.startsWith('/admin/')) return { view: 'admin', folderId: '' };
  if (path === '/forensics' || path.startsWith('/forensics/')) return { view: 'forensics', folderId: '' };
  if (path === '/teams' || path.startsWith('/teams/')) return { view: 'teams', folderId: '' };
  if (path === '/members' || path.startsWith('/members/')) return { view: 'members', folderId: '' };
  if (path.startsWith('/shared/folder/')) {
    const folderId = path.split('/shared/folder/')[1]?.split('/')[0] || '';
    return { view: 'shared', folderId };
  }
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
        folderId: (savedView === 'drive' || savedView === 'shared') && savedFolder ? savedFolder : '',
      };
    }
  } catch (e) {}

  return { view: 'drive', folderId: '' };
}

function AppContent() {
  const { user, loading, logout, refreshUser } = useAuth();

  // Navigation & View state initialized from current URL and persistent storage
  const initialNav = parseNavigationFromLocation();
  const [currentView, setCurrentView] = useState(initialNav.view);
  const [currentFolderId, setCurrentFolderId] = useState(initialNav.folderId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  // Maintenance mode status state
  const [maintenanceInfo, setMaintenanceInfo] = useState({
    isActive: false,
    notice: 'Platform is currently undergoing scheduled maintenance. Please check back shortly.',
  });

  const checkMaintenanceStatus = useCallback(async () => {
    try {
      const res = await systemAPI.getStatus();
      const data = res?.data !== undefined ? res.data : res;
      if (data) {
        setMaintenanceInfo({
          isActive: !!data.maintenance_mode,
          notice: data.maintenance_notice || 'Platform is currently undergoing scheduled maintenance. Please check back shortly.',
        });
      }
    } catch (err) {
      if (err.response?.status === 503 && err.response?.data) {
        setMaintenanceInfo({
          isActive: true,
          notice: err.response.data.error || err.response.data.message || 'Platform is currently undergoing scheduled maintenance.',
        });
      }
    }
  }, []);

  useEffect(() => {
    checkMaintenanceStatus();
  }, [checkMaintenanceStatus]);

  useEffect(() => {
    const handleMaintEvent = (e) => {
      if (e.detail) {
        setMaintenanceInfo({
          isActive: true,
          notice: e.detail.error || e.detail.message || 'Platform is currently undergoing scheduled maintenance.',
        });
      }
    };
    window.addEventListener('eledrive:maintenance', handleMaintEvent);
    return () => window.removeEventListener('eledrive:maintenance', handleMaintEvent);
  }, []);

  useRealtimeEvent(['system', 'maintenance'], (payload) => {
    if (payload?.maintenance_mode !== undefined) {
      setMaintenanceInfo({
        isActive: !!payload.maintenance_mode,
        notice: payload.maintenance_notice || 'Platform is currently undergoing scheduled maintenance.',
      });
    } else {
      checkMaintenanceStatus();
    }
  });

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

  // Upload and Download transfer status trackers & abort controllers
  const [uploadStatus, setUploadStatus] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const uploadAbortControllerRef = useRef(null);
  const downloadAbortControllerRef = useRef(null);

  // Sync browser URL & localStorage whenever currentView or currentFolderId changes
  useEffect(() => {
    if (window.location.pathname.startsWith('/share/')) return;

    try {
      localStorage.setItem('eledrive_current_view', currentView);
      if ((currentView === 'drive' || currentView === 'shared') && currentFolderId) {
        localStorage.setItem('eledrive_current_folder', currentFolderId);
      } else {
        localStorage.removeItem('eledrive_current_folder');
      }
    } catch (e) {}

    let targetPath = '/';
    if (currentView === 'admin') targetPath = '/admin';
    else if (currentView === 'teams') targetPath = '/teams';
    else if (currentView === 'members') targetPath = '/members';
    else if (currentView === 'shared') {
      targetPath = currentFolderId ? `/shared/folder/${currentFolderId}` : '/shared';
    }
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

  // Warn and require confirmation if user attempts to reload, leave, or close tab/browser during active transfers
  useEffect(() => {
    const isUploading = !!uploadStatus?.isUploading;
    const isDownloading = !!downloadStatus?.isDownloading;

    window.__eledriveTransferActive = isUploading || isDownloading;

    if (!isUploading && !isDownloading) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      const message =
        isUploading && isDownloading
          ? 'Upload and download are still in progress. If you leave or reload this page, your transfers will be cancelled.'
          : isUploading
          ? 'An upload is still in progress. If you leave or reload this page, your upload will be cancelled.'
          : 'A download is still in progress. If you leave or reload this page, your download will be cancelled.';
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.__eledriveTransferActive = false;
    };
  }, [uploadStatus?.isUploading, downloadStatus?.isDownloading]);

  // Handle Search
  const handleSearch = async (overrideQuery) => {
    const q = overrideQuery !== undefined ? overrideQuery : searchQuery;
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fileAPI.search(q, searchType);
      const data = res?.data !== undefined ? res.data : res;
      if (data) {
        const files = Array.isArray(data) ? data : (data.files || []);
        const folders = Array.isArray(data) ? [] : (data.folders || []);
        setSearchResults({ files, folders });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;

    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch (_) {}
    }

    const controller = new AbortController();
    uploadAbortControllerRef.current = controller;

    let totalUploadBytes = 0;
    for (let i = 0; i < filesList.length; i++) {
      totalUploadBytes += filesList[i].size || 0;
    }

    setUploadStatus({
      isUploading: true,
      progress: 0,
      totalFiles: filesList.length,
      loadedBytes: 0,
      totalBytes: totalUploadBytes,
      speed: 0,
      success: false,
      cancelled: false,
      error: null,
    });

    let lastTime = Date.now();
    let lastLoaded = 0;
    let currentSpeed = 0;
    let totalLoaded = 0;

    const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB chunks

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    try {
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const uploadId = generateUUID();
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          if (controller.signal.aborted) throw new Error("AbortError");
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const chunkFormData = new FormData();
          chunkFormData.append('upload_id', uploadId);
          chunkFormData.append('chunk_index', chunkIndex);
          chunkFormData.append('chunk', chunk);
          
          await fileAPI.uploadChunk(chunkFormData, controller.signal);
          
          totalLoaded += chunk.size;
          const percent = totalUploadBytes > 0 ? Math.min(100, Math.round((totalLoaded * 100) / totalUploadBytes)) : 100;
          
          const now = Date.now();
          const timeDelta = (now - lastTime) / 1000;
          if (timeDelta >= 0.25) {
            currentSpeed = (totalLoaded - lastLoaded) / timeDelta;
            lastLoaded = totalLoaded;
            lastTime = now;
          }

          setUploadStatus((prev) =>
            prev
              ? {
                  ...prev,
                  progress: percent,
                  loadedBytes: totalLoaded,
                  speed: currentSpeed,
                }
              : null
          );
        }
        
        // Finalize this file
        await fileAPI.finalizeUpload({
          upload_id: uploadId,
          filename: file.name,
          relative_path: file.webkitRelativePath || '',
          folder_id: currentFolderId || '',
          total_chunks: totalChunks,
          total_size: file.size
        }, controller.signal);
      }

      uploadAbortControllerRef.current = null;

      setUploadStatus((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              progress: 100,
              loadedBytes: totalUploadBytes,
              totalBytes: totalUploadBytes,
              speed: 0,
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
      uploadAbortControllerRef.current = null;
      if (
        controller.signal.aborted ||
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.code === 'ERR_CANCELED' ||
        err.message === 'AbortError'
      ) {
        setUploadStatus((prev) =>
          prev
            ? {
                ...prev,
                isUploading: false,
                cancelled: true,
                progress: 0,
                error: 'Upload cancelled by user',
              }
            : null
        );
        setTimeout(() => {
          setUploadStatus(null);
        }, 2500);
        return;
      }

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


  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setUploadStatus((prev) =>
      prev
        ? {
            ...prev,
            isUploading: false,
            cancelled: true,
            progress: 0,
            error: 'Upload cancelled by user',
          }
        : null
    );
    setTimeout(() => {
      setUploadStatus(null);
    }, 2500);
  };

  // Tracked Download with real-time network speed, file size progress, and cancel support
  const handleDownload = async (item, isFolder = false) => {
    if (!item) return;

    if (downloadAbortControllerRef.current) {
      try {
        downloadAbortControllerRef.current.abort();
      } catch (_) {}
    }

    const controller = new AbortController();
    downloadAbortControllerRef.current = controller;

    const itemName = isFolder ? `${item.name || 'folder'}.zip` : item.name;
    const url = isFolder
      ? folderAPI.getDownloadZipUrl(item.id)
      : fileAPI.getDownloadUrl(item.id);
    const expectedSize = isFolder ? 0 : item.size || 0;

    setDownloadStatus({
      isDownloading: true,
      name: itemName,
      progress: 0,
      loadedBytes: 0,
      totalBytes: expectedSize,
      speed: 0,
      success: false,
      cancelled: false,
      error: null,
    });

    try {
      await downloadWithProgress({
        url,
        filename: itemName,
        expectedSize,
        signal: controller.signal,
        onProgress: ({ loadedBytes, totalBytes, percent, speed }) => {
          setDownloadStatus((prev) =>
            prev
              ? {
                  ...prev,
                  progress: percent,
                  loadedBytes,
                  totalBytes,
                  speed,
                }
              : null
          );
        },
      });

      downloadAbortControllerRef.current = null;

      setDownloadStatus((prev) =>
        prev
          ? {
              ...prev,
              isDownloading: false,
              progress: 100,
              loadedBytes: prev.totalBytes || prev.loadedBytes,
              speed: 0,
              success: true,
            }
          : null
      );

      setTimeout(() => {
        setDownloadStatus(null);
      }, 3500);
    } catch (err) {
      downloadAbortControllerRef.current = null;
      if (
        controller.signal.aborted ||
        err?.name === 'AbortError' ||
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED'
      ) {
        setDownloadStatus((prev) =>
          prev
            ? {
                ...prev,
                isDownloading: false,
                name: itemName,
                cancelled: true,
                progress: 0,
                error: 'Download cancelled by user',
              }
            : null
        );
        setTimeout(() => {
          setDownloadStatus(null);
        }, 2500);
        return;
      }

      console.warn('Tracked download fallback to direct download:', err);
      window.location.href = url;
      setDownloadStatus(null);
    }
  };

  const handleCancelDownload = () => {
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }
    setDownloadStatus((prev) =>
      prev
        ? {
            ...prev,
            isDownloading: false,
            cancelled: true,
            progress: 0,
            error: 'Download cancelled by user',
          }
        : null
    );
    setTimeout(() => {
      setDownloadStatus(null);
    }, 2500);
  };

  // Listen for download events dispatched across components
  useEffect(() => {
    const handleDownloadEvent = (e) => {
      if (e.detail && e.detail.item) {
        handleDownload(e.detail.item, !!e.detail.isFolder);
      }
    };
    window.addEventListener('eledrive:download', handleDownloadEvent);
    return () => {
      window.removeEventListener('eledrive:download', handleDownloadEvent);
    };
  }, []);

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
      return (
        <RegisterPage
          onNavigateLogin={() => setAuthView('login')}
          maintenanceInfo={maintenanceInfo}
        />
      );
    }
    return (
      <LoginPage
        onNavigateRegister={() => setAuthView('register')}
        maintenanceInfo={maintenanceInfo}
      />
    );
  }

  // Active Maintenance Mode Barrier for regular users
  if (maintenanceInfo.isActive && user.role !== 'admin' && user.role !== 'owner') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none font-sans">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative z-10 space-y-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-rose-500/10 border border-rose-500/25 text-rose-400 flex items-center justify-center mx-auto shadow-xl shadow-rose-500/5">
            <Wrench className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-semibold uppercase tracking-wider">
              Maintenance Active
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-100">Platform Maintenance in Progress</h2>
            <p className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 leading-relaxed font-sans text-left sm:text-center">
              {maintenanceInfo.notice}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={checkMaintenanceStatus}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Check Again / Refresh</span>
            </button>
            <button
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Separate Standalone Admin Panel
  if (currentView === 'admin') {
    if (user && user.role !== 'admin' && user.role !== 'owner') {
      setCurrentView('drive');
      return null;
    }
    return (
      <div className="dark bg-slate-950 text-slate-100 h-screen w-screen overflow-y-auto font-sans">
        <AdminPage onBackToDrive={() => setCurrentView('drive')} />
      </div>
    );
  }

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
        {/* Active Maintenance Mode Alert Banner for Workspace Admins & Owners */}
        {maintenanceInfo.isActive && (user?.role === 'admin' || user?.role === 'owner') && (
          <div className="bg-gradient-to-r from-rose-900/90 via-amber-950/90 to-rose-900/90 border-b border-rose-500/40 text-rose-100 px-4 py-2 flex items-center justify-between text-xs font-semibold shrink-0 z-50 shadow-md">
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span className="truncate">
                <strong className="text-white">MAINTENANCE MODE IS ACTIVE:</strong> Regular users are blocked from accessing the platform. Notice: "{maintenanceInfo.notice}"
              </span>
            </div>
            <button
              onClick={() => {
                setCurrentView('admin');
                setSearchResults(null);
              }}
              className="ml-3 px-3 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-[11px] font-bold transition-colors shrink-0"
            >
              Configure in Admin
            </button>
          </div>
        )}

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
          {searchResults !== null ? (() => {
            const searchFiles = Array.isArray(searchResults) ? searchResults : (searchResults?.files || []);
            const searchFolders = Array.isArray(searchResults) ? [] : (searchResults?.folders || []);
            const totalCount = searchFiles.length + searchFolders.length;

            return (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
                {/* Search Results Header */}
                <div className="h-14 px-3 sm:px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-100 truncate min-w-0">
                    <Search className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate">Results: <span className="text-blue-400 font-mono">"{searchQuery}"</span></span>
                    <span className="text-slate-500 font-normal shrink-0">({totalCount})</span>
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
                  {totalCount === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                      <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-4 shadow-xl">
                        <Search className="w-8 h-8" />
                      </div>
                      <h3 className="text-base font-bold text-slate-100 mb-1">No matching items found</h3>
                      <p className="text-xs text-slate-400 mb-4">No files or folders matched your search query.</p>
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
                    <div className="space-y-4">
                      {searchFolders.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                            Folders ({searchFolders.length})
                          </div>
                          <div className="space-y-1">
                            {searchFolders.map((fld) => (
                              <FileCard
                                key={fld.id}
                                item={fld}
                                isFolder={true}
                                onOpen={(f) => {
                                  setCurrentFolderId(f.id);
                                  setCurrentView('drive');
                                  setSearchResults(null);
                                  setSearchQuery('');
                                }}
                                onDownload={(f) => {
                                  handleDownload(f, true);
                                }}
                                onShare={(f) => {
                                  setShareModalItem(f);
                                  setShareModalType('folder');
                                }}
                                onRename={(f) => {
                                  setRenameModalItem(f);
                                  setIsRenameFolder(true);
                                }}
                                onMove={(f) => {
                                  setMoveModalItem(f);
                                  setIsMoveFolder(true);
                                }}
                                onShowDetails={(f) => {
                                  setDetailsModalItem(f);
                                  setIsDetailsFolder(true);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {searchFiles.length > 0 && (
                        <div>
                          <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none bg-slate-900/30 rounded-xl mb-2">
                            <span className="flex-1">Files ({searchFiles.length})</span>
                            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                              <span className="w-20 sm:w-24 text-right">Size</span>
                              <span className="w-24 sm:w-28 text-right hidden md:inline">Modified</span>
                              <span className="w-20 text-right pr-2">Actions</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            {searchFiles.map((fl) => (
                              <FileCard
                                key={fl.id}
                                item={fl}
                                isFolder={false}
                                onOpen={(file) => setPreviewModalFile(file)}
                                onDownload={(file) => {
                                  handleDownload(file, false);
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
                  )}
                </div>
              </div>
            );
          })() : (
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
                  onNavigateView={(view) => setCurrentView(view)}
                  onDownload={handleDownload}
                />
              )}

              {currentView === 'teams' && (
                <TeamsPage
                  onOpenFolder={(folderId, isShared = true) => {
                    setCurrentView(isShared ? 'shared' : 'drive');
                    setCurrentFolderId(folderId || '');
                  }}
                  onOpenPreview={(file) => setPreviewModalFile(file)}
                />
              )}

              {currentView === 'members' && (
                <MembersPage onNavigateView={(view) => setCurrentView(view)} />
              )}

              {currentView === 'shared' && (
                !currentFolderId ? (
                  <SharedWithMePage
                    onOpenFolder={(folderId) => {
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
                    onDownload={handleDownload}
                  />
                ) : (
                  <DrivePage
                    isSharedView={true}
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
                    onNavigateView={(view) => {
                      if (view === 'shared') {
                        setCurrentFolderId('');
                      } else {
                        setCurrentView(view);
                        setCurrentFolderId('');
                      }
                    }}
                    onDownload={handleDownload}
                  />
                )
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
                  onDownload={handleDownload}
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
                  onDownload={handleDownload}
                />
              )}

              {currentView === 'trash' && <TrashPage />}

              {currentView === 'profile' && <ProfilePage />}

              {currentView === 'forensics' && (
                <ForensicPage onNavigateView={(view) => setCurrentView(view)} />
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
        downloadStatus={downloadStatus}
        onClose={() => {
          setUploadStatus(null);
          setDownloadStatus(null);
        }}
        onCloseUpload={() => setUploadStatus(null)}
        onCloseDownload={() => setDownloadStatus(null)}
        onCancelUpload={handleCancelUpload}
        onCancelDownload={handleCancelDownload}
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
