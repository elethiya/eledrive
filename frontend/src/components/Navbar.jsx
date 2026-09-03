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
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4 select-none shrink-0">
      {/* Search Input with Category Filter */}
      <div className="flex-1 max-w-2xl flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch && onSearch()}
            placeholder="Search files, code, folders..."
            className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-sm text-slate-800 rounded-xl pl-10 pr-9 py-2 border border-transparent focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                if (onSearch) onSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600 p-0.5 rounded-full"
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
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="capitalize">{searchType === 'all' ? 'Filter' : searchType}</span>
            <ChevronDown className="w-3 h-3 text-slate-600" />
          </button>

          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute right-0 top-11 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
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
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
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
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
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
            className="flex items-center gap-2.5 p-1 pr-2.5 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs"
              style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate hidden sm:inline">
              {user?.name || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-600 truncate">{user?.email}</p>
                  <span className="mt-1.5 inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded-full">
                    {user?.role === 'admin' ? 'Team Lead' : 'Team Member'}
                  </span>
                </div>

                {/* Switch Account Quick Helper */}
                <div className="p-2">
                  <span className="text-[11px] font-semibold text-slate-600 px-2 uppercase tracking-wider block mb-1">
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
                            ? 'bg-slate-50 text-slate-600 cursor-default'
                            : 'hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium'
                        }`}
                      >
                        <div>
                          <span className="block font-medium">{acc.name}</span>
                          <span className="text-[10px] text-slate-600 block">{acc.email}</span>
                        </div>
                        {isCurrent && <UserCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
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
