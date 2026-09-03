import React, { useState, useEffect } from 'react';
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
  Folder,
  ArrowLeft,
  Settings,
  Mail,
  MoreVertical,
} from 'lucide-react';
import { teamAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
      alert(err.response?.data?.error || err.message);
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
        description: newTeamDesc.trim(),
        avatar_color: newTeamColor,
      });

      const createdTeam = res.data;
      // Add initial members if selected
      if (createdTeam && selectedInitialMembers.length > 0) {
        for (const userId of selectedInitialMembers) {
          try {
            await teamAPI.addMember(createdTeam.id, { user_id: userId, role: 'member' });
          } catch (e) {
            console.error(e);
          }
        }
      }

      setCreateModalOpen(false);
      setNewTeamName('');
      setNewTeamDesc('');
      setSelectedInitialMembers([]);
      loadTeams();
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || 'Failed to create team');
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
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!activeTeam) return;
    if (!confirm('Are you sure you want to remove this member from the team?')) return;
    try {
      await teamAPI.removeMember(activeTeam.id, userId);
      handleOpenTeam(activeTeam.id);
      loadTeams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) return;
    try {
      await teamAPI.deleteTeam(teamId);
      if (activeTeam?.id === teamId) setActiveTeam(null);
      loadTeams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete team');
    }
  };

  const safeTeams = Array.isArray(teams) ? teams : [];
  const filteredTeams = safeTeams.filter(
    (t) =>
      t &&
      (((t.name || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((t.description || '').toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Teams & Workspaces</h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
              {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create project teams, organize teammates, and collaborate with unified permissions
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Team</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Search Bar */}
        <div className="max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search teams by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((t) => {
              const isLeader = t.user_role === 'leader' || t.created_by_user_id === user?.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleOpenTeam(t.id)}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-md shrink-0"
                          style={{ backgroundColor: t.avatar_color || '#3b82f6' }}
                        >
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                            {t.name}
                          </h3>
                          <span className="text-[10px] text-slate-400">
                            Created by {t.creator_name || 'Team Leader'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          isLeader
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {isLeader ? 'Leader' : 'Member'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                      {t.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.members_count} {t.members_count === 1 ? 'member' : 'members'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTeam(t.id);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Create New Team</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
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
                              <div className="text-[10px] text-slate-500">{u.email}</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-lg shrink-0"
                  style={{ backgroundColor: activeTeam.avatar_color || '#3b82f6' }}
                >
                  {activeTeam.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-100">{activeTeam.name}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {activeTeam.members?.length || 0} Members
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeTeam.description || 'No description set'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTeam(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
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
                              au.email.toLowerCase().includes(addMemberQuery.toLowerCase()))
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
                              <span className="text-xs text-slate-200">{au.name}</span>
                              <span className="text-[10px] text-slate-500">({au.email})</span>
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

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
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
                                  <div className="text-[10px] text-slate-500">{m.email}</div>
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
