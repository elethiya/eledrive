import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  LogOut,
  UserCheck,
  Code2,
  FileText,
  Image as ImageIcon,
  Archive,
  ChevronDown,
  X,
  Filter,
  User,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';

export default function Navbar({
  onToggleSidebar,
  searchQuery,
  setSearchQuery,
  searchType,
  setSearchType,
  onSearch,
  onNavigateProfile,
  onNavigateAdmin,
}) {
  const { user, logout, login } = useAuth();
  const { isConnected } = useRealtime();
  const [profileOpen, setProfileOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Global shortcut: '/' or 'Ctrl+K' focuses search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setMobileSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filters = [
    { id: 'all', label: 'All files', icon: Filter },
    { id: 'code', label: 'Code & Projects', icon: Code2 },
    { id: 'document', label: 'Documents & PDFs', icon: FileText },
    { id: 'image', label: 'Images', icon: ImageIcon },
    { id: 'archive', label: 'Archives (ZIP/TAR)', icon: Archive },
  ];

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900 px-4 sm:px-6 flex items-center justify-between gap-2.5 sm:gap-4 select-none shrink-0 text-slate-100 relative">
      {/* Left: Mobile hamburger menu & Search toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 -ml-1 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition-colors"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="sm:hidden p-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition-colors"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Center Search Input (hidden on xs unless mobileSearchOpen is true) */}
      <div
        className={`flex-1 max-w-2xl flex items-center gap-2 ${
          mobileSearchOpen
            ? 'absolute inset-x-3 top-2.5 z-30 bg-slate-900 p-1.5 rounded-2xl border border-slate-700 shadow-2xl flex sm:static sm:p-0 sm:border-0 sm:shadow-none'
            : 'hidden sm:flex'
        }`}
      >
        <div className="relative flex-1 group">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (onSearch) onSearch();
                setMobileSearchOpen(false);
              }
            }}
            placeholder="Search files, code, folders... (Press / to search)"
            className="w-full bg-slate-950/80 hover:bg-slate-950 focus:bg-slate-950 text-xs text-slate-100 placeholder:text-slate-500 rounded-xl pl-9 pr-16 py-2.5 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-hidden transition-all shadow-inner"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  if (onSearch) onSearch('');
                }}
                className="text-slate-500 hover:text-slate-300 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden lg:inline-flex items-center text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800/80">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              searchType !== 'all'
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:bg-slate-800/80'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="capitalize hidden md:inline">{searchType === 'all' ? 'All Types' : searchType}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Close button for mobile search bar overlay */}
          {mobileSearchOpen && (
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="sm:hidden p-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition-colors shrink-0 ml-1"
              title="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute right-0 top-11 w-48 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                {filters.map((f) => {
                  const Icon = f.icon;
                  const isSelected = searchType === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSearchType(f.id);
                        setFilterOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-400 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {mobileSearchOpen && (
          <button
            onClick={() => setMobileSearchOpen(false)}
            className="sm:hidden p-2 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right Controls: Realtime Status + Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Webhook/SSE Live Sync indicator */}
        <div
          className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] font-mono select-none"
          title={isConnected ? 'Real-time sync connected' : 'Connecting to real-time events...'}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className={isConnected ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
            {isConnected ? 'Live' : 'Sync'}
          </span>
        </div>

        {/* Profile Avatar & Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-full hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-slate-800"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-200 max-w-[100px] truncate hidden md:inline">
              {user?.name || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-12 w-64 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-2 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2.5 border-b border-slate-800">
                  <p className="text-xs font-bold text-slate-100 truncate">{user?.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <span className={`mt-1.5 inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${
                    user?.role === 'owner'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : user?.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    {user?.role === 'owner' ? 'Workspace Owner' : user?.role === 'admin' ? 'Administrator' : 'Team Member'}
                  </span>
                </div>

                {/* Direct Links */}
                <div className="p-1 space-y-0.5 border-b border-slate-800">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigateProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded-xl font-medium transition-colors"
                  >
                    <User className="w-4 h-4 text-blue-400" />
                    <span>My Profile & Settings</span>
                  </button>

                  {(user?.role === 'admin' || user?.role === 'owner') && (
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigateAdmin();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-purple-300 hover:bg-purple-950/40 rounded-xl font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span>{user?.role === 'owner' ? 'Owner Console' : 'Admin Panel'}</span>
                      </div>
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold uppercase">
                        {user?.role === 'owner' ? 'Owner' : 'Admin'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
