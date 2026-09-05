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
  const [statusCategory, setStatusCategory] = useState('all'); // 'all' | 'online' | 'offline'
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

  // Filtered members based on statusCategory ('all', 'online', 'offline') and search
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Status category filter: online or offline
      if (statusCategory === 'online' && !m.is_online) return false;
      if (statusCategory === 'offline' && m.is_online) return false;

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
  }, [members, statusCategory, searchQuery]);

  const onlineMembers = useMemo(() => filteredMembers.filter((m) => m.is_online), [filteredMembers]);
  const offlineMembers = useMemo(() => filteredMembers.filter((m) => !m.is_online), [filteredMembers]);

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

          {/* Controls: Online/Offline Category Tabs */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatusCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>All</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-400">
                  {stats.total}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusCategory('online')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'online'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${statusCategory === 'online' ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400'}`}>
                  {stats.online}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusCategory('offline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusCategory === 'offline'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Offline</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${statusCategory === 'offline' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400'}`}>
                  {stats.offline}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Members Presentation: Separate Containers for Online and Offline Sections */}
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
            Try adjusting your search query or selecting a different category.
          </p>
          {(searchQuery || statusCategory !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusCategory('all');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all inline-block mt-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 pb-6">
          {/* Online Members Section Container */}
          {(statusCategory === 'all' || statusCategory === 'online') && (
            <section className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              {/* Online Section Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
                        Online Members
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30">
                        {onlineMembers.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Currently active on the workspace</p>
                  </div>
                </div>
              </div>

              {/* Responsive Grid: 1 profile (mobile), 2 profiles (tablet), 3 profiles per row (desktop) */}
              {onlineMembers.length === 0 ? (
                <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/50">
                  <p className="text-xs text-slate-500 italic">
                    {searchQuery ? 'No online members match your search' : 'No members currently online'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {onlineMembers.map((m) => (
                    <MemberProfileCard
                      key={m.id}
                      m={m}
                      meta={getCategoryMeta(m.category)}
                      isCurrent={currentUser?.id === m.id}
                      onSelectMember={setSelectedMember}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Offline Members Section Container */}
          {(statusCategory === 'all' || statusCategory === 'offline') && (
            <section className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              {/* Offline Section Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-slate-600 inline-block" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
                        Offline Members
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-mono font-bold border border-slate-700">
                        {offlineMembers.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Currently offline or away</p>
                  </div>
                </div>
              </div>

              {/* Responsive Grid: 1 profile (mobile), 2 profiles (tablet), 3 profiles per row (desktop) */}
              {offlineMembers.length === 0 ? (
                <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/50">
                  <p className="text-xs text-slate-500 italic">
                    {searchQuery ? 'No offline members match your search' : 'No offline members'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {offlineMembers.map((m) => (
                    <MemberProfileCard
                      key={m.id}
                      m={m}
                      meta={getCategoryMeta(m.category)}
                      isCurrent={currentUser?.id === m.id}
                      onSelectMember={setSelectedMember}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
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

// Subcomponent: Member Profile Card (Clean list card: No emails/teams, 3 per row on desktop, opens profile floating window)
function MemberProfileCard({ m, meta, isCurrent, onSelectMember }) {
  const CategoryIcon = meta.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectMember(m)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectMember(m);
        }
      }}
      className="p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 cursor-pointer group shadow-xs hover:shadow-lg hover:-translate-y-0.5 flex flex-col justify-between gap-3 text-left focus:outline-none focus:ring-1 focus:ring-blue-500/50"
    >
      {/* Top: Avatar & User Identity */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="relative shrink-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm uppercase shadow-xs select-none"
            style={{ backgroundColor: m.avatar_color || '#3b82f6' }}
          >
            {m.name?.[0] || 'U'}
          </div>
          {/* Live Online / Offline status dot on avatar */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${
              m.is_online ? 'bg-emerald-400' : 'bg-slate-600'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate text-xs sm:text-sm">
              {m.name}
            </h3>
            {m.category === 'owner' && (
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Workspace Owner" />
            )}
            {isCurrent && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                You
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-mono block truncate mt-0.5">
            @{m.username}
          </span>
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${meta.badgeBg}`}
            >
              <CategoryIcon className="w-3 h-3" />
              <span>{meta.title}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Online Status & View Profile link */}
      <div className="pt-2.5 border-t border-slate-800/70 flex items-center justify-between gap-2">
        {m.is_online ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Offline</span>
          </span>
        )}

        <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-blue-400 font-semibold transition-colors">
          <span>Profile</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Member Details Modal
function MemberDetailModal({ member, meta, onClose, onCopyEmail, copied, currentUser, onNavigateView }) {
  const CategoryIcon = meta.icon;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
