import React, { useState, useRef } from 'react';
import {
  HardDrive,
  Users,
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
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';

export default function Sidebar({
  currentView,
  setCurrentView,
  onNewFolder,
  onUploadFiles,
  onUploadFolder,
}) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const used = user?.storage_used || 0;
  const limit = user?.storage_limit || 10 * 1024 * 1024 * 1024;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  const navItems = [
    { id: 'drive', label: 'My Drive', icon: HardDrive },
    { id: 'shared', label: 'Shared with me', icon: Users },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleFolderChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFolder(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 text-slate-200">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            EleDrive
          </span>
          <span className="text-[10px] font-semibold tracking-wider block text-slate-400 uppercase">
            Team Workspace
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl shadow-lg shadow-blue-600/30 transition-all duration-150 font-medium text-sm group"
        >
          <div className="flex items-center gap-2.5">
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" />
            <span>New Item</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute left-4 right-4 top-20 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/80 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onNewFolder();
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
              onClick={() => setCurrentView(item.id)}
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

        {/* Profile Navigation */}
        <button
          onClick={() => setCurrentView('profile')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
            currentView === 'profile'
              ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/20 shadow-xs'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
          }`}
        >
          <User className={`w-4 h-4 ${currentView === 'profile' ? 'text-blue-400' : 'text-slate-500'}`} />
          <span>My Profile</span>
        </button>

        {/* Admin Panel (If user.role === 'admin') */}
        {user?.role === 'admin' && (
          <button
            onClick={() => setCurrentView('admin')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              currentView === 'admin'
                ? 'bg-purple-600/20 text-purple-400 font-semibold border border-purple-500/20 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-purple-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className={`w-4 h-4 ${currentView === 'admin' ? 'text-purple-400' : 'text-purple-500'}`} />
              <span>Admin Panel</span>
            </div>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300 rounded-md border border-purple-500/30">
              Admin
            </span>
          </button>
        )}
      </nav>

      {/* Storage Meter */}
      <div className="p-4 border border-slate-800/80 bg-slate-950/60 m-3 rounded-2xl">
        <div className="flex items-center gap-2 mb-2 text-slate-300">
          <Cloud className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold">Team Storage</span>
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
    </aside>
  );
}
