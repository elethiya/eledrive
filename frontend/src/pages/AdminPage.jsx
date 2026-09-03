import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  ScrollText,
  Settings,
  HardDrive,
  FileText,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  X,
  Shield,
  Save,
  Check,
  XCircle,
  Clock,
  UserCheck,
  Crown,
  Fingerprint,
  UploadCloud,
  FileSearch,
  Copy,
  ExternalLink,
  Lock,
  Download,
  AlertTriangle,
  FileCode,
  Archive,
  Eye,
} from 'lucide-react';
import { adminAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatDate } from '../utils/formatters';

export default function AdminPage({ onBackToDrive }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'security' | 'logs' | 'settings'

  // Admin Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Security & Forensic Leak Tracker
  const [securityStats, setSecurityStats] = useState(null);
  const [loadingSecurityStats, setLoadingSecurityStats] = useState(false);
  const [inspectQuery, setInspectQuery] = useState('');
  const [inspectFile, setInspectFile] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [inspectError, setInspectError] = useState('');
  const [copiedUUID, setCopiedUUID] = useState('');
  const fileDropRef = useRef(null);

  // Users Tab
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUserModal, setEditUserModal] = useState(null);
  const [viewUserModal, setViewUserModal] = useState(null);

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
        <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/30">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          You need Administrator or Owner privileges to access this area.
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
    loadSecurityStats();
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

  const loadSecurityStats = async () => {
    setLoadingSecurityStats(true);
    try {
      const res = await adminAPI.getSecurityStats();
      if (res.data) setSecurityStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSecurityStats(false);
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

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await adminAPI.getLogs(logAction === 'all' ? '' : logAction, logSearch);
      if (res.data) setLogs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      if (res.data) {
        setSettings({
          site_name: res.data.site_name || 'EleDrive',
          default_quota_gb: res.data.default_quota_gb || 10,
          allow_public_registration: res.data.allow_public_registration ?? true,
          allow_public_shares: res.data.allow_public_shares ?? true,
          max_upload_size_mb: res.data.max_upload_size_mb || 1024,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyUUID = (uuid) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUUID(uuid);
    setTimeout(() => setCopiedUUID(''), 2500);
  };

  const handleRunForensicInspection = async (e) => {
    if (e) e.preventDefault();
    if (!inspectFile && !inspectQuery.trim()) {
      setInspectError('Please select a suspect file to analyze or enter a Secret UUID.');
      return;
    }

    setInspecting(true);
    setInspectError('');
    setInspectionResult(null);

    try {
      let res;
      if (inspectFile) {
        const formData = new FormData();
        formData.append('file', inspectFile);
        if (inspectQuery.trim()) {
          formData.append('query', inspectQuery.trim());
        }
        res = await adminAPI.inspectLeak(formData);
      } else {
        res = await adminAPI.inspectLeak({ query: inspectQuery.trim() });
      }

      if (res.data) {
        setInspectionResult(res.data);
      }
    } catch (err) {
      setInspectError(err.response?.data?.error || err.message || 'Forensic analysis failed to find matching asset.');
    } finally {
      setInspecting(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    try {
      await adminAPI.updateSettings(settings);
      setSettingsSuccess('Platform settings updated successfully.');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.error || err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleApproveUser = async (id) => {
    try {
      await adminAPI.approveUser(id);
      loadUsers();
      loadStats();
      toast.success('User account approved!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve user');
    }
  };

  const handleRejectUser = async (id) => {
    const ok = await confirm({
      title: 'Reject Account Request',
      message: 'Are you sure you want to reject this pending user registration?',
      confirmText: 'Reject Account',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await adminAPI.rejectUser(id);
      loadUsers();
      loadStats();
      toast.success('User account request rejected');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject user');
    }
  };

  const handleDeleteUser = async (id) => {
    const ok = await confirm({
      title: 'Delete User & Storage',
      message: 'Are you sure you want to permanently delete this user account and all of their uploaded storage? This cannot be undone.',
      confirmText: 'Delete User Permanently',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await adminAPI.deleteUser(id);
      loadUsers();
      loadStats();
      toast.success('User account deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleClearLogs = async () => {
    const ok = await confirm({
      title: 'Clear Activity Logs',
      message: 'Are you sure you want to clear all forensic activity logs? This action cannot be undone.',
      confirmText: 'Clear All Logs',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await adminAPI.clearLogs();
      loadLogs();
      toast.success('Activity logs cleared');
    } catch (err) {
      toast.error('Failed to clear logs');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isOwner = user?.role === 'owner';

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header Bar */}
      <header className="h-16 px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToDrive}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Drive</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${
                isOwner
                  ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-purple-500/20'
              }`}
            >
              {isOwner ? <Crown className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100">
                  {isOwner ? 'EleDrive Workspace Owner Console' : 'EleDrive Admin Console'}
                </h1>
                <span
                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                    isOwner
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}
                >
                  {isOwner ? 'Owner Level' : 'Admin'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Workspace Governance • Cryptographic Forensic Leak Attribution
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadStats();
              loadUsers();
              loadLogs();
              loadSecurityStats();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Executive Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Total Users</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-100">
              {loadingStats ? '...' : stats?.total_users ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              {stats?.pending_approvals > 0 ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 animate-pulse">
                  {stats.pending_approvals} Pending Approval
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> All approved
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Forensic Assets</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-100">
              {loadingStats ? '...' : (stats?.total_files ?? 0) + (stats?.total_folders ?? 0)}
            </div>
            <div className="mt-2 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 100% Watermarked & Tracked
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Storage Usage</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-100">
              {loadingStats ? '...' : formatBytes(stats?.total_storage_used ?? 0)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Across {stats?.total_files ?? 0} files in workspace
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Protection Engine</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1">
              Steganographic & Cryptographic
            </div>
            <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              ACTIVE • SHA-256 HMAC
            </div>
          </div>
        </div>

        {/* Tab Navigation Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users Management</span>
            {stats?.pending_approvals > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                {stats.pending_approvals}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'security'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Forensic Leak Tracker</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
              NEW
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'logs'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span>Audit & Activity Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Platform Settings</span>
          </button>
        </div>

        {/* TAB 1: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search & Status Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user name, email, or handle..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {['all', 'pending', 'approved', 'rejected'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all shrink-0 ${
                      statusFilter === st
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Storage Usage</th>
                      <th className="py-3.5 px-4">Registered</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          Loading accounts...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No users found matching filter.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const usagePct = Math.min(100, Math.round((u.storage_used / (u.storage_limit || 1)) * 100));
                        return (
                          <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => setViewUserModal(u)}
                                className="flex items-center gap-3 text-left group hover:opacity-95 focus:outline-hidden"
                                title="Click to view full user profile & activity"
                              >
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 ring-2 ring-slate-800 group-hover:ring-blue-500/50 transition-all shadow-xs"
                                  style={{ backgroundColor: u.avatar_color || '#3b82f6' }}
                                >
                                  {u.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="truncate max-w-[200px]">
                                  <div className="font-semibold text-slate-100 flex items-center gap-1.5 group-hover:text-blue-400 transition-colors">
                                    <span>{u.name}</span>
                                    {u.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    @{u.username} • {u.email}
                                  </div>
                                </div>
                              </button>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  u.role === 'owner'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : u.role === 'admin'
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  u.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : u.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="w-32">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                  <span>{formatBytes(u.storage_used)}</span>
                                  <span>{formatBytes(u.storage_limit)}</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      usagePct > 90 ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${usagePct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                              {formatDate(u.created_at)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {u.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApproveUser(u.id)}
                                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                      title="Approve User Account"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleRejectUser(u.id)}
                                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                      title="Reject User Account"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setViewUserModal(u)}
                                  className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                  title="View User Full Details & Activity"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {u.role === 'owner' && user?.role !== 'owner' ? (
                                  <span
                                    className="p-1.5 rounded-lg bg-slate-900/60 text-slate-600 cursor-not-allowed inline-flex items-center justify-center"
                                    title="Admins cannot edit or change the Owner's storage limit"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setEditUserModal(u)}
                                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                                    title={u.role === 'owner' ? 'Edit Self & Storage Limit' : 'Edit User'}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {u.role !== 'owner' && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-1.5 rounded-lg bg-slate-800 text-red-400 hover:bg-red-500/20 transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
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
          </div>
        )}

        {/* TAB 2: FORENSIC LEAK TRACKER & WATERMARK DETECTIVE */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Explainer Hero Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/20 shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                    <Fingerprint className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <span>Cryptographic Forensic Leak Tracker</span>
                      <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        100% Attributed
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                      Every file, folder, image, video, and archive uploaded to EleDrive is injected with a permanent, tamper-proof forensic signature, embedded metadata atom, and secret cryptographic UUID. Even if an exfiltrated file is renamed, cropped, edited, or converted, its embedded signature remains detectable to identify the exact leaker.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-300">Total Downloads Logged</div>
                    <div className="text-lg font-mono font-black text-emerald-400">
                      {securityStats?.total_downloads_logged ?? 0} events
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Pillars of Protection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5" /> Steganographic Trailer
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Appended HMAC signed block surviving crops, hex tampering, and re-encodes.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5" /> Secret UUID Binding
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Every asset receives a unique 128-bit cryptographic identifier tied to uploader & download logs.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5 mb-1">
                    <Archive className="w-3.5 h-3.5" /> ZIP Archive Manifest
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Folder ZIP downloads automatically embed hidden forensic manifests & metadata comments.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                    <Lock className="w-3.5 h-3.5" /> 100% Invisible Digital Trap
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Completely hidden from users during normal browsing; only revealed when scanned by admin.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Leak Detective Form */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileSearch className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Inspect Suspect File or Secret UUID
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Uncover origin, uploader identity & full download trail
                </span>
              </div>

              <form onSubmit={handleRunForensicInspection} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File Upload Zone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Upload Leaked File / Media (Image, Video, Document, Archive):
                    </label>
                    <div
                      onClick={() => fileDropRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/80 flex flex-col items-center justify-center min-h-[110px]"
                    >
                      <input
                        ref={fileDropRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setInspectFile(e.target.files[0]);
                          }
                        }}
                      />
                      {inspectFile ? (
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                            <FileCode className="w-5 h-5" />
                          </div>
                          <div className="truncate max-w-[220px]">
                            <p className="text-xs font-bold text-slate-200 truncate">{inspectFile.name}</p>
                            <p className="text-[10px] text-slate-400">{formatBytes(inspectFile.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setInspectFile(null);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="w-6 h-6 text-slate-500 mb-1.5" />
                          <span className="text-xs font-medium text-slate-300">
                            Drop suspect file here or <span className="text-blue-400 underline">browse</span>
                          </span>
                          <span className="text-[10px] text-slate-500 mt-1">
                            Extracts binary forensic trailer & embedded metadata
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Secret UUID Manual Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Or Enter Secret UUID / Filename Query:
                    </label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Fingerprint className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          placeholder="e.g. 7f8b2c4e-1234-5678-abcd-0987654321fe"
                          value={inspectQuery}
                          onChange={(e) => setInspectQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Matches against all past and current assets, even if the filename was changed.
                      </p>
                    </div>
                  </div>
                </div>

                {inspectError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  {(inspectFile || inspectQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectFile(null);
                        setInspectQuery('');
                        setInspectionResult(null);
                        setInspectError('');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={inspecting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {inspecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analyzing Cryptographic Watermark...</span>
                      </>
                    ) : (
                      <>
                        <FileSearch className="w-4 h-4" />
                        <span>Run Forensic Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Inspection Result Dossier */}
              {inspectionResult && (
                <div className="mt-6 p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
                  {/* Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                          Cryptographic Match Verified
                        </div>
                        <div className="text-sm font-black text-slate-100">
                          Origin Asset Identified: {inspectionResult.original_filename}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-900 border border-emerald-500/30 text-emerald-400">
                        HMAC-SHA256: VALID
                      </span>
                    </div>
                  </div>

                  {/* Attributed Leaker Information Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        Attributed Original Uploader
                      </h4>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                          {inspectionResult.uploader_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-100">
                            {inspectionResult.uploader_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            @{inspectionResult.uploader_username} • {inspectionResult.uploader_email}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            User ID: {inspectionResult.uploader_id}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Uploaded Date:</span>
                          <span className="text-slate-300 font-medium">
                            {inspectionResult.uploaded_at ? formatDate(inspectionResult.uploaded_at) : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">File Size:</span>
                          <span className="text-slate-300 font-medium">
                            {formatBytes(inspectionResult.file_size)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-blue-400" />
                        Forensic Signature Details
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                            Secret Tracking UUID:
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-blue-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 select-all truncate">
                              {inspectionResult.secret_uuid}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyUUID(inspectionResult.secret_uuid)}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                              title="Copy Secret UUID"
                            >
                              {copiedUUID === inspectionResult.secret_uuid ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {inspectionResult.sha256_checksum && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                              SHA256 File Checksum:
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 break-all select-all">
                              {inspectionResult.sha256_checksum}
                            </span>
                          </div>
                        )}

                        <div className="pt-2">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                            Forensic Verdict:
                          </span>
                          <p className="text-xs text-emerald-300 font-medium">
                            {inspectionResult.metadata_summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exfiltration & Download History Table */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Download className="w-4 h-4 text-indigo-400" />
                      Chain of Custody & Download Trail ({inspectionResult.download_history?.length || 0} events)
                    </h4>

                    {(!inspectionResult.download_history || inspectionResult.download_history.length === 0) ? (
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
                        No external download records found for this asset. The file was likely exfiltrated directly by the uploader.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3">Downloader</th>
                              <th className="py-2.5 px-3">IP Address</th>
                              <th className="py-2.5 px-3">Client / Browser</th>
                              <th className="py-2.5 px-3">Downloaded At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                            {inspectionResult.download_history.map((dl) => (
                              <tr key={dl.id} className="hover:bg-slate-900/60">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-200">{dl.user_name}</div>
                                  <div className="text-[10px] text-slate-500">{dl.user_email}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-blue-400 text-[11px]">
                                  {dl.ip_address}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-400 truncate max-w-[200px]" title={dl.user_agent}>
                                  {dl.user_agent || 'Standard HTTP Client'}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-400">
                                  {formatDate(dl.downloaded_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Forensic Tracked Files List */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    Recently Protected & Tracked Files
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Assets carrying active Secret UUIDs and HMAC signatures
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                  {securityStats?.total_tracked_files ?? 0} Protected Files
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Uploader</th>
                      <th className="py-3 px-4">Secret UUID</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {(!securityStats?.recent_tracked_files || securityStats.recent_tracked_files.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No tracked files uploaded yet.
                        </td>
                      </tr>
                    ) : (
                      securityStats.recent_tracked_files.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {f.name}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-300">
                            {f.owner_name}
                            <span className="block text-[10px] text-slate-500">{f.owner_email}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-blue-400">
                            <div className="flex items-center gap-1.5">
                              <span>{f.secret_uuid?.slice(0, 16)}...</span>
                              <button
                                onClick={() => handleCopyUUID(f.secret_uuid)}
                                className="text-slate-500 hover:text-slate-300"
                                title="Copy UUID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-400">
                            {formatBytes(f.size)}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-400">
                            {formatDate(f.created_at)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setInspectQuery(f.secret_uuid);
                                setInspectFile(null);
                                window.scrollTo({ top: 300, behavior: 'smooth' });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition-colors"
                            >
                              Load In Scanner
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT & SYSTEM LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter activity logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={logAction}
                  onChange={(e) => setLogAction(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Actions</option>
                  <option value="upload">Uploads</option>
                  <option value="download">Downloads</option>
                  <option value="share">Shares</option>
                  <option value="create_folder">Folder Creation</option>
                  <option value="delete">Deletions</option>
                  <option value="ownership_transferred">Ownership</option>
                </select>

                <button
                  onClick={handleClearLogs}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Logs</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Timestamp</th>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Action</th>
                      <th className="py-3.5 px-4">Target Item</th>
                      <th className="py-3.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          Loading audit records...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          No activity records recorded.
                        </td>
                      </tr>
                    ) : (
                      logs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {formatDate(l.created_at)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {l.user_name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] uppercase font-bold text-slate-300">
                              {l.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-100 truncate max-w-[200px]">
                            {l.item_name}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {l.details || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PLATFORM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Global System Configuration
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure defaults, storage allocations, security policies and registration controls.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Default User Quota (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={settings.default_quota_gb}
                    onChange={(e) =>
                      setSettings({ ...settings, default_quota_gb: parseInt(e.target.value) || 10 })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Max File Upload Limit (MB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={settings.max_upload_size_mb}
                    onChange={(e) =>
                      setSettings({ ...settings, max_upload_size_mb: parseInt(e.target.value) || 1024 })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Watermark Policy Status */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Forensic Attribution Policies (Enforced)
                </h4>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Cryptographic Secret UUID per Asset</span>
                    <span className="text-emerald-400 font-bold font-mono">ENABLED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Steganographic Binary Trailer Watermark</span>
                    <span className="text-emerald-400 font-bold font-mono">ENABLED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Folder ZIP Forensic Manifest Embedding</span>
                    <span className="text-emerald-400 font-bold font-mono">ENABLED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Invisible Steganographic Digital Canary (Hidden)</span>
                    <span className="text-emerald-400 font-bold font-mono">ENABLED</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_public_registration}
                    onChange={(e) =>
                      setSettings({ ...settings, allow_public_registration: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Allow Public Registration</div>
                    <div className="text-[11px] text-slate-400">
                      When enabled, new users can sign up (subject to admin approval).
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_public_shares}
                    onChange={(e) =>
                      setSettings({ ...settings, allow_public_shares: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Allow Public Share Links</div>
                    <div className="text-[11px] text-slate-400">
                      Allow users to generate public shareable links with password and expiry controls.
                    </div>
                  </div>
                </label>
              </div>

              {settingsSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{settingsError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving Settings...' : 'Save Configuration'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Edit User Account</h3>
              <button
                onClick={() => setEditUserModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editUserModal.name}
                  onChange={(e) => setEditUserModal({ ...editUserModal, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Role</label>
                <select
                  value={editUserModal.role}
                  disabled={editUserModal.role === 'owner' || !isOwner}
                  onChange={(e) => setEditUserModal({ ...editUserModal, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 disabled:opacity-50"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  {editUserModal.role === 'owner' && <option value="owner">Owner</option>}
                </select>
                {!isOwner && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Only the Workspace Owner can promote or demote administrators.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Account Status</label>
                <select
                  value={editUserModal.status}
                  disabled={editUserModal.role === 'owner'}
                  onChange={(e) => setEditUserModal({ ...editUserModal, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 disabled:opacity-50"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Storage Limit (GB)</span>
                  {editUserModal.role === 'owner' && (
                    <span className="text-amber-400 font-bold text-[10px]">Owner Quota</span>
                  )}
                </label>
                {editUserModal.role === 'owner' && user?.role !== 'owner' ? (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-amber-400/90 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Admins cannot change the Owner's storage limit</span>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={Math.round((editUserModal.storage_limit || 10737418240) / (1024 * 1024 * 1024))}
                    onChange={(e) =>
                      setEditUserModal({
                        ...editUserModal,
                        storage_limit: (parseInt(e.target.value) || 10) * 1024 * 1024 * 1024,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditUserModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (editUserModal.role === 'owner' && user?.role !== 'owner') {
                    toast.error("Admins cannot change the Owner's storage limit");
                    return;
                  }
                  try {
                    await adminAPI.updateUser(editUserModal.id, {
                      name: editUserModal.name,
                      email: editUserModal.email,
                      role: editUserModal.role,
                      status: editUserModal.status,
                      storage_limit: editUserModal.storage_limit,
                    });
                    setEditUserModal(null);
                    loadUsers();
                    toast.success(editUserModal.id === user?.id ? 'Self profile & storage limit updated!' : 'User updated successfully');
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to update user');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile View Floating Window */}
      {viewUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          <div className="relative bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl shadow-black/80 border border-slate-800 p-5 sm:p-7 animate-in zoom-in-95 duration-150 text-slate-100 max-h-[90vh] overflow-y-auto flex flex-col space-y-5">
            {/* Ambient Top Glow */}
            <div className="absolute -top-16 -left-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header with Close */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">User Profile Overview</h3>
              </div>
              <button
                onClick={() => setViewUserModal(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hero Profile Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row items-center sm:items-start gap-4 relative z-10">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center font-bold text-white text-2xl sm:text-3xl shadow-xl ring-4 ring-slate-800/80 shrink-0"
                style={{ backgroundColor: viewUserModal.avatar_color || '#3b82f6' }}
              >
                {viewUserModal.name?.charAt(0).toUpperCase() || 'U'}
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                  <h4 className="text-lg font-bold text-slate-100 truncate">{viewUserModal.name}</h4>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      viewUserModal.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : viewUserModal.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {viewUserModal.role === 'owner' ? 'Workspace Owner' : viewUserModal.role === 'admin' ? 'Administrator' : 'Team Member'}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      viewUserModal.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : viewUserModal.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {viewUserModal.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 truncate mb-2">{viewUserModal.email}</p>

                {/* Copyable User ID pill */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-slate-400">
                  <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 truncate max-w-[240px]">
                    ID: {viewUserModal.id}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(viewUserModal.id);
                      toast.success('User ID copied to clipboard!');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Copy User ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Active Files
                </span>
                <span className="text-sm font-bold text-slate-100 mt-1 block">
                  {viewUserModal.files_count || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Storage Used
                </span>
                <span className="text-sm font-bold text-blue-400 mt-1 block">
                  {formatBytes(viewUserModal.storage_used || 0)}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Storage Quota
                </span>
                <span className="text-sm font-bold text-purple-400 mt-1 block">
                  {formatBytes(viewUserModal.storage_limit || 0)}
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quota Left
                </span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block">
                  {formatBytes(Math.max(0, (viewUserModal.storage_limit || 0) - (viewUserModal.storage_used || 0)))}
                </span>
              </div>
            </div>

            {/* Storage Meter Visual Bar */}
            <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-2 relative z-10">
              {(() => {
                const usedBytes = viewUserModal.storage_used || 0;
                const limitBytes = viewUserModal.storage_limit || 1;
                const pct = Math.min(100, Math.round((usedBytes / limitBytes) * 100));
                return (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                        Storage Quota Utilization
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{pct}% utilized</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct > 90 ? 'bg-red-500 shadow-sm shadow-red-500/50' : pct > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                        }`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>{formatBytes(usedBytes)} used</span>
                      <span>{formatBytes(limitBytes)} total</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Comprehensive Detail Field Tiles */}
            <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-3 relative z-10">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Specifications</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Username</span>
                  <span className="font-semibold text-slate-200 font-mono">@{viewUserModal.username}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Email</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[150px]">{viewUserModal.email}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Registered On</span>
                  <span className="font-semibold text-slate-200">{formatDate(viewUserModal.created_at)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Last Profile Update</span>
                  <span className="font-semibold text-slate-200">{formatDate(viewUserModal.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Role Privilege</span>
                  <span className="font-semibold text-slate-200">{viewUserModal.role?.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Forensic Attribution</span>
                  <span className="font-semibold text-emerald-400 font-mono text-[11px]">ACTIVE</span>
                </div>
              </div>
            </div>

            {/* User Activity Logs Audit Trail */}
            <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5 text-blue-400" />
                  Recent Activity Audit Trail
                </h5>
                <span className="text-[10px] text-slate-500">Last recorded events</span>
              </div>

              {(() => {
                const userLogs = (logs || []).filter(
                  (l) => l.user_id === viewUserModal.id || l.user_name === viewUserModal.name || l.user_name === viewUserModal.username
                ).slice(0, 5);

                if (userLogs.length === 0) {
                  return (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No forensic activity recorded for this user yet.
                    </div>
                  );
                }

                return (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {userLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/70 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px] font-semibold uppercase">
                            {log.action}
                          </span>
                          <span className="text-slate-300 truncate font-medium">{log.item_name || log.details}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 relative z-10">
              <div className="flex items-center gap-2">
                {viewUserModal.status === 'pending' && (
                  <>
                    <button
                      onClick={async () => {
                        await handleApproveUser(viewUserModal.id);
                        setViewUserModal(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={async () => {
                        await handleRejectUser(viewUserModal.id);
                        setViewUserModal(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-600/30 text-red-300 hover:bg-red-600/40 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                )}
                {viewUserModal.role === 'owner' && user?.role !== 'owner' ? (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Owner account protected</span>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      const u = viewUserModal;
                      setViewUserModal(null);
                      setEditUserModal(u);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit User / Quota</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewUserModal(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
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
