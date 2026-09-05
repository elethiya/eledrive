import React, { useState, useRef, useEffect } from 'react';
import {
  HardDrive,
  Users,
  Share2,
  Clock,
  Star,
  Trash2,
  Plus,
  FolderPlus,
  Upload,
  FolderUp,
  Cloud,
  ChevronDown,
  User,
  UserCheck,
  ShieldCheck,
  Crown,
  X,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRealtimeEvent, useRealtime } from '../context/RealtimeContext';
import { forensicAPI } from '../api/client';
import { formatBytes } from '../utils/formatters';

export default function Sidebar({
  isOpen = false,
  onClose,
  currentView,
  setCurrentView,
  onNewFolder,
  onUploadFiles,
  onUploadFolder,
}) {
  const { user, refreshUser } = useAuth();
  const { isConnected } = useRealtime();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Auto-refresh storage in real time when any file, trash, or storage update arrives
  useRealtimeEvent(['file', 'trash', 'storage', 'sync'], () => {
    if (refreshUser) refreshUser();
  });

  // Check forensic permissions for current user
  const [forensicAccess, setForensicAccess] = useState(null);

  useEffect(() => {
    let mounted = true;
    forensicAPI
      .getAccess()
      .then((res) => {
        if (mounted && res.data) setForensicAccess(res.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user]);

  useRealtimeEvent(['user', 'sync'], () => {
    forensicAPI
      .getAccess()
      .then((res) => {
        if (res.data) setForensicAccess(res.data);
      })
      .catch(() => {});
  });

  const canAccessForensics = user?.role === 'owner' || forensicAccess?.has_access;

  const used = user?.storage_used || 0;
  const limit = user?.storage_limit || 10 * 1024 * 1024 * 1024;
  const percent = Math.min(Math.round((used / limit) * 100), 100);

  const navItems = [
    { id: 'drive', label: 'My Drive', icon: HardDrive },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'members', label: 'Members', icon: UserCheck },
    { id: 'shared', label: 'Shared with me', icon: Share2 },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
      if (onClose) onClose();
    }
  };

  const handleFolderChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFolder(Array.from(e.target.files));
      e.target.value = '';
      if (onClose) onClose();
    }
  };

  const handleNavClick = (viewId) => {
    setCurrentView(viewId);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
              E
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-100 block leading-tight">EleDrive</span>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase leading-none mt-0.5">by ELETHIYA</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="p-4 relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-600/20 font-semibold text-xs tracking-wide transition-all transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2.5">
              <Plus className="w-4 h-4" />
              <span>New</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Action Dropdown Menu */}
          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setDropdownOpen(false)}
              />
              <div
                className="absolute left-4 right-4 top-18 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onNewFolder();
                    if (onClose) onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700/70 hover:text-blue-400 rounded-xl font-medium transition-colors"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                  <span>New Folder</span>
                </button>

                <div className="my-1 border-t border-slate-700/60" />

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700/70 hover:text-blue-400 rounded-xl font-medium transition-colors"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>Upload Files</span>
                </button>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    folderInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-700/70 hover:text-blue-400 rounded-xl font-medium transition-colors"
                >
                  <FolderUp className="w-4 h-4 text-indigo-400" />
                  <div className="text-left">
                    <span className="block">Upload Folder / Project</span>
                    <span className="text-[10px] text-slate-400 block">Preserves hierarchy</span>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Hidden File / Folder Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderChange}
          />
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/20 shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-400' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="my-3 border-t border-slate-800/80" />

          {/* Forensics Detective Navigation */}
          {(canAccessForensics || user?.role === 'owner' || user?.role === 'admin') && (
            <button
              onClick={() => handleNavClick('forensics')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentView === 'forensics'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Fingerprint
                  className={`w-4 h-4 ${
                    currentView === 'forensics' ? 'text-emerald-400' : 'text-emerald-500/70'
                  }`}
                />
                <span>Forensics</span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </button>
          )}

          {/* Profile Navigation */}
          <button
            onClick={() => handleNavClick('profile')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              currentView === 'profile'
                ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/20 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
            }`}
          >
            <User className={`w-4 h-4 ${currentView === 'profile' ? 'text-blue-400' : 'text-slate-500'}`} />
            <span>My Profile</span>
          </button>

          {/* Admin / Owner Panel */}
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <button
              onClick={() => handleNavClick('admin')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? user?.role === 'owner'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                    : 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {user?.role === 'owner' ? (
                  <Crown className="w-4 h-4 text-amber-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                )}
                <span>{user?.role === 'owner' ? 'Owner Panel' : 'Admin Panel'}</span>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                user?.role === 'owner'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              }`}>
                {user?.role === 'owner' ? 'Owner' : 'Admin'}
              </span>
            </button>
          )}
        </nav>

        {/* Storage Meter */}
        <div className="p-4 border border-slate-800/80 bg-slate-950/60 m-3 rounded-2xl">
          <div className="flex items-center justify-between mb-2 text-slate-300">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold">My Drive</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                {isConnected ? 'Live' : 'Sync'}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent > 90 ? 'bg-red-500 shadow-sm shadow-red-500/50' : percent > 75 ? 'bg-amber-500' : 'bg-blue-500 shadow-sm shadow-blue-500/50'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between items-center text-[11px] text-slate-400 font-medium">
            <span>{formatBytes(used)} used</span>
            <span>{formatBytes(limit)}</span>
          </div>
        </div>

        {/* Footer Attribution */}
        <div className="px-4 pb-3 pt-0.5 text-center">
          <p className="text-[10px] text-slate-500 font-medium tracking-wide">
            Developed and Powered by{' '}
            <span className="font-bold text-slate-400 tracking-wider">ELETHIYA</span>
          </p>
        </div>
      </aside>
    </>
  );
}
