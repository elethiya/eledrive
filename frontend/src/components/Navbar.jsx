import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({
  searchQuery,
  setSearchQuery,
  searchType,
  setSearchType,
  viewMode,
  setViewMode,
  onSearch,
  onNavigateProfile,
  onNavigateAdmin,
}) {
  const { user, logout, login } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const filters = [
    { id: 'all', label: 'All files', icon: Filter },
    { id: 'code', label: 'Code & Projects', icon: Code2 },
    { id: 'document', label: 'Documents & PDFs', icon: FileText },
    { id: 'image', label: 'Images', icon: ImageIcon },
    { id: 'archive', label: 'Archives (ZIP/TAR)', icon: Archive },
  ];

  const demoAccounts = [
    { email: 'admin@eledrive.local', name: 'Admin User', role: 'Admin' },
    { email: 'alex@eledrive.local', name: 'Alex Miller', role: 'Teammate' },
    { email: 'sarah@eledrive.local', name: 'Sarah Connor', role: 'Teammate' },
  ];

  const handleSwitchAccount = async (email) => {
    try {
      await login(email, 'password123');
      setProfileOpen(false);
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between gap-4 select-none shrink-0 text-slate-100">
      {/* Search Input with Category Filter */}
      <div className="flex-1 max-w-2xl flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch && onSearch()}
            placeholder="Search files, code, folders..."
            className="w-full bg-slate-950/80 hover:bg-slate-950 focus:bg-slate-950 text-xs text-slate-100 placeholder:text-slate-500 rounded-xl pl-10 pr-9 py-2.5 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                if (onSearch) onSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              searchType !== 'all'
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="capitalize">{searchType === 'all' ? 'Filter' : searchType}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute right-0 top-11 w-48 bg-slate-850 bg-slate-900 rounded-xl shadow-2xl border border-slate-800 p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
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
      </div>

      {/* Right Controls: View Switcher & Profile */}
      <div className="flex items-center gap-3">
        {/* Grid vs List toggle */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'grid'
                ? 'bg-slate-800 text-blue-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-slate-800 text-blue-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1 pr-2.5 rounded-full hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-slate-800"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate hidden sm:inline">
              {user?.name || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
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
                  <span className="mt-1.5 inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                    {user?.role === 'admin' ? 'Team Lead' : 'Team Member'}
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

                  {user?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onNavigateAdmin();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-purple-300 hover:bg-purple-950/40 rounded-xl font-medium transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span>Admin Panel</span>
                      </div>
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold uppercase">
                        Admin
                      </span>
                    </button>
                  )}
                </div>

                {/* Switch Account Quick Helper */}
                <div className="p-2">
                  <span className="text-[10px] font-semibold text-slate-400 px-2 uppercase tracking-wider block mb-1">
                    Switch Teammate
                  </span>
                  {demoAccounts.map((acc) => {
                    const isCurrent = user?.email === acc.email;
                    return (
                      <button
                        key={acc.email}
                        disabled={isCurrent}
                        onClick={() => handleSwitchAccount(acc.email)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isCurrent
                            ? 'bg-slate-800/80 text-slate-400 cursor-default'
                            : 'hover:bg-slate-800 text-slate-300 font-medium'
                        }`}
                      >
                        <div>
                          <span className="block font-medium">{acc.name}</span>
                          <span className="text-[10px] text-slate-500 block">{acc.email}</span>
                        </div>
                        {isCurrent && <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
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
