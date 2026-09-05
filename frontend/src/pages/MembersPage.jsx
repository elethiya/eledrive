import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Crown,
  ShieldCheck,
  User,
  UserCheck,
  Mail,
  Copy,
  Check,
  Clock,
  Layers,
  ChevronRight,
  List,
  X,
} from 'lucide-react';
import { memberAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { formatDate } from '../utils/formatters';

export default function MembersPage({ onNavigateView }) {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'owner' | 'admin' | 'team_member' | 'user'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline'
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' (categorized list) | 'list' (all accounts list)
  const [selectedMember, setSelectedMember] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Load members from API
  const loadMembers = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const res = await memberAPI.getMembers();
      const data = res?.data !== undefined ? res.data : res;
      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error('Failed to load workspace members:', err);
      toast.error('Could not load workspace members');
    } finally {
      setLoading(false);
      if (showIndicator) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    loadMembers(false);
  }, [loadMembers]);

  // Real-time presence updates: instant switch when users go online / offline
  useRealtimeEvent(['presence', 'user', 'team'], (event) => {
    if (!event) return;

    // Direct presence update event
    if (event.type === 'presence:update' && event.id) {
      const isOnline = event.action === 'online';
      setMembers((prev) =>
        prev.map((m) => (m.id === event.id ? { ...m, is_online: isOnline, last_seen: Date.now() } : m))
      );
    } else {
      // Reload on user or team changes
      loadMembers(false);
    }
  });

  // Periodic subtle presence polling fallback (every 20s)
  useEffect(() => {
    const interval = setInterval(() => {
      memberAPI
        .getPresence()
        .then((res) => {
          const data = res?.data !== undefined ? res.data : res;
          if (data && data.presence) {
            setMembers((prev) =>
              prev.map((m) => ({
                ...m,
                is_online: !!data.presence[m.id],
              }))
            );
          }
        })
        .catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Copy email to clipboard helper
  const handleCopyEmail = (email, id) => {
    if (!email || email === '[Owner Protected]') return;
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Categorize helper
  const getCategoryMeta = (category) => {
    switch (category) {
      case 'owner':
        return {
          title: 'Workspace Owner',
          singular: 'Owner',
          icon: Crown,
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
          dotBg: 'bg-amber-400',
          accentColor: 'text-amber-400',
        };
      case 'admin':
        return {
          title: 'Administrators',
          singular: 'Administrator',
          icon: ShieldCheck,
          badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
          dotBg: 'bg-purple-400',
          accentColor: 'text-purple-400',
        };
      case 'team_member':
        return {
          title: 'Team Members',
          singular: 'Team Member',
          icon: Users,
          badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
          dotBg: 'bg-blue-400',
          accentColor: 'text-blue-400',
        };
      case 'user':
      default:
        return {
          title: 'Users',
          singular: 'User',
          icon: User,
          badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
          dotBg: 'bg-slate-400',
          accentColor: 'text-slate-400',
        };
    }
  };

  // Summary counts
  const stats = useMemo(() => {
    const total = members.length;
    const online = members.filter((m) => m.is_online).length;
    const offline = total - online;
    const ownerCount = members.filter((m) => m.category === 'owner').length;
    const adminCount = members.filter((m) => m.category === 'admin').length;
    const teamMemberCount = members.filter((m) => m.category === 'team_member').length;
    const userCount = members.filter((m) => m.category === 'user').length;

    // Unique teams represented
    const teamSet = new Set();
    members.forEach((m) => {
      if (Array.isArray(m.teams)) {
        m.teams.forEach((t) => teamSet.add(t.name));
      }
    });

    return {
      total,
      online,
      offline,
      ownerCount,
      adminCount,
      teamMemberCount,
      userCount,
      teamsCount: teamSet.size,
    };
  }, [members]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Category filter
      if (categoryFilter !== 'all' && m.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'online' && !m.is_online) return false;
      if (statusFilter === 'offline' && m.is_online) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchUsername = m.username?.toLowerCase().includes(q);
        const matchEmail = m.email?.toLowerCase().includes(q);
        const matchTeams = Array.isArray(m.teams) && m.teams.some((t) => t.name?.toLowerCase().includes(q));
        const matchCategory = m.category?.toLowerCase().includes(q);
        if (!matchName && !matchUsername && !matchEmail && !matchTeams && !matchCategory) {
          return false;
        }
      }

      return true;
    });
  }, [members, categoryFilter, statusFilter, searchQuery]);

  // Grouped members for 'grouped' view mode
  const groupedCategories = useMemo(() => {
    const order = ['owner', 'admin', 'team_member', 'user'];
    return order
      .map((catKey) => {
        const items = filteredMembers.filter((m) => m.category === catKey);
        const meta = getCategoryMeta(catKey);
        return {
          key: catKey,
          meta,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [filteredMembers]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header Bar matching platform views */}
      <div className="px-3.5 sm:px-6 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                Workspace Members
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 shrink-0">
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </span>
              {stats.online > 0 && (
                <span className="hidden xs:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{stats.online} Online</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 hidden sm:block truncate mt-0.5">
              Directory of workspace users, active online status, and team assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadMembers(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-xl text-xs font-semibold transition-all group disabled:opacity-60 shadow-xs"
            title="Refresh member directory"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isRefreshing ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && onNavigateView && (
            <button
              type="button"
              onClick={() => onNavigateView('admin')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
              title="Manage users in Admin Panel"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Panel</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
        {/* Filter and Control Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-sm">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search members by name, @username, email, or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          {/* Controls: Online/Offline Filter + View Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Online/Offline Status Filter Pills */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('online')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'online'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online ({stats.online})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('offline')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'offline'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Offline ({stats.offline})
              </button>
            </div>

            {/* View Mode Toggle: Grouped List vs All Accounts List */}
            <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'grouped' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Separated by Category groups in list format"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Grouped List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  viewMode === 'list' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="All accounts in a single list table"
              >
                <List className="w-3.5 h-3.5" />
                <span>All Accounts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Tabs Bar (Separated in categories: Owner, Admins, Team Member, User) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/20'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <span>All Members</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                categoryFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {stats.total}
            </span>
          </button>

          {/* Owner Tab */}
          <button
            type="button"
            onClick={() => setCategoryFilter('owner')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'owner'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Owner</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                categoryFilter === 'owner' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {stats.ownerCount}
            </span>
          </button>

          {/* Admins Tab */}
          <button
            type="button"
            onClick={() => setCategoryFilter('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'admin'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Admins</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                categoryFilter === 'admin' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {stats.adminCount}
            </span>
          </button>

          {/* Team Member Tab */}
          <button
            type="button"
            onClick={() => setCategoryFilter('team_member')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'team_member'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Team Member</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                categoryFilter === 'team_member' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {stats.teamMemberCount}
            </span>
          </button>

          {/* User Tab */}
          <button
            type="button"
            onClick={() => setCategoryFilter('user')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              categoryFilter === 'user'
                ? 'bg-slate-700 text-slate-100 border border-slate-600 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>User</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                categoryFilter === 'user' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {stats.userCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Members Presentation */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto opacity-75" />
          <p className="text-xs text-slate-400 font-medium">Loading workspace member directory...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/70 text-slate-500 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">No members match your criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query, status filter, or category selection.
          </p>
          {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all inline-block mt-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' && categoryFilter === 'all' ? (
        /* 1. Grouped List View: Separated into Owner, Admins, Team Member, User in List Format */
        <div className="space-y-6">
          {groupedCategories.map((group) => {
            const GroupIcon = group.meta.icon;
            const onlineCount = group.items.filter((m) => m.is_online).length;
            return (
              <div key={group.key} className="space-y-2.5">
                {/* Category Group Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${group.meta.badgeBg}`}>
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-black text-slate-100 tracking-tight flex items-center gap-2">
                      <span>{group.meta.title}</span>
                      <span className="text-xs font-semibold text-slate-500">({group.items.length})</span>
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    <span className="text-emerald-400 font-semibold">{onlineCount}</span> online
                  </span>
                </div>

                {/* Accounts List Table in this Category */}
                <AccountsTable
                  members={group.items}
                  showCategoryColumn={false}
                  onSelectMember={setSelectedMember}
                  onCopyEmail={handleCopyEmail}
                  copiedId={copiedId}
                  currentUser={currentUser}
                  getCategoryMeta={getCategoryMeta}
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* 2. All Accounts List View or Single Category Filtered List View */
        <div className="space-y-2.5">
          {categoryFilter !== 'all' && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <span className="text-xs text-slate-400">
                Showing {filteredMembers.length} {filteredMembers.length === 1 ? 'account' : 'accounts'} in{' '}
                <span className="font-bold text-slate-200">
                  {getCategoryMeta(categoryFilter).title}
                </span>
              </span>
            </div>
          )}
          <AccountsTable
            members={filteredMembers}
            showCategoryColumn={categoryFilter === 'all'}
            onSelectMember={setSelectedMember}
            onCopyEmail={handleCopyEmail}
            copiedId={copiedId}
            currentUser={currentUser}
            getCategoryMeta={getCategoryMeta}
          />
        </div>
      )}
      </div>

      {/* Member Details Modal / Slideover */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          meta={getCategoryMeta(selectedMember.category)}
          onClose={() => setSelectedMember(null)}
          onCopyEmail={() => handleCopyEmail(selectedMember.email, selectedMember.id)}
          copied={copiedId === selectedMember.id}
          currentUser={currentUser}
          onNavigateView={onNavigateView}
        />
      )}
    </div>
  );
}

// Subcomponent: Accounts Table List
function AccountsTable({
  members,
  showCategoryColumn = false,
  onSelectMember,
  onCopyEmail,
  copiedId,
  currentUser,
  getCategoryMeta,
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 min-w-[720px]">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Account</th>
              <th className="py-3 px-4">Status</th>
              {showCategoryColumn && <th className="py-3 px-4">Category</th>}
              <th className="py-3 px-4">Assigned Teams</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {members.map((m) => {
              const meta = getCategoryMeta(m.category);
              const CategoryIcon = meta.icon;
              const isCurrent = currentUser?.id === m.id;
              return (
                <tr
                  key={m.id}
                  onClick={() => onSelectMember(m)}
                  className="hover:bg-slate-850/60 transition-colors cursor-pointer group"
                >
                  {/* Account Name, Avatar & Username */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs uppercase shadow-xs"
                          style={{ backgroundColor: m.avatar_color || '#3b82f6' }}
                        >
                          {m.name?.[0] || 'U'}
                        </div>
                        {/* Live Online / Offline status dot on avatar */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                            m.is_online ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate">
                            {m.name}
                          </span>
                          {m.category === 'owner' && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Workspace Owner" />
                          )}
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono block leading-tight">
                          @{m.username}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Active Status: Online or Offline */}
                  <td className="py-3.5 px-4">
                    {m.is_online ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 text-[11px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>Offline</span>
                      </span>
                    )}
                  </td>

                  {/* Category Column (shown if showCategoryColumn is true) */}
                  {showCategoryColumn && (
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${meta.badgeBg}`}
                      >
                        <CategoryIcon className="w-3.5 h-3.5" />
                        <span>{meta.singular}</span>
                      </span>
                    </td>
                  )}

                  {/* Assigned Teams */}
                  <td className="py-3.5 px-4">
                    {Array.isArray(m.teams) && m.teams.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.teams.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-950 text-slate-300 border border-slate-800"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.color || '#3b82f6' }}
                            />
                            <span className="truncate max-w-[120px]">{t.name}</span>
                            {t.role === 'leader' && (
                              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider ml-0.5">
                                Leader
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px] italic">Individual (No Team)</span>
                    )}
                  </td>

                  {/* Email with copy button */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 font-mono text-xs truncate max-w-[170px]">
                        {m.email || '—'}
                      </span>
                      {m.email && m.email !== '[Owner Protected]' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyEmail(m.email, m.id);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-850 transition-colors"
                          title="Copy email"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMember(m);
                      }}
                      className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 border border-slate-800 group-hover:border-slate-700"
                    >
                      <span>Profile</span>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Subcomponent: Member Details Modal
function MemberDetailModal({ member, meta, onClose, onCopyEmail, copied, currentUser, onNavigateView }) {
  const CategoryIcon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Member Profile Banner */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl uppercase shadow-md"
              style={{ backgroundColor: member.avatar_color || '#3b82f6' }}
            >
              {member.name?.[0] || 'U'}
            </div>
            {/* Live Online Badge */}
            {member.is_online ? (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900" />
              </span>
            ) : (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-600 border-2 border-slate-900" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-100 truncate">{member.name}</h2>
              {member.is_online && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  Online
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">@{member.username}</p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-bold border ${meta.badgeBg}`}
              >
                <CategoryIcon className="w-3.5 h-3.5" />
                <span>{meta.title}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 space-y-3">
          {/* Email */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>Email</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-200 font-mono">{member.email}</span>
              {member.email && member.email !== '[Owner Protected]' && (
                <button
                  type="button"
                  onClick={onCopyEmail}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                  title="Copy email"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Current Status</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${member.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className={member.is_online ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {member.is_online ? 'Active / Online Now' : 'Offline / Standby'}
              </span>
            </div>
          </div>

          {/* Joined At */}
          {member.created_at && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
              <span className="text-slate-400">Member Since</span>
              <span className="text-slate-300 font-mono">{formatDate(member.created_at)}</span>
            </div>
          )}
        </div>

        {/* Team Memberships */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Assigned Teams ({Array.isArray(member.teams) ? member.teams.length : 0})</span>
          </h4>

          {Array.isArray(member.teams) && member.teams.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {member.teams.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color || '#3b82f6' }} />
                    <span className="text-xs font-bold text-slate-200">{t.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      t.role === 'leader'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {t.role === 'leader' ? 'Team Leader' : 'Team Member'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-center">
              Not assigned to any team workspace.
            </p>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800/80">
          {member.email && member.email !== '[Owner Protected]' ? (
            <a
              href={`mailto:${member.email}`}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Send Email</span>
            </a>
          ) : (
            <div />
          )}

          {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && onNavigateView ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateView('admin');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Manage User</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
