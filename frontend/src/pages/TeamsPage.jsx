import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Crown,
  Shield,
  Trash2,
  UserPlus,
  UserMinus,
  Search,
  Check,
  X,
  RefreshCw,
  ArrowUpDown,
  Folder,
  ArrowLeft,
  Settings,
  Mail,
  MoreVertical,
} from 'lucide-react';
import { teamAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { formatDate } from '../utils/formatters';

const TEAM_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

export default function TeamsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Create Team Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);
  const [selectedInitialMembers, setSelectedInitialMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Manage / Details Modal
  const [activeTeam, setActiveTeam] = useState(null);
  const [loadingTeamDetails, setLoadingTeamDetails] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    loadTeams();
    loadAvailableUsers();
  }, []);

  // Real-time Event Subscription for teams and members
  useRealtimeEvent(['team', 'sync'], () => {
    loadTeams();
  });

  const loadTeams = async () => {
    setLoading(true);
    try {
      const res = await teamAPI.listTeams();
      if (Array.isArray(res.data)) {
        setTeams(res.data);
      } else {
        setTeams([]);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await teamAPI.getAvailableUsers();
      if (Array.isArray(res.data)) {
        setAvailableUsers(res.data);
      } else {
        setAvailableUsers([]);
      }
    } catch (err) {
      console.error('Failed to load available users:', err);
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenTeam = async (teamId) => {
    setLoadingTeamDetails(true);
    try {
      const res = await teamAPI.getTeam(teamId);
      if (res.data) {
        setActiveTeam(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoadingTeamDetails(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setCreateError('Team name cannot be empty');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const res = await teamAPI.createTeam({
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
        avatar_color: newTeamColor,
      });

      const createdTeam = res.data;
      if (selectedInitialMembers.length > 0 && createdTeam?.id) {
        for (const userId of selectedInitialMembers) {
          try {
            await teamAPI.addMember(createdTeam.id, { user_id: userId, role: 'member' });
          } catch (mErr) {
            console.warn('Failed to add initial member:', mErr);
          }
        }
      }

      setCreateModalOpen(false);
      setNewTeamName('');
      setNewTeamDesc('');
      setSelectedInitialMembers([]);
      loadTeams();
      toast.success(`Team "${createdTeam?.name || 'New Team'}" created successfully!`);
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create team');
      toast.error(err.response?.data?.error || err.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleAddMemberToActiveTeam = async (userId) => {
    if (!activeTeam) return;
    try {
      await teamAPI.addMember(activeTeam.id, { user_id: userId, role: 'member' });
      handleOpenTeam(activeTeam.id);
      loadTeams();
      toast.success('Member added to team!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!activeTeam) return;
    const ok = await confirm({
      title: 'Remove Team Member',
      message: 'Are you sure you want to remove this member from the team? They will lose access to all shared team folders.',
      confirmText: 'Remove Member',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      await teamAPI.removeMember(activeTeam.id, userId);
      handleOpenTeam(activeTeam.id);
      loadTeams();
      toast.success('Member removed from team');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    const ok = await confirm({
      title: 'Delete Team Workspace',
      message: 'Are you sure you want to delete this team? This action cannot be undone and all team members will lose access.',
      confirmText: 'Delete Team',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await teamAPI.deleteTeam(teamId);
      if (activeTeam?.id === teamId) setActiveTeam(null);
      loadTeams();
      toast.success('Team deleted successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete team');
    }
  };

  const safeTeams = Array.isArray(teams) ? teams : [];
  const filteredTeams = safeTeams.filter(
    (t) =>
      t &&
      (((t.name || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((t.description || '').toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const sortedTeams = useMemo(() => {
    const list = [...filteredTeams];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'members') {
        comparison = (a.members_count || 0) - (b.members_count || 0);
      } else if (sortField === 'created_at') {
        comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredTeams, sortField, sortOrder]);

  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate">Teams & Workspaces</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 shrink-0">
                {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block truncate mt-0.5">
              Create project teams, organize teammates, and collaborate with unified permissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await loadTeams();
              } finally {
                setTimeout(() => setIsRefreshing(false), 600);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-slate-100 border border-slate-800 rounded-xl text-xs font-semibold transition-all group disabled:opacity-60 shadow-xs"
            title="Refresh teams"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isRefreshing ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
            title="Create New Team"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create New Team</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Search Bar */}
        <div className="max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search teams by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-500">
            Loading team workspaces...
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 text-blue-400 flex items-center justify-center mb-4 shadow-xl">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-100 mb-1">
              {searchQuery ? 'No teams match your search' : 'No teams created yet'}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Create a team to easily organize teammates and share folders with everyone at once.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Team</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Table Header (Unified single Team Name & Sort header on desktop and mobile) */}
            <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none bg-slate-900/30 rounded-xl">
              <button
                onClick={() => handleHeaderSort('name')}
                className="flex items-center gap-1.5 hover:text-slate-200 transition-colors flex-1 text-left font-bold"
                title="Sort by Team Name"
              >
                <span>Team Name</span>
                {sortField === 'name' ? (
                  <span className="text-blue-400 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                )}
              </button>

              <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                <span className="w-24 text-center hidden sm:inline">Role</span>

                <button
                  onClick={() => handleHeaderSort('members')}
                  className="w-16 sm:w-24 text-center hover:text-slate-200 transition-colors font-bold flex items-center justify-center gap-1"
                  title="Sort by Members"
                >
                  <span>Members</span>
                  {sortField === 'members' && (
                    <span className="text-blue-400 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>

                <button
                  onClick={() => handleHeaderSort('created_at')}
                  className="w-28 text-right hidden md:inline hover:text-slate-200 transition-colors font-bold"
                  title="Sort by Created Date"
                >
                  <span>Created</span>
                  {sortField === 'created_at' && (
                    <span className="text-blue-400 ml-1 font-bold">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>

                <span className="w-16 sm:w-20 text-right pr-2 hidden sm:inline">Actions</span>
              </div>
            </div>

            {/* List Rows */}
            <div className="space-y-1.5">
              {sortedTeams.map((t) => {
                const isLeader = t.user_role === 'leader' || t.created_by_user_id === user?.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTeam(t.id)}
                    className="group flex items-center justify-between px-4 py-3 bg-slate-900/70 hover:bg-slate-850 active:bg-slate-800 rounded-xl border border-slate-800/80 hover:border-slate-700 hover:shadow-xs transition-all select-none cursor-pointer text-xs text-slate-200"
                  >
                    {/* Team info: Avatar + Name + Description */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 ring-1 ring-white/10"
                        style={{ backgroundColor: t.avatar_color || '#3b82f6' }}
                      >
                        {t.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors truncate">
                            {t.name}
                          </span>
                          {(t.creator_name || t.creator_username) && (
                            <span className="text-[10px] text-slate-400 font-mono hidden lg:inline">
                              by {t.creator_name} {t.creator_username && `(@${t.creator_username})`}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-xl">
                          {t.description || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    {/* Meta and actions */}
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-slate-400">
                      {/* Role Pill */}
                      <div className="w-24 justify-center hidden sm:flex">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isLeader
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isLeader ? 'Leader' : 'Member'}
                        </span>
                      </div>

                      {/* Members Count */}
                      <div className="w-24 flex items-center justify-center gap-1.5 text-xs text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t.members_count || 0}</span>
                      </div>

                      {/* Created Date */}
                      <span className="w-28 text-right hidden md:inline text-[11px] text-slate-500 font-mono">
                        {formatDate(t.created_at)}
                      </span>

                      {/* Action Button */}
                      <div className="w-16 sm:w-20 text-right flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTeam(t.id);
                          }}
                          className="flex items-center justify-center gap-1.5 p-1.5 sm:px-3 sm:py-1 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 text-[11px] font-semibold transition-colors shadow-xs"
                          title="Manage team"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Manage</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          <div className="relative bg-slate-900 rounded-3xl max-w-md w-full border border-slate-800 p-5 sm:p-6 shadow-2xl shadow-black/80 space-y-4 overflow-hidden">
            {/* Ambient Top Glow */}
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shadow-md shadow-blue-500/10">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Create New Team</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Team Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Engineers, Design Team, Project Alpha"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the team's role or purpose..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              {/* Color Theme */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Team Color Theme
                </label>
                <div className="flex items-center gap-2.5">
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTeamColor(c)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        newTeamColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {newTeamColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Teammates Checklist */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Add Teammates Now ({selectedInitialMembers.length} selected)
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 divide-y divide-slate-900">
                  {availableUsers.length === 0 ? (
                    <div className="p-3 text-center text-slate-500 text-xs">
                      No other approved users in workspace yet.
                    </div>
                  ) : (
                    availableUsers.map((u) => {
                      const isSelected = selectedInitialMembers.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedInitialMembers(selectedInitialMembers.filter((id) => id !== u.id));
                            } else {
                              setSelectedInitialMembers([...selectedInitialMembers, u.id]);
                            }
                          }}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: u.avatar_color || '#3b82f6' }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-200">{u.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">@{u.username} • {u.email}</div>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {createError && (
                <p className="text-xs text-red-400 font-medium">{createError}</p>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Details / Manage Modal */}
      {activeTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          <div className="relative bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-800 shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Ambient Top Glow */}
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4 relative z-10 shrink-0">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg sm:text-xl shadow-lg shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: activeTeam.avatar_color || '#3b82f6' }}
                >
                  {activeTeam.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-100">{activeTeam.name}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {activeTeam.members?.length || 0} Members
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {activeTeam.description || 'No description set'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTeam(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 relative z-10">
              {/* Add Member Section */}
              {(activeTeam.user_role === 'leader' || activeTeam.created_by_user_id === user?.id || user?.role === 'admin' || user?.role === 'owner') && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>Add Member to Team</span>
                  </h4>

                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search available teammates by name or email..."
                        value={addMemberQuery}
                        onChange={(e) => setAddMemberQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    {/* Filtered available users list */}
                    <div className="max-h-32 overflow-y-auto rounded-xl divide-y divide-slate-850">
                      {availableUsers
                        .filter(
                          (au) =>
                            !activeTeam.members?.some((m) => m.user_id === au.id) &&
                            (au.name.toLowerCase().includes(addMemberQuery.toLowerCase()) ||
                              au.email.toLowerCase().includes(addMemberQuery.toLowerCase()) ||
                              (au.username && au.username.toLowerCase().includes(addMemberQuery.toLowerCase())))
                        )
                        .slice(0, 5)
                        .map((au) => (
                          <div
                            key={au.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                style={{ backgroundColor: au.avatar_color || '#3b82f6' }}
                              >
                                {au.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-xs font-medium text-slate-200 block">{au.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">@{au.username} • {au.email}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddMemberToActiveTeam(au.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold"
                            >
                              Add
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Members Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Team Members ({activeTeam.members?.length || 0})
                </h4>

                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Joined</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {activeTeam.members?.map((m) => {
                        const isMemberLeader = m.role === 'leader';
                        return (
                          <tr key={m.id} className="hover:bg-slate-900/50">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                  style={{ backgroundColor: m.avatar_color || '#3b82f6' }}
                                >
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                    <span>{m.name}</span>
                                    {isMemberLeader && (
                                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {m.username ? `@${m.username} • ${m.email}` : m.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  isMemberLeader
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {m.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-500">
                              {formatDate(m.joined_at)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {m.user_id !== user?.id &&
                                (activeTeam.user_role === 'leader' ||
                                  activeTeam.created_by_user_id === user?.id ||
                                  user?.role === 'admin' ||
                                  user?.role === 'owner') && (
                                  <button
                                    onClick={() => handleRemoveMember(m.user_id)}
                                    className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Remove member"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              {(activeTeam.created_by_user_id === user?.id || user?.role === 'admin' || user?.role === 'owner') ? (
                <button
                  onClick={() => handleDeleteTeam(activeTeam.id)}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Team</span>
                </button>
              ) : (
                <button
                  onClick={() => handleRemoveMember(user?.id)}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Leave Team</span>
                </button>
              )}

              <button
                onClick={() => setActiveTeam(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
