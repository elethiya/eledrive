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
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            EleDrive
          </span>
          <span className="text-[10px] font-semibold tracking-wider block text-slate-600 uppercase">
            Team Workspace
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-600/25 transition-all duration-150 font-medium text-sm group"
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
            <div className="absolute left-4 right-4 top-20 bg-white rounded-2xl shadow-2xl border border-slate-100 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onNewFolder();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-xl font-medium transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>New Folder</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-xl font-medium transition-colors"
              >
                <Upload className="w-4 h-4 text-blue-500" />
                <span>Upload Files</span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  folderInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-xl font-medium transition-colors"
              >
                <FolderUp className="w-4 h-4 text-indigo-500" />
                <div>
                  <span className="block">Upload Folder / Project</span>
                  <span className="text-[11px] text-slate-600 block">Preserves hierarchy</span>
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-blue-600' : 'text-slate-600'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Storage Meter */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 m-3 rounded-2xl">
        <div className="flex items-center gap-2 mb-2 text-slate-700">
          <Cloud className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold">Team Storage</span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
          <span>{formatBytes(used)} used</span>
          <span>{formatBytes(limit)}</span>
        </div>
      </div>
    </aside>
  );
}
