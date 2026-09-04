import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Crown,
  Shield,
  ShieldCheck,
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
  Copy,
  CheckCircle2,
  FolderOpen,
  FileText,
  HardDrive,
  ExternalLink,
  Palette,
  Edit3,
  Share2,
  UserCheck,
  AlertTriangle,
  Lock,
  ArrowRightLeft,
  Info,
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

export default function TeamsPage({ onOpenFolder, onOpenFile, onOpenPreview }) {
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
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'shares' | 'settings'
  const [loadingTeamDetails, setLoadingTeamDetails] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member'); // 'member' | 'leader'
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Members filter inside active team
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all'); // 'all' | 'leaders' | 'members'

  // Team Shares State
  const [teamShares, setTeamShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [isRefreshingShares, setIsRefreshingShares] = useState(false);
  const [isRefreshingTeam, setIsRefreshingTeam] = useState(false);

  // Settings tab form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState(TEAM_COLORS[0]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [copiedTeamId, setCopiedTeamId] = useState(false);
  const [transferOwnerId, setTransferOwnerId] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    loadTeams(true);
    loadAvailableUsers();
  }, []);

  // Real-time Event Subscription for teams and members
  useRealtimeEvent(['team', 'sync'], () => {
    loadTeams(false);
    if (activeTeam?.id) {
      loadTeamShares(activeTeam.id, false);
    }
  });

  const loadTeams = async (showSpinner = false) => {
    if (showSpinner || teams.length === 0) setLoading(true);
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

  const loadTeamShares = async (teamId, isInitial = false) => {
    if (!teamId) return;
    if (isInitial) setLoadingShares(true);
    setIsRefreshingShares(true);
    try {
      const res = await teamAPI.getTeamShares(teamId);
      setTeamShares(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load team shares:', err);
      setTeamShares([]);
    } finally {
      if (isInitial) setLoadingShares(false);
      setTimeout(() => setIsRefreshingShares(false), 500);
    }
  };

  const refreshActiveTeam = async () => {
    if (!activeTeam?.id) return;
    setIsRefreshingTeam(true);
    try {
      const [teamRes, sharesRes] = await Promise.all([
        teamAPI.getTeam(activeTeam.id),
        teamAPI.getTeamShares(activeTeam.id),
      ]);
      if (teamRes.data) {
        setActiveTeam(teamRes.data);
      }
      if (sharesRes.data) {
        setTeamShares(Array.isArray(sharesRes.data) ? sharesRes.data : []);
      }
      toast.success('Team details refreshed');
    } catch (err) {
      console.error('Failed to refresh active team:', err);
      toast.error('Failed to refresh team');
    } finally {
      setTimeout(() => setIsRefreshingTeam(false), 500);
    }
  };

  const handleOpenTeam = async (teamId, defaultTab = 'members') => {
    setLoadingTeamDetails(true);
    try {
      const res = await teamAPI.getTeam(teamId);
      if (res.data) {
        setActiveTeam(res.data);
        setEditName(res.data.name || '');
        setEditDesc(res.data.description || '');
        setEditColor(res.data.avatar_color || TEAM_COLORS[0]);
        setActiveTab(defaultTab);
        setMemberSearchQuery('');
        setMemberRoleFilter('all');
        setTransferOwnerId('');
        loadTeamShares(teamId, true);
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
      await teamAPI.addMember(activeTeam.id, { user_id: userId, role: newMemberRole });
      setAddMemberQuery('');
      const res = await teamAPI.getTeam(activeTeam.id);
      if (res.data) setActiveTeam(res.data);
      loadTeams();
      toast.success(`Member added as ${newMemberRole}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleToggleMemberRole = async (targetUserId, currentRole) => {
    if (!activeTeam) return;
    const newRole = currentRole === 'leader' ? 'member' : 'leader';
    const actionLabel = newRole === 'leader' ? 'Promote to Leader' : 'Demote to Member';

    const ok = await confirm({
      title: `${actionLabel}?`,
      message: `Are you sure you want to change this member's role to ${newRole.toUpperCase()}? ${
        newRole === 'leader'
          ? 'They will gain privileges to manage members, team shares, and team settings.'
          : 'They will lose team administrative privileges.'
      }`,
      confirmText: actionLabel,
      variant: newRole === 'leader' ? 'info' : 'warning',
    });
    if (!ok) return;

    try {
      await teamAPI.updateMemberRole(activeTeam.id, targetUserId, { role: newRole });
      toast.success(`Member role updated to ${newRole}`);
      const res = await teamAPI.getTeam(activeTeam.id);
      if (res.data) setActiveTeam(res.data);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (userId, memberName = 'this member') => {
    if (!activeTeam) return;
    const isSelf = userId === user?.id;
    const ok = await confirm({
      title: isSelf ? 'Leave Team Workspace' : 'Remove Team Member',
      message: isSelf
        ? 'Are you sure you want to leave this team? You will immediately lose access to all shared team folders and documents.'
        : `Are you sure you want to remove ${memberName} from the team? They will lose access to all shared team resources.`,
      confirmText: isSelf ? 'Leave Team' : 'Remove Member',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      await teamAPI.removeMember(activeTeam.id, userId);
      if (isSelf) {
        setActiveTeam(null);
        toast.success('You have left the team');
      } else {
        const res = await teamAPI.getTeam(activeTeam.id);
        if (res.data) setActiveTeam(res.data);
        toast.success(`${memberName} removed from team`);
      }
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    if (!activeTeam) return;
    if (!editName.trim()) {
      toast.error('Team name cannot be empty');
      return;
    }

    setIsSavingSettings(true);
    try {
      await teamAPI.updateTeam(activeTeam.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        avatar_color: editColor,
      });
      toast.success('Team settings updated successfully');
      const res = await teamAPI.getTeam(activeTeam.id);
      if (res.data) setActiveTeam(res.data);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update team settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!activeTeam || !transferOwnerId) return;
    const targetMember = activeTeam.members?.find((m) => m.user_id === transferOwnerId);
    const targetName = targetMember ? targetMember.name : 'the selected member';

    const ok = await confirm({
      title: 'Transfer Team Ownership',
      message: `Are you sure you want to transfer primary ownership of "${activeTeam.name}" to ${targetName}? This action is irreversible.`,
      confirmText: 'Transfer Ownership',
      variant: 'danger',
    });
    if (!ok) return;

    setIsTransferring(true);
    try {
      await teamAPI.transferOwnership(activeTeam.id, { new_owner_id: transferOwnerId });
      toast.success(`Team ownership successfully transferred to ${targetName}`);
      setTransferOwnerId('');
      const res = await teamAPI.getTeam(activeTeam.id);
      if (res.data) setActiveTeam(res.data);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRemoveShare = async (shareId, targetName) => {
    if (!activeTeam) return;
    const ok = await confirm({
      title: 'Revoke Shared Resource',
      message: `Revoke "${targetName || 'this resource'}" from ${activeTeam.name}? Team members will immediately lose team-based access to it.`,
      confirmText: 'Revoke Access',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await teamAPI.removeTeamShare(activeTeam.id, shareId);
      toast.success('Resource revoked from team');
      loadTeamShares(activeTeam.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke resource');
    }
  };

  const handleCopyTeamId = (id) => {
    if (!id) return;
    navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopiedTeamId(true);
        toast.success('Team ID copied to clipboard');
        setTimeout(() => setCopiedTeamId(false), 2000);
      })
      .catch(() => {
        toast.info(`Team ID: ${id}`);
      });
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
      <div className="px-3.5 sm:px-6 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shadow-md shadow-blue-600/20 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                <span className="sm:hidden">Teams</span>
                <span className="hidden sm:inline">Teams & Workspaces</span>
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 shrink-0">
                {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block truncate mt-0.5">
              Create project teams, organize teammates, and collaborate with unified permissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
            title="Create New Team"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create New Team</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        {/* Search Bar */}
        <div className="w-full max-w-md relative">
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
          <div className="h-80 flex flex-col items-center justify-center text-center max-w-sm mx-auto p-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-slate-900 border border-slate-800 text-blue-400 flex items-center justify-center mb-4 shadow-xl">
              <Users className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 mb-1">
              {searchQuery ? 'No teams match your search' : 'No teams created yet'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
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
            {/* Table Header (Visible on sm: and up) */}
            <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none bg-slate-900/30 rounded-xl">
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

              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <span className="w-24 text-center">Role</span>

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

                <span className="w-56 sm:w-64 text-right pr-2">Actions</span>
              </div>
            </div>

            {/* List Rows */}
            <div className="space-y-2 sm:space-y-1.5">
              {sortedTeams.map((t) => {
                const isLeader = t.user_role === 'leader' || t.created_by_user_id === user?.id;
                return (
                  <React.Fragment key={t.id}>
                    {/* Mobile-Optimized Card View (< sm) */}
                    <div
                      onClick={() => handleOpenTeam(t.id, 'members')}
                      className="sm:hidden p-3.5 bg-slate-900/80 hover:bg-slate-850 active:bg-slate-800 rounded-2xl border border-slate-800/80 shadow-xs transition-all cursor-pointer space-y-2.5 select-none"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-md shrink-0 ring-1 ring-white/10"
                            style={{ backgroundColor: t.avatar_color || '#3b82f6' }}
                          >
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-100 truncate text-xs">{t.name}</span>
                              <span
                                className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                                  isLeader
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {isLeader ? 'Leader' : 'Member'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {t.description || 'No description provided.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-300 shrink-0 font-mono bg-slate-950 px-2 py-1 rounded-lg border border-slate-800/80">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{t.members_count || 0}</span>
                        </div>
                      </div>

                      {/* Mobile Quick Action Buttons Full-Width Bar */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTeam(t.id, 'members');
                          }}
                          className="flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg bg-slate-800/90 active:bg-blue-600 text-slate-200 active:text-white text-[11px] font-semibold transition-colors"
                        >
                          <Users className="w-3 h-3 text-blue-400" />
                          <span>Members</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTeam(t.id, 'shares');
                          }}
                          className="flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg bg-slate-800/90 active:bg-emerald-600 text-slate-200 active:text-white text-[11px] font-semibold transition-colors"
                        >
                          <FolderOpen className="w-3 h-3 text-emerald-400" />
                          <span>Shares</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTeam(t.id, 'settings');
                          }}
                          className="flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg bg-slate-800/90 active:bg-purple-600 text-slate-200 active:text-white text-[11px] font-semibold transition-colors"
                        >
                          <Settings className="w-3 h-3 text-purple-400" />
                          <span>Settings</span>
                        </button>
                      </div>
                    </div>

                    {/* Desktop/Tablet Row View (>= sm) */}
                    <div
                      onClick={() => handleOpenTeam(t.id, 'members')}
                      className="group hidden sm:flex items-center justify-between px-4 py-3 bg-slate-900/70 hover:bg-slate-850 active:bg-slate-800 rounded-xl border border-slate-800/80 hover:border-slate-700 hover:shadow-xs transition-all select-none cursor-pointer text-xs text-slate-200"
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
                        <div className="w-24 justify-center flex">
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
                        <div className="w-16 sm:w-24 flex items-center justify-center gap-1.5 text-xs text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t.members_count || 0}</span>
                        </div>

                        {/* Created Date */}
                        <span className="w-28 text-right hidden md:inline text-[11px] text-slate-500 font-mono">
                          {formatDate(t.created_at)}
                        </span>

                        {/* Action Buttons */}
                        <div className="w-56 sm:w-64 flex items-center justify-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTeam(t.id, 'members');
                            }}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 text-[11px] font-semibold transition-colors shrink-0"
                            title="View & manage members"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Members</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTeam(t.id, 'shares');
                            }}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-semibold transition-colors shrink-0"
                            title="View shared folders & files"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Shares</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTeam(t.id, 'settings');
                            }}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 text-[11px] font-semibold transition-colors shrink-0"
                            title="Team settings & danger zone"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Settings</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full border border-slate-800 p-4 sm:p-6 shadow-2xl shadow-black/80 space-y-4 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Ambient Top Glow */}
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10 shrink-0">
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

            <form onSubmit={handleCreateTeam} className="space-y-4 overflow-y-auto flex-1 pr-0.5">
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
                      className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-transform ${
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
                <div className="max-h-32 sm:max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 divide-y divide-slate-900">
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
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: u.avatar_color || '#3b82f6' }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-200 truncate">{u.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">@{u.username} • {u.email}</div>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 ${
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

              <div className="flex justify-end gap-2.5 pt-2 shrink-0">
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
      {activeTeam && (() => {
        const isOwner = activeTeam.created_by_user_id === user?.id || user?.role === 'admin' || user?.role === 'owner';
        const isLeader = activeTeam.user_role === 'leader' || isOwner;
        const canManage = isLeader || isOwner;

        const filteredMembers = (activeTeam.members || []).filter((m) => {
          const matchQuery =
            !memberSearchQuery ||
            m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
            (m.username && m.username.toLowerCase().includes(memberSearchQuery.toLowerCase())) ||
            m.email.toLowerCase().includes(memberSearchQuery.toLowerCase());
          if (!matchQuery) return false;

          if (memberRoleFilter === 'leaders') {
            return m.role === 'leader' || m.user_id === activeTeam.created_by_user_id;
          }
          if (memberRoleFilter === 'members') {
            return m.role === 'member' && m.user_id !== activeTeam.created_by_user_id;
          }
          return true;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md select-none">
            <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full border border-slate-800 shadow-2xl shadow-black/80 overflow-hidden flex flex-col h-[85vh] sm:h-[680px] max-h-[90vh]">
              {/* Ambient Top Glow */}
              <div className="absolute -top-16 -left-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="p-3.5 sm:p-5 border-b border-slate-800 bg-slate-950/60 relative z-10 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-white text-base sm:text-xl shadow-lg shrink-0 ring-1 ring-white/10"
                      style={{ backgroundColor: activeTeam.avatar_color || '#3b82f6' }}
                    >
                      {activeTeam.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-lg font-bold text-slate-100 truncate">{activeTeam.name}</h2>
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded border shrink-0 ${
                            isOwner
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : isLeader
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isOwner ? 'Owner' : isLeader ? 'Leader' : 'Member'}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {activeTeam.description || 'No description set for this team workspace.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={refreshActiveTeam}
                      disabled={isRefreshingTeam}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all group disabled:opacity-60"
                      title="Refresh team details and members"
                    >
                      <RefreshCw
                        className={`w-4 h-4 transition-transform duration-500 ${
                          isRefreshingTeam ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTeam(null)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1.5 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      activeTab === 'members'
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Members</span>
                    <span className="hidden sm:inline">Members & Roles</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {activeTeam.members?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('shares')}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      activeTab === 'shares'
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Shares</span>
                    <span className="hidden sm:inline">Shared Workspaces</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {teamShares.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      activeTab === 'settings'
                        ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="sm:hidden">Settings</span>
                    <span className="hidden sm:inline">Team Settings</span>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 relative z-10 flex-1">
                {/* TAB 1: MEMBERS & ROLES */}
                {activeTab === 'members' && (
                  <div className="space-y-4">
                    {/* Add Member Section */}
                    {canManage && (
                      <div className="p-3 sm:p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-emerald-400" />
                            <span>Add Teammate</span>
                          </h4>
                          <div className="flex items-center gap-1.5 self-start sm:self-auto">
                            <span className="text-[11px] text-slate-400 font-medium">Assign Role:</span>
                            <select
                              value={newMemberRole}
                              onChange={(e) => setNewMemberRole(e.target.value)}
                              className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                            >
                              <option value="member">Member</option>
                              <option value="leader">Leader</option>
                            </select>
                          </div>
                        </div>

                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Search teammates by name, username, or email..."
                            value={addMemberQuery}
                            onChange={(e) => setAddMemberQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                          />
                        </div>

                        {/* Dropdown list of available users matching query */}
                        {addMemberQuery.trim() && (
                          <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-850 divide-y divide-slate-855 bg-slate-900/60 p-1">
                            {availableUsers
                              .filter(
                                (au) =>
                                  !activeTeam.members?.some((m) => m.user_id === au.id) &&
                                  (au.name.toLowerCase().includes(addMemberQuery.toLowerCase()) ||
                                    au.email.toLowerCase().includes(addMemberQuery.toLowerCase()) ||
                                    (au.username && au.username.toLowerCase().includes(addMemberQuery.toLowerCase())))
                              )
                              .slice(0, 6)
                              .map((au) => (
                                <div
                                  key={au.id}
                                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                      style={{ backgroundColor: au.avatar_color || '#3b82f6' }}
                                    >
                                      {au.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-medium text-slate-200 block truncate">{au.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                                        @{au.username} • {au.email}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleAddMemberToActiveTeam(au.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold shrink-0 ml-2"
                                  >
                                    Add as {newMemberRole}
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Member Filters & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Filter team members..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                        />
                        {memberSearchQuery && (
                          <button
                            onClick={() => setMemberSearchQuery('')}
                            className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 sm:flex gap-1 shrink-0 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {['all', 'leaders', 'members'].map((rf) => (
                          <button
                            key={rf}
                            type="button"
                            onClick={() => setMemberRoleFilter(rf)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors text-center ${
                              memberRoleFilter === rf
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {rf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Members List Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Member</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3 hidden sm:table-cell">Joined</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-855">
                          {filteredMembers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                                No members found matching your search.
                              </td>
                            </tr>
                          ) : (
                            filteredMembers.map((m) => {
                              const isMemberOwner = m.user_id === activeTeam.created_by_user_id;
                              const isMemberLeader = m.role === 'leader';
                              const isSelf = m.user_id === user?.id;

                              return (
                                <tr key={m.id} className="hover:bg-slate-900/50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs"
                                        style={{ backgroundColor: m.avatar_color || '#3b82f6' }}
                                      >
                                        {m.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                                          <span>{m.name}</span>
                                          {isSelf && (
                                            <span className="text-[10px] text-blue-400 font-normal font-mono">(You)</span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono truncate">
                                          {m.username ? `@${m.username} • ${m.email}` : m.email}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    {isMemberOwner ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30">
                                        <Crown className="w-3 h-3 text-amber-400" />
                                        Owner
                                      </span>
                                    ) : isMemberLeader ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-blue-500/15 text-blue-300 border-blue-500/30">
                                        <ShieldCheck className="w-3 h-3 text-blue-400" />
                                        Leader
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-slate-800 text-slate-400 border-slate-700">
                                        Member
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap hidden sm:table-cell">
                                    {formatDate(m.joined_at)}
                                  </td>

                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* Role toggle button (Promote/Demote) */}
                                      {canManage && !isMemberOwner && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleMemberRole(m.user_id, m.role)}
                                          className={`p-1.5 rounded-lg border text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                                            isMemberLeader
                                              ? 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
                                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20'
                                          }`}
                                          title={isMemberLeader ? 'Demote to regular Member' : 'Promote to Team Leader'}
                                        >
                                          {isMemberLeader ? (
                                            <>
                                              <Shield className="w-3 h-3" />
                                              <span className="hidden md:inline">Demote</span>
                                            </>
                                          ) : (
                                            <>
                                              <Crown className="w-3 h-3" />
                                              <span className="hidden md:inline">Promote</span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                      {/* Remove or Leave button */}
                                      {isSelf ? (
                                        !isMemberOwner && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveMember(m.user_id, m.name)}
                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 text-[10px] font-semibold transition-colors flex items-center gap-1"
                                            title="Leave this team"
                                          >
                                            <UserMinus className="w-3 h-3" />
                                            <span className="hidden md:inline">Leave</span>
                                          </button>
                                        )
                                      ) : (
                                        canManage &&
                                        !isMemberOwner && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveMember(m.user_id, m.name)}
                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 text-[10px] font-semibold transition-colors flex items-center gap-1"
                                            title="Remove member from team"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            <span className="hidden md:inline">Remove</span>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: SHARED WORKSPACES / RESOURCES */}
                {activeTab === 'shares' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <FolderOpen className="w-4 h-4 text-emerald-400" />
                          <span>Resources Shared with {activeTeam.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Folders and files accessible to all members of this team.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => loadTeamShares(activeTeam.id)}
                        disabled={loadingShares || isRefreshingShares}
                        className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs flex items-center gap-1 transition-all group disabled:opacity-60"
                        title="Refresh shared resources"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 transition-transform duration-500 ${
                            isRefreshingShares ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                    </div>

                    {loadingShares && teamShares.length === 0 ? (
                      <div className="h-36 flex items-center justify-center text-xs text-slate-500">
                        Loading shared workspaces...
                      </div>
                    ) : teamShares.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-slate-800 bg-slate-950 text-center space-y-2">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                          <FolderOpen className="w-6 h-6" />
                        </div>
                        <h5 className="text-xs font-bold text-slate-200">No shared resources yet</h5>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          To share a folder or file with this entire team, navigate to the <span className="text-blue-400 font-semibold">Drive</span> page, click "Share", choose the <span className="text-blue-400 font-semibold">Team tab</span>, and select <span className="text-slate-200 font-medium">"{activeTeam.name}"</span>.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3">Resource</th>
                              <th className="py-2.5 px-3">Permission</th>
                              <th className="py-2.5 px-3 hidden sm:table-cell">Shared By</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-855">
                            {teamShares.map((s) => {
                              const isDrive = s.target_type === 'drive';
                              const isFolder = s.target_type === 'folder';
                              const displayName =
                                s.target_name && !s.target_name.toLowerCase().startsWith('unknown')
                                  ? s.target_name
                                  : isDrive
                                  ? `${s.shared_by_name || 'Owner'}'s Drive`
                                  : isFolder
                                  ? 'Shared Folder'
                                  : 'Shared File';

                              return (
                                <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                                          isDrive
                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                            : isFolder
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        }`}
                                      >
                                        {isDrive ? (
                                          <HardDrive className="w-4 h-4" />
                                        ) : isFolder ? (
                                          <Folder className="w-4 h-4" />
                                        ) : (
                                          <FileText className="w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-semibold text-slate-100 block truncate" title={displayName}>
                                          {displayName}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono capitalize">
                                          {s.target_type} • {formatDate(s.created_at)}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span
                                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                        s.permission === 'editor'
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                      }`}
                                    >
                                      {s.permission}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 text-[11px] text-slate-400 truncate hidden sm:table-cell">
                                    {s.shared_by_name}
                                  </td>

                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {(isFolder || isDrive) && onOpenFolder && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveTeam(null);
                                            onOpenFolder(isDrive ? '' : s.target_id);
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition-colors"
                                          title={isDrive ? 'Open Drive' : 'Open folder in Drive'}
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          <span>Open</span>
                                        </button>
                                      )}

                                      {s.target_type === 'file' && onOpenPreview && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveTeam(null);
                                            onOpenPreview({ id: s.target_id, name: displayName });
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition-colors"
                                          title="Preview file"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                          <span>Preview</span>
                                        </button>
                                      )}

                                      {canManage && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveShare(s.id, displayName)}
                                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 text-[11px] font-semibold transition-colors"
                                          title="Revoke access to this resource from the team"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: TEAM SETTINGS & DANGER ZONE */}
                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    {/* General Settings */}
                    <form onSubmit={handleSaveSettings} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-purple-400" />
                          <span>General Team Settings</span>
                        </h4>
                        {!canManage && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                            <Lock className="w-3 h-3" /> Read-only (Leaders only)
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Team Name *
                          </label>
                          <input
                            type="text"
                            value={editName}
                            disabled={!canManage || isSavingSettings}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Team Description
                          </label>
                          <textarea
                            rows={2}
                            value={editDesc}
                            disabled={!canManage || isSavingSettings}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="What does this team do?"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 disabled:opacity-50 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Color Theme
                          </label>
                          <div className="flex items-center gap-2.5">
                            {TEAM_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                disabled={!canManage || isSavingSettings}
                                onClick={() => setEditColor(c)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                                  editColor === c
                                    ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                                    : 'hover:scale-110'
                                } disabled:opacity-50`}
                                style={{ backgroundColor: c }}
                              >
                                {editColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={isSavingSettings}
                            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isSavingSettings ? 'Saving Changes...' : 'Save Team Changes'}</span>
                          </button>
                        </div>
                      )}
                    </form>

                    {/* Team ID & Metadata Section */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        <span>Team Identification & Details</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 bg-slate-900/70 rounded-xl border border-slate-850">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                            Team ID
                          </span>
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-200">
                            <span className="truncate">{activeTeam.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyTeamId(activeTeam.id)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                              title="Copy Team ID"
                            >
                              {copiedTeamId ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-900/70 rounded-xl border border-slate-850">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                            Created On
                          </span>
                          <div className="font-mono text-[11px] text-slate-200">
                            {formatDate(activeTeam.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ownership Transfer (Owners / Admins only) */}
                    {isOwner && (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-3">
                        <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                          <span>Transfer Team Ownership</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Transfer primary ownership to another member in this team. The new owner will have full control including the ability to delete the team workspace.
                        </p>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <select
                            value={transferOwnerId}
                            onChange={(e) => setTransferOwnerId(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-amber-500 min-w-0"
                          >
                            <option value="">Select a member to transfer ownership...</option>
                            {(activeTeam.members || [])
                              .filter((m) => m.user_id !== activeTeam.created_by_user_id)
                              .map((m) => (
                                <option key={m.id} value={m.user_id}>
                                  {m.name} ({m.email})
                                </option>
                              ))}
                          </select>

                          <button
                            type="button"
                            disabled={!transferOwnerId || isTransferring}
                            onClick={handleTransferOwnership}
                            className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shrink-0"
                          >
                            {isTransferring ? 'Transferring...' : 'Transfer Ownership'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Danger Zone */}
                    <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-3">
                      <h4 className="text-xs font-bold text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span>Danger Zone</span>
                      </h4>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            {isOwner ? 'Delete this Team Workspace' : 'Leave this Team Workspace'}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isOwner
                              ? 'Permanently delete this team and remove all member associations and shared folders.'
                              : 'Revoke your own membership. You will lose access to team folders.'}
                          </p>
                        </div>

                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(activeTeam.id)}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Team</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(user?.id)}
                            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 text-xs font-bold transition-colors shrink-0"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Leave Team</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 relative z-10 shrink-0">
                <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                  Workspace: <span className="text-slate-400 font-semibold">{activeTeam.name}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTeam(null)}
                  className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
