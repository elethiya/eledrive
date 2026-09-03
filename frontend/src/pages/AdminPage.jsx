import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  ScrollText,
  Settings,
  HardDrive,
  FileText,
  Share2,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  X,
  KeyRound,
  Shield,
  Save,
  Check,
  XCircle,
  Clock,
  UserCheck,
  Crown,
} from 'lucide-react';
import { adminAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatBytes, formatDate } from '../utils/formatters';

export default function AdminPage({ onBackToDrive }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'logs' | 'settings'

  // Admin Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Users Tab
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUserModal, setEditUserModal] = useState(null);

  // Logs Tab
  const [logs, setLogs] = useState([]);
  const [logAction, setLogAction] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Settings Tab
  const [settings, setSettings] = useState({
    site_name: 'EleDrive',
    default_quota_gb: 10,
    allow_public_registration: true,
    allow_public_shares: true,
    max_upload_size_mb: 1024,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // Check admin/owner privileges
  if (user?.role !== 'admin' && user?.role !== 'owner') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          You need Administrator permissions to access the EleDrive Admin Panel.
        </p>
        <button
          onClick={onBackToDrive}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Drive</span>
        </button>
      </div>
    );
  }

  useEffect(() => {
    loadStats();
    loadUsers();
    loadLogs();
    loadSettings();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await adminAPI.getStats();
      if (res.data) setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await adminAPI.listUsers();
      if (res.data) setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLogs = async (action = logAction, q = logSearch) => {
    setLoadingLogs(true);
    try {
      const res = await adminAPI.getLogs(action, q);
      if (res.data) setLogs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all activity logs?')) return;
    try {
      await adminAPI.clearLogs();
      loadLogs();
    } catch (e) {
      alert(e.message);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      if (res.data) setSettings(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    try {
      await adminAPI.updateSettings(settings);
      setSettingsSuccess('System settings updated successfully!');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveUser = async (u) => {
    try {
      await adminAPI.approveUser(u.id);
      loadStats();
      loadUsers();
    } catch (err) {
      alert(err.message || 'Failed to approve user');
    }
  };

  const handleRejectUser = async (u) => {
    if (!confirm(`Are you sure you want to reject account application for "${u.name}" (@${u.username})?`)) return;
    try {
      await adminAPI.rejectUser(u.id);
      loadStats();
      loadUsers();
    } catch (err) {
      alert(err.message || 'Failed to reject user');
    }
  };

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  const filteredUsers = users.filter((u) => {
    const match = userSearch.toLowerCase();
    const matchesSearch =
      !userSearch ||
      u.name?.toLowerCase().includes(match) ||
      u.email?.toLowerCase().includes(match) ||
      u.username?.toLowerCase().includes(match);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending'
        ? u.status === 'pending'
        : statusFilter === 'approved'
        ? (u.status === 'approved' || !u.status)
        : u.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 flex flex-col h-full">
      {/* Admin Header */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDrive}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
            title="Back to drive"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              user?.role === 'owner' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'
            }`}>
              {user?.role === 'owner' ? <Crown className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100">
                  {user?.role === 'owner' ? 'EleDrive Owner Console' : 'EleDrive Admin Console'}
                </h1>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full border ${
                  user?.role === 'owner'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                }`}>
                  {user?.role === 'owner' ? 'Owner' : 'Admin'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {user?.role === 'owner'
                  ? 'Highest workspace authority, administrator roles, security, and quotas'
                  : 'Team settings, user profile management, and audit logs'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Profiles</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('logs');
              loadLogs();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Activity Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>System Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-3.5 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-5 sm:space-y-6 flex-1">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{stats?.total_users || 0}</span>
          </div>

          <div className={`p-3.5 sm:p-4 rounded-2xl shadow-lg border transition-all ${
            (stats?.pending_approvals || 0) > 0
              ? 'bg-amber-950/30 border-amber-500/50 shadow-amber-500/10'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Pending Review</span>
              <Clock className={`w-4 h-4 ${(stats?.pending_approvals || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${(stats?.pending_approvals || 0) > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                {stats?.pending_approvals || 0}
              </span>
              {(stats?.pending_approvals || 0) > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                  Action Needed
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Files & Projects</span>
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{stats?.total_files || 0}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Storage Consumed</span>
              <HardDrive className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{formatBytes(stats?.total_storage_used || 0)}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-lg col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Active Links</span>
              <Share2 className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{stats?.total_share_links || 0}</span>
          </div>
        </div>

        {/* TAB 1: USERS MANAGEMENT & PROFILES */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">User Profiles & Account Approvals</h3>
                <p className="text-xs text-slate-400">
                  Verify new accounts, approve access, modify roles, and manage quotas
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Status Filter Pills */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      statusFilter === 'all'
                        ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      statusFilter === 'pending'
                        ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Pending</span>
                    {pendingCount > 0 && (
                      <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-extrabold text-[10px]">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setStatusFilter('approved')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      statusFilter === 'rejected'
                        ? 'bg-rose-600/30 text-rose-300 font-bold border border-rose-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rejected
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:border-purple-500 text-slate-100 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-5">User</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Storage Quota</th>
                    <th className="py-3 px-3">Files</th>
                    <th className="py-3 px-4">Registered</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredUsers.map((u) => {
                    const pct = Math.min(100, Math.round((u.storage_used / u.storage_limit) * 100));
                    const isPending = u.status === 'pending';
                    const isRejected = u.status === 'rejected';

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-5 flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: u.avatar_color }}
                          >
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 block">{u.name}</span>
                            <span className="text-[11px] text-slate-400 block">{u.email}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          {u.role === 'owner' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span>Owner</span>
                            </span>
                          ) : u.role === 'admin' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                              Member
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Pending Review</span>
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Approved</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 w-44">
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-1">
                            <div
                              className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{formatBytes(u.storage_used)}</span>
                            <span>{formatBytes(u.storage_limit)}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-300 font-medium">
                          {u.files_count || 0}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400">
                          {formatDate(u.created_at)}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApproveUser(u)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                  title="Approve user"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleRejectUser(u)}
                                  className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                                  title="Reject user"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setEditUserModal(u)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5 text-purple-400" />
                              <span className={isPending ? 'hidden sm:inline' : ''}>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVITY LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden space-y-4">
            <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">System Activity & Audit Logs</h3>
                <p className="text-xs text-slate-400">
                  Track team logins, file uploads, shares, and administrative actions
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={logAction}
                  onChange={(e) => {
                    setLogAction(e.target.value);
                    loadLogs(e.target.value, logSearch);
                  }}
                  className="text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 outline-none flex-1 sm:flex-initial"
                >
                  <option value="all">All Actions</option>
                  <option value="upload">Uploads</option>
                  <option value="login">Logins</option>
                  <option value="share">Shares</option>
                  <option value="delete">Deletions</option>
                  <option value="password_change">Password Changes</option>
                  <option value="admin_user_update">Admin Updates</option>
                </select>

                <div className="relative flex-1 md:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadLogs(logAction, logSearch)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none"
                  />
                </div>

                <button
                  onClick={() => loadLogs()}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                  title="Refresh logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleClearLogs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Timestamp</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Item</th>
                    <th className="py-3 px-6">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        No logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => {
                      const actionBadgeColor =
                        l.action === 'upload'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : l.action === 'login'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : l.action === 'share'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : l.action.includes('delete')
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                      return (
                        <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-6 text-slate-400 font-mono text-[11px]">
                            {new Date(l.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}{' '}
                            <span className="text-slate-600 text-[10px]">
                              {new Date(l.created_at).toLocaleDateString()}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {l.user_name}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${actionBadgeColor}`}
                            >
                              {l.action}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-300 font-medium truncate max-w-xs">
                            {l.item_name}
                          </td>

                          <td className="py-3 px-6 text-slate-400 text-[11px] truncate max-w-sm">
                            {l.details || '-'}
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

        {/* TAB 3: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 max-w-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-100">Global Drive Settings</h3>
              <p className="text-xs text-slate-400">Configure global parameters and security for EleDrive</p>
            </div>

            {settingsSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {settingsError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Platform / Workspace Name
                </label>
                <input
                  type="text"
                  value={settings.site_name}
                  onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Default User Quota (GB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settings.default_quota_gb}
                    onChange={(e) =>
                      setSettings({ ...settings, default_quota_gb: parseInt(e.target.value) || 10 })
                    }
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Max Upload File Size (MB)
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={settings.max_upload_size_mb}
                    onChange={(e) =>
                      setSettings({ ...settings, max_upload_size_mb: parseInt(e.target.value) || 1024 })
                    }
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      Allow Public Self-Registration
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Allow new teammates to create an account from the login screen
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allow_public_registration}
                    onChange={(e) =>
                      setSettings({ ...settings, allow_public_registration: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      Allow Public Share Links
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Allow users to generate public links for external guests to view/upload
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allow_public_shares}
                    onChange={(e) =>
                      setSettings({ ...settings, allow_public_shares: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 bg-slate-900 border-slate-700"
                  />
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      {/* Modal: Edit User Settings by Admin */}
      {editUserModal && (
        <EditUserAdminModal
          user={editUserModal}
          currentUserRole={user?.role}
          onClose={() => setEditUserModal(null)}
          onUpdated={() => {
            setEditUserModal(null);
            loadUsers();
            loadStats();
          }}
        />
      )}
    </div>
  );
}

function EditUserAdminModal({ user, currentUserRole, onClose, onUpdated }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status || 'approved');
  const [quotaGB, setQuotaGB] = useState(Math.round(user.storage_limit / (1024 * 1024 * 1024)));
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTargetOwner = user.role === 'owner';
  const isCallerOwner = currentUserRole === 'owner';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name: name.trim(),
      email: email.trim(),
      role: isTargetOwner ? 'owner' : role,
      status: status,
      storage_limit: quotaGB * 1024 * 1024 * 1024,
    };
    if (newPassword.trim()) {
      payload.password = newPassword.trim();
    }

    try {
      await adminAPI.updateUser(user.id, payload);
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isTargetOwner) {
      alert('The workspace Owner account cannot be deleted.');
      return;
    }
    if (user.role === 'admin' && !isCallerOwner) {
      alert('Only the workspace Owner can delete Administrator accounts.');
      return;
    }
    if (!confirm(`Delete user "${user.name}"? All their files and folders will be removed.`)) {
      return;
    }
    setLoading(true);
    try {
      await adminAPI.deleteUser(user.id);
      onUpdated();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-800 p-4 sm:p-6 animate-in zoom-in-95 duration-150 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isTargetOwner ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'
            }`}>
              {isTargetOwner ? <Crown className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Edit User Settings</h3>
                {isTargetOwner && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                    Owner
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>System Role</span>
                {isCallerOwner && !isTargetOwner && (
                  <span className="text-[9px] text-amber-400 font-semibold">Owner Authority</span>
                )}
              </label>
              {isTargetOwner ? (
                <div>
                  <div className="w-full px-3 py-2 bg-amber-950/30 border border-amber-500/40 rounded-xl text-amber-300 font-bold flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Workspace Owner</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">
                    Change owner with <code className="text-amber-300 font-mono">./set-owner.sh</code>
                  </p>
                </div>
              ) : isCallerOwner ? (
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none font-medium"
                >
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
              ) : (
                <div>
                  <select
                    disabled
                    value={role}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-slate-500 outline-none font-medium cursor-not-allowed"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <p className="text-[9px] text-amber-400/90 mt-1">
                    Only Owner can change Admin role
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Approval Status</label>
              <select
                value={status}
                disabled={isTargetOwner}
                onChange={(e) => setStatus(e.target.value)}
                className={`w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none font-medium ${
                  isTargetOwner ? 'cursor-not-allowed opacity-70' : ''
                }`}
              >
                <option value="approved">Approved & Active</option>
                <option value="pending">Pending Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Storage Quota (GB)</label>
            <input
              type="number"
              min={1}
              value={quotaGB}
              onChange={(e) => setQuotaGB(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-purple-400" />
              <span>Reset Password (Optional)</span>
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {!isTargetOwner && (user.role !== 'admin' || isCallerOwner) ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete User</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-500 italic">
                {isTargetOwner ? 'Owner cannot be deleted' : 'Only Owner can delete Admins'}
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-slate-400 hover:bg-slate-800 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-md"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
