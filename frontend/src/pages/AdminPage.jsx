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

  // Check admin privileges
  if (user?.role !== 'admin') {
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

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const match = userSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(match) ||
      u.email?.toLowerCase().includes(match) ||
      u.username?.toLowerCase().includes(match)
    );
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
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100">EleDrive Admin Console</h1>
              <p className="text-[10px] text-slate-400">Team settings, logs, and user profile management</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{stats?.total_users || 0}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Files & Projects</span>
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{stats?.total_files || 0}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Storage Consumed</span>
              <HardDrive className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{formatBytes(stats?.total_storage_used || 0)}</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Active Links</span>
              <Share2 className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-2xl font-bold text-slate-100">{stats?.total_share_links || 0}</span>
          </div>
        </div>

        {/* TAB 1: USERS MANAGEMENT & PROFILES */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">All User Profiles & Quotas</h3>
                <p className="text-xs text-slate-400">
                  Manage individual team members, roles, quotas, and account settings
                </p>
              </div>

              <div className="relative w-full sm:w-64">
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-6">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Storage Quota</th>
                    <th className="py-3 px-4">Files</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredUsers.map((u) => {
                    const pct = Math.min(100, Math.round((u.storage_used / u.storage_limit) * 100));
                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-6 flex items-center gap-3">
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

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              u.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 w-48">
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

                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {u.files_count || 0}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400">
                          {formatDate(u.created_at)}
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => setEditUserModal(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5 text-purple-400" />
                            <span>Edit Settings</span>
                          </button>
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
          onClose={() => setEditUserModal(null)}
          onUpdated={() => {
            setEditUserModal(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function EditUserAdminModal({ user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [quotaGB, setQuotaGB] = useState(Math.round(user.storage_limit / (1024 * 1024 * 1024)));
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name: name.trim(),
      email: email.trim(),
      role: role,
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
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Edit User Settings</h3>
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
              <label className="block text-slate-300 font-semibold mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none font-medium"
              >
                <option value="member">Member</option>
                <option value="admin">Administrator</option>
              </select>
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
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete User</span>
            </button>

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
