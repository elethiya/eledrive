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
  Activity,
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
  EyeOff,
  KeyRound,
  Mail,
  User,
  Palette,
  Share2,
  ChevronRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { adminAPI } from '../api/client';

const AVATAR_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
];

const QUOTA_PRESETS = [5, 10, 25, 50, 100, 250];
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { formatBytes, formatDate } from '../utils/formatters';

export default function AdminPage({ onBackToDrive }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'security' | 'logs' | 'settings'

  // Admin Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

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
  const [isForensicDragOver, setIsForensicDragOver] = useState(false);

  const handleForensicDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isForensicDragOver) {
      setIsForensicDragOver(true);
    }
  };

  const handleForensicDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsForensicDragOver(true);
  };

  const handleForensicDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsForensicDragOver(false);
  };

  const handleForensicDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsForensicDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setInspectFile(droppedFile);
      setInspectError('');
      toast.info(`Loaded suspect file: ${droppedFile.name}`);
    }
  };

  // Users Tab
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUserModal, setEditUserModal] = useState(null);
  const [viewUserModal, setViewUserModal] = useState(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [savingUserEdit, setSavingUserEdit] = useState(false);

  // Password Resets Queue
  const [passwordResets, setPasswordResets] = useState([]);
  const [loadingResets, setLoadingResets] = useState(false);
  const [showResetsModal, setShowResetsModal] = useState(false);
  const [selectedReset, setSelectedReset] = useState(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [resolvingReset, setResolvingReset] = useState(false);
  const [resetFilter, setResetFilter] = useState('pending'); // 'pending' | 'all' | 'resolved' | 'rejected'

  // Team Creation Requests Queue
  const [teamRequests, setTeamRequests] = useState([]);
  const [loadingTeamRequests, setLoadingTeamRequests] = useState(false);
  const [showTeamRequestsModal, setShowTeamRequestsModal] = useState(false);
  const [teamRequestFilter, setTeamRequestFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [teamSearch, setTeamSearch] = useState('');
  const [isRefreshingTeamRequests, setIsRefreshingTeamRequests] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectAdminNote, setRejectAdminNote] = useState('');
  const [processingTeamRequestId, setProcessingTeamRequestId] = useState(null);

  const handleOpenViewModal = (targetUser) => {
    if (targetUser?.role === 'owner' && user?.role !== 'owner') {
      toast.error("Admins cannot open, view, or touch the Workspace Owner account");
      return;
    }
    setViewUserModal(targetUser);
  };

  const handleOpenEditModal = (targetUser) => {
    if (targetUser?.role === 'owner' && user?.role !== 'owner') {
      toast.error("Admins cannot open, view, or touch the Workspace Owner account");
      return;
    }
    setEditUserModal(targetUser);
  };

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
    require_admin_approval: true,
    allow_password_reset_requests: true,
    session_timeout_hours: 72,
    enforce_strong_passwords: false,
    max_login_attempts: 5,
    require_link_passwords: false,
    default_link_expiry_days: 30,
    allow_team_creation: true,
    trash_retention_days: 30,
    activity_log_retention_days: 90,
    notify_quota_warning_percent: 85,
    forensic_watermarking_enabled: true,
    steganographic_canary_enabled: true,
    log_forensic_downloads: true,
    maintenance_mode: false,
    maintenance_notice: 'Platform is currently undergoing scheduled maintenance. Please check back shortly.',
    allow_zip_downloads: true,
    chunk_upload_enabled: true,
  });
  const [activeCategory, setActiveCategory] = useState(null);
  const [draftSettings, setDraftSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

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

  const loadPasswordResets = async () => {
    setLoadingResets(true);
    try {
      const res = await adminAPI.listPasswordResets();
      if (res) {
        setPasswordResets(Array.isArray(res) ? res : res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResets(false);
    }
  };

  const handleResolveReset = async (action, reqItem = selectedReset) => {
    if (!reqItem) return;
    if (action === 'reset' && (!newAdminPassword || newAdminPassword.trim().length < 6)) {
      toast.error('Please enter a secure password with at least 6 characters');
      return;
    }

    setResolvingReset(true);
    try {
      await adminAPI.resolvePasswordReset(reqItem.id, {
        action,
        new_password: action === 'reset' ? newAdminPassword.trim() : undefined,
      });
      toast.success(
        action === 'reset'
          ? `Password for @${reqItem.user_username} has been reset!`
          : `Password reset request for @${reqItem.user_username} dismissed.`
      );
      setSelectedReset(null);
      setNewAdminPassword('');
      loadPasswordResets();
      loadUsers();
      loadLogs();
    } catch (err) {
      toast.error(err.message || 'Failed to resolve password reset request');
    } finally {
      setResolvingReset(false);
    }
  };

  const loadTeamRequests = async () => {
    setLoadingTeamRequests(true);
    try {
      const res = await adminAPI.listTeamRequests();
      if (res) {
        setTeamRequests(Array.isArray(res) ? res : res.data || []);
      }
    } catch (e) {
      console.error(e);
      setTeamRequests([]);
    } finally {
      setLoadingTeamRequests(false);
    }
  };

  const handleApproveTeamRequest = async (requestId, teamName) => {
    setProcessingTeamRequestId(requestId);
    try {
      await adminAPI.approveTeamRequest(requestId);
      toast.success(`Team "${teamName}" approved and created successfully!`);
      loadTeamRequests();
      loadStats();
      loadLogs();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to approve team proposal');
    } finally {
      setProcessingTeamRequestId(null);
    }
  };

  const handleRejectTeamRequest = async () => {
    if (!rejectingRequest) return;
    setProcessingTeamRequestId(rejectingRequest.id);
    try {
      await adminAPI.rejectTeamRequest(rejectingRequest.id, {
        admin_note: rejectAdminNote.trim() || undefined,
      });
      toast.success(`Team proposal "${rejectingRequest.name}" rejected.`);
      setRejectingRequest(null);
      setRejectAdminNote('');
      loadTeamRequests();
      loadStats();
      loadLogs();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to reject team proposal');
    } finally {
      setProcessingTeamRequestId(null);
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
          default_quota_gb: res.data.default_quota_gb ?? 10,
          allow_public_registration: res.data.allow_public_registration ?? true,
          allow_public_shares: res.data.allow_public_shares ?? true,
          max_upload_size_mb: res.data.max_upload_size_mb ?? 1024,
          require_admin_approval: res.data.require_admin_approval ?? true,
          allow_password_reset_requests: res.data.allow_password_reset_requests ?? true,
          session_timeout_hours: res.data.session_timeout_hours ?? 72,
          enforce_strong_passwords: res.data.enforce_strong_passwords ?? false,
          max_login_attempts: res.data.max_login_attempts ?? 5,
          require_link_passwords: res.data.require_link_passwords ?? false,
          default_link_expiry_days: res.data.default_link_expiry_days ?? 30,
          allow_team_creation: res.data.allow_team_creation ?? true,
          trash_retention_days: res.data.trash_retention_days ?? 30,
          activity_log_retention_days: res.data.activity_log_retention_days ?? 90,
          notify_quota_warning_percent: res.data.notify_quota_warning_percent ?? 85,
          forensic_watermarking_enabled: res.data.forensic_watermarking_enabled ?? true,
          steganographic_canary_enabled: res.data.steganographic_canary_enabled ?? true,
          log_forensic_downloads: res.data.log_forensic_downloads ?? true,
          maintenance_mode: res.data.maintenance_mode ?? false,
          maintenance_notice: res.data.maintenance_notice || 'Platform is currently undergoing scheduled maintenance. Please check back shortly.',
          allow_zip_downloads: res.data.allow_zip_downloads ?? true,
          chunk_upload_enabled: res.data.chunk_upload_enabled ?? true,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'owner') {
      loadStats();
      loadUsers();
      loadLogs();
      loadSettings();
      loadSecurityStats();
      loadPasswordResets();
      loadTeamRequests();
    }
  }, [user?.role]);

  // Real-time Event Subscription for teams, users, and admin updates
  useRealtimeEvent(['team', 'sync', 'user'], () => {
    if (user?.role === 'admin' || user?.role === 'owner') {
      loadStats();
      loadTeamRequests();
      loadPasswordResets();
    }
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeCategory) {
        setActiveCategory(null);
        setDraftSettings(null);
        setSettingsSuccess('');
        setSettingsError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCategory]);

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
      loadLogs();
    } catch (err) {
      setInspectError(err.response?.data?.error || err.message || 'Forensic analysis failed to find matching asset.');
      loadLogs();
    } finally {
      setInspecting(false);
    }
  };

  const openCategoryModal = (catId) => {
    if (catId === 'forensics' && !isOwner) {
      toast.error("Access Denied: 'Forensic Attribution & Security' settings can only be accessed and modified by the Workspace Owner.");
      return;
    }
    setActiveCategory(catId);
    setDraftSettings({ ...settings });
    setSettingsSuccess('');
    setSettingsError('');
  };

  const closeCategoryModal = () => {
    setActiveCategory(null);
    setDraftSettings(null);
    setSettingsSuccess('');
    setSettingsError('');
  };

  const handleSaveCategorySettings = async (e) => {
    if (e) e.preventDefault();
    if (!draftSettings) return;
    if (activeCategory === 'forensics' && !isOwner) {
      toast.error("Access Denied: 'Forensic Attribution & Security' can only be modified by the Workspace Owner.");
      return;
    }
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    try {
      await adminAPI.updateSettings(draftSettings);
      setSettings({ ...draftSettings });
      setSettingsSuccess('Platform settings updated successfully.');
      toast.success('Configuration saved');
      setTimeout(() => {
        closeCategoryModal();
      }, 600);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to update settings';
      setSettingsError(msg);
      toast.error(msg);
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

  const pendingResets = passwordResets.filter((pr) => pr.status === 'pending');
  const filteredResets = passwordResets.filter(
    (pr) => resetFilter === 'all' || pr.status === resetFilter
  );

  const pendingTeamRequests = teamRequests.filter((tr) => tr.status === 'pending');
  const approvedTeamRequests = teamRequests.filter((tr) => tr.status === 'approved');
  const rejectedTeamRequests = teamRequests.filter((tr) => tr.status === 'rejected');

  const filteredTeamRequests = teamRequests.filter((tr) => {
    const q = teamSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (tr.name && tr.name.toLowerCase().includes(q)) ||
      (tr.description && tr.description.toLowerCase().includes(q)) ||
      (tr.user_name && tr.user_name.toLowerCase().includes(q)) ||
      (tr.user_username && tr.user_username.toLowerCase().includes(q)) ||
      (tr.user_email && tr.user_email.toLowerCase().includes(q));

    const matchesStatus =
      teamRequestFilter === 'all' || tr.status === teamRequestFilter;

    return matchesSearch && matchesStatus;
  });

  const isOwner = user?.role === 'owner';

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header Bar */}
      <header className="min-h-16 px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${
              isOwner
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-purple-500/20'
            }`}
          >
            {isOwner ? <Crown className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                  {isOwner ? 'EleDrive Workspace Owner Console' : 'EleDrive Admin Console'}
                </h1>
                <span
                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                    isOwner
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}
                >
                  {isOwner ? 'Owner Level' : 'Admin'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Workspace Governance • Cryptographic Forensic Leak Attribution
              </p>
            </div>
          </div>

        <div className="flex items-center gap-2 shrink-0">
          {onBackToDrive && (
            <button
              onClick={onBackToDrive}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 shadow-xs"
              title="Return to your Drive workspace"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Drive</span>
            </button>
          )}

          <button
            onClick={async () => {
              setIsRefreshingStats(true);
              try {
                await Promise.all([
                  loadStats(),
                  loadUsers(),
                  loadLogs(),
                  loadSecurityStats(),
                  loadTeamRequests(),
                ]);
              } finally {
                setTimeout(() => setIsRefreshingStats(false), 600);
              }
            }}
            disabled={isRefreshingStats}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all group disabled:opacity-60"
            title="Refresh dashboard metrics & data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isRefreshingStats ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-3.5 sm:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
        {/* Top Executive Stats Cards (2-col on mobile, 4-col on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all flex flex-col justify-between min-h-[104px] sm:min-h-[116px]">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 truncate">Total Users</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-100">
              {loadingStats ? '...' : stats?.total_users ?? 0}
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 text-[10px] sm:text-[11px]">
              {stats?.pending_approvals > 0 ? (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 animate-pulse text-[10px] sm:text-[11px]">
                  {stats.pending_approvals} Pending
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1 truncate text-[10px] sm:text-[11px]">
                  <CheckCircle className="w-3 h-3 shrink-0" /> All approved
                </span>
              )}
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all flex flex-col justify-between min-h-[104px] sm:min-h-[116px]">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 truncate">Forensic Assets</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Fingerprint className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-100">
              {loadingStats ? '...' : (stats?.total_files ?? 0) + (stats?.total_folders ?? 0)}
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-emerald-400 font-medium flex items-center gap-1 truncate">
              <ShieldCheck className="w-3 h-3 shrink-0" /> Watermarked
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all flex flex-col justify-between min-h-[104px] sm:min-h-[116px]">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 truncate">Storage Usage</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-100 truncate">
              {loadingStats ? '...' : formatBytes(stats?.total_storage_used ?? 0)}
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 truncate">
              {stats?.total_files ?? 0} files total
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all flex flex-col justify-between min-h-[104px] sm:min-h-[116px]">
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
            <div className="flex items-center justify-between mb-1.5 sm:mb-2 relative z-10">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 truncate">Engine Status</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 truncate flex items-center gap-1.5 relative z-10">
              <span>Operational</span>
            </div>
            <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 font-mono truncate relative z-10">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 font-semibold truncate">SHA-256 Active</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Horizontal Scrollable on Mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
            <span className="hidden sm:inline">Management</span>
            {stats?.pending_approvals > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                {stats.pending_approvals}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'security'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Forensic </span>
            <span>Leak Tracker</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30 hidden xs:inline">
              NEW
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'logs'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span className="hidden sm:inline">Audit & </span>
            <span>Activity Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Platform </span>
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'proposals'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
            title="Review and manage team creation proposals"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Team Proposals</span>
            {pendingTeamRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                {pendingTeamRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Pending Team Creation Proposals Alert Banner */}
            {pendingTeamRequests.length > 0 && (
              <div className="bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-slate-900 border border-blue-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-blue-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">
                        {pendingTeamRequests.length} Team Creation {pendingTeamRequests.length === 1 ? 'Proposal' : 'Proposals'} Pending
                      </h4>
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Users submitted proposals to create new team workspaces. Review requested details and authorize team creation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('proposals')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Review Proposals ({pendingTeamRequests.length})</span>
                </button>
              </div>
            )}

            {/* Pending Password Reset Requests Alert Banner */}
            {pendingResets.length > 0 && (
              <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">
                        {pendingResets.length} Password Reset {pendingResets.length === 1 ? 'Request' : 'Requests'} Pending
                      </h4>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Users requested credential resets via the login screen. You can review requests and assign new passwords.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetsModal(true)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Review Requests ({pendingResets.length})</span>
                </button>
              </div>
            )}

            {/* Search & Status Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user name, email, or handle..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch('')}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
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

                <button
                  type="button"
                  onClick={() => setShowResetsModal(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 border ml-1 ${
                    pendingResets.length > 0
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-xs'
                      : 'text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                  title="View all password reset requests"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Requests</span>
                  {pendingResets.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                      {pendingResets.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('proposals')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 border ml-1 ${
                    pendingTeamRequests.length > 0
                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/40 hover:bg-blue-500/25 shadow-xs'
                      : 'text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                  title="View and manage team creation proposals"
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Team Proposals</span>
                  {pendingTeamRequests.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                      {pendingTeamRequests.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshingUsers(true);
                    try {
                      await loadUsers();
                    } finally {
                      setTimeout(() => setIsRefreshingUsers(false), 600);
                    }
                  }}
                  disabled={isRefreshingUsers}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 border border-slate-800 hover:bg-slate-800 transition-all shrink-0 flex items-center gap-1.5 group disabled:opacity-60 shadow-xs ml-1"
                  title="Refresh user accounts"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 transition-transform duration-500 ${
                      isRefreshingUsers ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
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
                              {u.role === 'owner' && user?.role !== 'owner' ? (
                                <div className="flex items-center gap-3 select-none" title="Workspace Owner (Protected)">
                                  <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 ring-2 ring-amber-500/30 shadow-xs"
                                    style={{ backgroundColor: u.avatar_color || '#f59e0b' }}
                                  >
                                    {u.name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                  <div className="truncate max-w-[200px]">
                                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                      <span>{u.name}</span>
                                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    </div>
                                    <div className="text-[11px] text-amber-400/80 font-medium flex items-center gap-1">
                                      <Lock className="w-3 h-3 text-amber-400/80" />
                                      <span>Account Protected</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenViewModal(u)}
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
                              )}
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
                              <div className="flex flex-col items-start gap-1">
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
                                {(() => {
                                  const resetReq = pendingResets.find((pr) => pr.user_id === u.id);
                                  if (!resetReq) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedReset(resetReq);
                                        setNewAdminPassword('');
                                        setShowNewAdminPassword(false);
                                        setShowResetsModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold hover:bg-amber-500/30 transition-colors"
                                      title={`Reset requested: "${resetReq.reason}"`}
                                    >
                                      <KeyRound className="w-2.5 h-2.5 text-amber-400" />
                                      <span>Reset Requested</span>
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {u.role === 'owner' && user?.role !== 'owner' ? (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 italic">
                                  <Lock className="w-3 h-3 text-amber-500/70" />
                                  <span>Protected Quota</span>
                                </div>
                              ) : (
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
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                              {formatDate(u.created_at)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {u.role === 'owner' && user?.role !== 'owner' ? (
                                  <span
                                    className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold flex items-center gap-1.5 cursor-not-allowed select-none"
                                    title="Workspace Owner: Admins cannot open, view, or touch the Owner account"
                                  >
                                    <Lock className="w-3 h-3 text-amber-400" />
                                    <span>Owner Protected</span>
                                  </span>
                                ) : (
                                  <>
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
                                      onClick={() => handleOpenViewModal(u)}
                                      className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                      title="View User Full Details & Activity"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditModal(u)}
                                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                                      title={u.role === 'owner' ? 'Edit Self & Storage Limit' : 'Edit User'}
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    {u.role !== 'owner' && (
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="p-1.5 rounded-lg bg-slate-800 text-red-400 hover:bg-red-500/20 transition-colors"
                                        title="Delete User"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
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

        {/* TAB 2: TEAM CREATION PROPOSALS (Matching User Management page layout) */}
        {activeTab === 'proposals' && (
          <div className="space-y-4">
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Proposals</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-100">{teamRequests.length}</span>
                  <span className="text-xs text-slate-400">submitted</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Review</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock className="w-4 h-4 animate-pulse" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-400">{pendingTeamRequests.length}</span>
                  <span className="text-xs text-slate-400">awaiting</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Approved Teams</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400">{approvedTeamRequests.length}</span>
                  <span className="text-xs text-slate-400">created</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rejected</span>
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-red-400">{rejectedTeamRequests.length}</span>
                  <span className="text-xs text-slate-400">declined</span>
                </div>
              </div>
            </div>

            {/* Search & Status Filters (identical to Users Management) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search team name, requester, username, email..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
                {teamSearch && (
                  <button
                    type="button"
                    onClick={() => setTeamSearch('')}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: `All (${teamRequests.length})` },
                  { id: 'pending', label: `Pending (${pendingTeamRequests.length})` },
                  { id: 'approved', label: `Approved (${approvedTeamRequests.length})` },
                  { id: 'rejected', label: `Rejected (${rejectedTeamRequests.length})` },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTeamRequestFilter(id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all shrink-0 ${
                      teamRequestFilter === id
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshingTeamRequests(true);
                    try {
                      await loadTeamRequests();
                    } finally {
                      setTimeout(() => setIsRefreshingTeamRequests(false), 600);
                    }
                  }}
                  disabled={isRefreshingTeamRequests}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 border border-slate-800 hover:bg-slate-800 transition-all shrink-0 flex items-center gap-1.5 group disabled:opacity-60 shadow-xs ml-1"
                  title="Refresh team proposals"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 transition-transform duration-500 ${
                      isRefreshingTeamRequests
                        ? 'animate-spin text-blue-400'
                        : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Proposals Table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Team Workspace</th>
                      <th className="py-3.5 px-4">Requester</th>
                      <th className="py-3.5 px-4">Requested Teammates</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Submitted</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingTeamRequests ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          Loading team proposals...
                        </td>
                      </tr>
                    ) : filteredTeamRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No team creation proposals found matching "{teamRequestFilter}" filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTeamRequests.map((req) => {
                        const isRejectingThis = rejectingRequest?.id === req.id;
                        const isProcessing = processingTeamRequestId === req.id;

                        return (
                          <React.Fragment key={req.id}>
                            <tr className="hover:bg-slate-850/50 transition-colors">
                              {/* Team Workspace */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 ring-2 ring-slate-800 shadow-xs"
                                    style={{ backgroundColor: req.avatar_color || '#3b82f6' }}
                                  >
                                    {req.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="truncate max-w-[220px]">
                                    <div className="font-semibold text-slate-100 truncate">{req.name}</div>
                                    {req.description ? (
                                      <div className="text-[11px] text-slate-400 truncate" title={req.description}>
                                        {req.description}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-slate-500 italic">No description</div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Requester */}
                              <td className="py-3.5 px-4">
                                <div className="truncate max-w-[200px]">
                                  <div className="font-semibold text-slate-200 truncate">{req.user_name}</div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    @{req.user_username} • {req.user_email}
                                  </div>
                                </div>
                              </td>

                              {/* Teammates */}
                              <td className="py-3.5 px-4">
                                {req.initial_members && req.initial_members.length > 0 ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-medium">
                                    <Users className="w-3 h-3 text-blue-400 shrink-0" />
                                    <span>{req.initial_members.length} members</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[11px] italic">Only requester</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4">
                                <div className="flex flex-col items-start gap-0.5">
                                  {req.status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
                                      <Clock className="w-2.5 h-2.5 animate-pulse" />
                                      Pending
                                    </span>
                                  ) : req.status === 'approved' ? (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      Approved
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/30">
                                      <XCircle className="w-2.5 h-2.5" />
                                      Rejected
                                    </span>
                                  )}
                                  {req.reviewed_by && (
                                    <span className="text-[10px] text-slate-500">
                                      by {req.reviewed_by}
                                    </span>
                                  )}
                                  {req.admin_note && req.status === 'rejected' && (
                                    <span className="text-[10px] text-red-300/80 italic max-w-[180px] truncate" title={req.admin_note}>
                                      "{req.admin_note}"
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Submitted */}
                              <td className="py-3.5 px-4 text-slate-400">
                                <span title={req.created_at ? new Date(req.created_at).toLocaleString() : ''}>
                                  {formatDate(req.created_at)}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                {req.status === 'pending' ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => {
                                        setRejectingRequest(req);
                                        setRejectAdminNote('');
                                      }}
                                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                                      title="Reject team creation proposal"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Reject</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleApproveTeamRequest(req.id, req.name)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 disabled:opacity-50"
                                      title="Authorize proposal and create team"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{isProcessing ? 'Approving...' : 'Approve'}</span>
                                    </button>
                                  </div>
                                ) : req.status === 'approved' ? (
                                  <div className="flex items-center justify-end gap-1 text-[11px] text-emerald-400 font-semibold font-mono">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Team Created</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1 text-[11px] text-red-400/90 font-medium">
                                    <X className="w-3.5 h-3.5" />
                                    <span>Proposal Declined</span>
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* Inline Rejection Reason Form */}
                            {isRejectingThis && (
                              <tr className="bg-slate-950/80">
                                <td colSpan={6} className="p-4">
                                  <div className="p-4 rounded-xl bg-slate-900 border border-red-500/30 space-y-3 max-w-2xl mx-auto shadow-xl animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                        <XCircle className="w-4 h-4 text-red-400" />
                                        <span>Reject Proposal for "{req.name}"</span>
                                      </h5>
                                      <span className="text-[11px] text-slate-400">Requester: @{req.user_username}</span>
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                        Reason / Feedback for Requester (Optional):
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={rejectAdminNote}
                                        onChange={(e) => setRejectAdminNote(e.target.value)}
                                        placeholder="Enter feedback or explanation why this team proposal was not authorized..."
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-red-500 resize-none"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectingRequest(null);
                                          setRejectAdminNote('');
                                        }}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isProcessing}
                                        onClick={handleRejectTeamRequest}
                                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>{isProcessing ? 'Rejecting...' : 'Confirm Rejection'}</span>
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FORENSIC LEAK TRACKER & WATERMARK DETECTIVE */}
        {activeTab === 'security' && (
          <div className="space-y-4 sm:space-y-6 min-w-0">
            {/* Explainer Hero Card */}
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/20 shadow-xl relative overflow-hidden min-w-0">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 min-w-0">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                    <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-base font-bold text-slate-100 flex flex-wrap items-center gap-2">
                      <span className="truncate">Cryptographic Forensic Leak Tracker</span>
                      <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        100% Attributed
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed break-words">
                      Every file, folder, image, video, and archive uploaded to EleDrive is injected with a permanent, tamper-proof forensic signature, embedded metadata atom, and secret cryptographic UUID. Even if an exfiltrated file is renamed, cropped, edited, or converted, its embedded signature remains detectable to identify the exact leaker.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800/80 shrink-0">
                  <div className="text-left md:text-right">
                    <div className="text-[11px] sm:text-xs font-bold text-slate-300">Total Downloads Logged</div>
                    <div className="text-base sm:text-lg font-mono font-black text-emerald-400">
                      {securityStats?.total_downloads_logged ?? 0} events
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Pillars of Protection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-800/80">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0 overflow-hidden">
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 mb-1 truncate">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Steganographic Trailer</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed break-words">
                    Appended HMAC signed block surviving crops, hex tampering, and re-encodes.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0 overflow-hidden">
                  <div className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5 mb-1 truncate">
                    <Shield className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Secret UUID Binding</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed break-words">
                    Every asset receives a unique 128-bit cryptographic identifier tied to uploader & download logs.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0 overflow-hidden">
                  <div className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5 mb-1 truncate">
                    <Archive className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Steganographic ZIP Archives</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed break-words">
                    Folder ZIP downloads automatically embed cryptographic forensic trailers and comment signatures.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0 overflow-hidden">
                  <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 mb-1 truncate">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">100% Invisible Digital Trap</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed break-words">
                    Completely hidden from users during normal browsing; only revealed when scanned by admin.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Leak Detective Form */}
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 sm:space-y-5 min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 min-w-0">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <FileSearch className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                    Inspect Suspect File or Secret UUID
                  </h3>
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                  Uncover origin, uploader identity & full download trail
                </span>
              </div>

              <form onSubmit={handleRunForensicInspection} className="space-y-3.5 sm:space-y-4 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 min-w-0">
                  {/* File Upload Zone */}
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 sm:mb-2 truncate">
                      Upload Leaked File / Media (Image, Video, Document, Archive):
                    </label>
                    <div
                      onClick={() => fileDropRef.current?.click()}
                      onDragOver={handleForensicDragOver}
                      onDragEnter={handleForensicDragEnter}
                      onDragLeave={handleForensicDragLeave}
                      onDrop={handleForensicDrop}
                      className={`relative border-2 border-dashed rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[110px] sm:min-h-[120px] min-w-0 overflow-hidden ${
                        isForensicDragOver
                          ? 'border-blue-400 bg-blue-500/20 ring-4 ring-blue-500/20 shadow-lg shadow-blue-500/20 scale-[1.01]'
                          : 'border-slate-700 hover:border-blue-500 bg-slate-950/40 hover:bg-slate-950/80'
                      }`}
                    >
                      <input
                        ref={fileDropRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setInspectFile(e.target.files[0]);
                            setInspectError('');
                          }
                        }}
                      />
                      {isForensicDragOver ? (
                        <div className="flex flex-col items-center justify-center pointer-events-none animate-pulse text-blue-400 py-2 min-w-0">
                          <UploadCloud className="w-8 h-8 mb-1.5 animate-bounce shrink-0" />
                          <span className="text-xs font-bold text-blue-300 truncate">Release file to inspect</span>
                          <span className="text-[10px] text-blue-400/80 truncate">Extract binary trailer & metadata</span>
                        </div>
                      ) : inspectFile ? (
                        <div className="flex items-center gap-2.5 sm:gap-3 text-left w-full justify-between min-w-0">
                          <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                              <FileCode className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="truncate min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-200 truncate" title={inspectFile.name}>{inspectFile.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{formatBytes(inspectFile.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setInspectFile(null);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 shrink-0"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center min-w-0 max-w-full px-2">
                          <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500 mb-1 sm:mb-1.5 shrink-0" />
                          <span className="text-xs font-medium text-slate-300 truncate max-w-full">
                            Drop suspect file here or <span className="text-blue-400 underline">browse</span>
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5 sm:mt-1 truncate max-w-full">
                            Extracts binary forensic trailer & embedded metadata
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Secret UUID Manual Input */}
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 sm:mb-2 truncate">
                      Or Enter Secret UUID / Filename Query:
                    </label>
                    <div className="space-y-2 min-w-0">
                      <div className="relative min-w-0">
                        <Fingerprint className="w-4 h-4 absolute left-3 top-3 text-slate-500 shrink-0" />
                        <input
                          type="text"
                          placeholder="e.g. 7f8b2c4e-1234-5678-abcd-0987654321fe"
                          value={inspectQuery}
                          onChange={(e) => setInspectQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-blue-500 min-w-0"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 break-words">
                        Matches against all past and current assets, even if the filename was changed.
                      </p>
                    </div>
                  </div>
                </div>

                {inspectError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="break-words min-w-0 flex-1">{inspectError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
                  {(inspectFile || inspectQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectFile(null);
                        setInspectQuery('');
                        setInspectionResult(null);
                        setInspectError('');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold text-center whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={inspecting}
                    className="flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {inspecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                        <span>Analyzing Cryptographic Watermark...</span>
                      </>
                    ) : (
                      <>
                        <FileSearch className="w-4 h-4 shrink-0" />
                        <span>Run Forensic Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Inspection Result Dossier */}
              {inspectionResult && (
                <div className={`mt-4 sm:mt-6 p-3.5 sm:p-6 rounded-2xl bg-slate-950 border ${
                  inspectionResult.matched 
                    ? 'border-emerald-500/30' 
                    : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                      ? 'border-amber-500/30'
                      : 'border-rose-500/30'
                } shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200 min-w-0 overflow-hidden`}>
                  {/* Banner */}
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl min-w-0 ${
                    inspectionResult.matched 
                      ? 'bg-emerald-500/10 border border-emerald-500/20' 
                      : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : 'bg-rose-500/10 border border-rose-500/20'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                        inspectionResult.matched 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {inspectionResult.matched ? (
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                        ) : inspectionResult.risk_assessment === 'UNMATCHED_ASSET' ? (
                          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                        ) : (
                          <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate ${
                          inspectionResult.matched 
                            ? 'text-emerald-300' 
                            : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        }`}>
                          {inspectionResult.matched 
                            ? 'Cryptographic Match Verified' 
                            : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                              ? 'Forensic Signature Found — Unmatched Workspace Asset'
                              : 'No Forensic Watermark Detected'}
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-100 truncate" title={inspectionResult.matched ? `Origin Asset Identified: ${inspectionResult.original_filename}` : `Scanned Target: ${inspectionResult.original_filename || 'Suspect Asset'}`}>
                          {inspectionResult.matched 
                            ? `Origin Asset Identified: ${inspectionResult.original_filename}` 
                            : `Scanned Target: ${inspectionResult.original_filename || 'Suspect Asset'}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <span className={`text-[10px] font-mono px-2 py-1 rounded bg-slate-900 border whitespace-nowrap ${
                        inspectionResult.matched 
                          ? 'border-emerald-500/30 text-emerald-400' 
                          : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                            ? 'border-amber-500/30 text-amber-400'
                            : 'border-rose-500/30 text-rose-400'
                      }`}>
                        {inspectionResult.matched 
                          ? 'HMAC-SHA256: VALID' 
                          : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                            ? 'STATUS: UNMATCHED'
                            : 'STATUS: INVALID / UNTRACKED'}
                      </span>
                    </div>
                  </div>

                  {inspectionResult.matched ? (
                    <>
                      {/* Attributed Leaker Information Card */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 min-w-0 overflow-hidden">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 truncate">
                            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="truncate">Attributed Original Uploader</span>
                          </h4>

                          <div className="flex items-center gap-3 pt-1 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-md shrink-0">
                              {inspectionResult.uploader_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-100 truncate" title={inspectionResult.uploader_name}>
                                {inspectionResult.uploader_name}
                              </div>
                              <div className="text-xs text-slate-400 truncate" title={`@${inspectionResult.uploader_username} • ${inspectionResult.uploader_email}`}>
                                @{inspectionResult.uploader_username} • {inspectionResult.uploader_email}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                                User ID: {inspectionResult.uploader_id}
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] min-w-0">
                            <div className="min-w-0">
                              <span className="text-slate-500 block truncate">Uploaded Date:</span>
                              <span className="text-slate-300 font-medium truncate block">
                                {inspectionResult.uploaded_at ? formatDate(inspectionResult.uploaded_at) : 'N/A'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-slate-500 block truncate">File Size:</span>
                              <span className="text-slate-300 font-medium truncate block">
                                {formatBytes(inspectionResult.file_size)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 min-w-0 overflow-hidden">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 truncate">
                            <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="truncate">Forensic Signature Details</span>
                          </h4>

                          <div className="space-y-2 text-xs min-w-0">
                            <div className="min-w-0">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold block truncate">
                                Secret Tracking UUID:
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                <span className="font-mono text-xs text-blue-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 select-all truncate min-w-0 flex-1" title={inspectionResult.secret_uuid}>
                                  {inspectionResult.secret_uuid}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUUID(inspectionResult.secret_uuid)}
                                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 shrink-0"
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
                              <div className="min-w-0">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold block truncate">
                                  SHA256 File Checksum:
                                </span>
                                <span className="font-mono text-[11px] text-slate-400 break-all select-all block bg-slate-950 p-2 rounded-lg border border-slate-800 mt-0.5">
                                  {inspectionResult.sha256_checksum}
                                </span>
                              </div>
                            )}

                            <div className="pt-2 min-w-0">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5 truncate">
                                Forensic Verdict:
                              </span>
                              <p className="text-xs text-emerald-300 font-medium break-words leading-relaxed">
                                {inspectionResult.metadata_summary}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Exfiltration & Download History Table */}
                      <div className="space-y-3 pt-2 min-w-0">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 truncate">
                          <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="truncate">Chain of Custody & Download Trail ({inspectionResult.download_history?.length || 0} events)</span>
                        </h4>

                        {(!inspectionResult.download_history || inspectionResult.download_history.length === 0) ? (
                          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500 break-words">
                            No external download records found for this asset. The file was likely exfiltrated directly by the uploader.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-800">
                            <table className="w-full text-left text-xs text-slate-300 min-w-[620px]">
                              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Downloader</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">IP Address</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Client / Browser</th>
                                  <th className="py-2.5 px-3 whitespace-nowrap">Downloaded At</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                                {inspectionResult.download_history.map((dl) => (
                                  <tr key={dl.id} className="hover:bg-slate-900/60">
                                    <td className="py-2.5 px-3 max-w-[180px]">
                                      <div className="font-semibold text-slate-200 truncate" title={dl.user_name}>{dl.user_name}</div>
                                      <div className="text-[10px] text-slate-500 truncate" title={dl.user_email}>{dl.user_email}</div>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-blue-400 text-[11px] whitespace-nowrap">
                                      {dl.ip_address}
                                    </td>
                                    <td className="py-2.5 px-3 text-[11px] text-slate-400 truncate max-w-[200px]" title={dl.user_agent}>
                                      {dl.user_agent || 'Standard HTTP Client'}
                                    </td>
                                    <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                                      {formatDate(dl.downloaded_at)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Unmatched / Invalid Investigation Dossier */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 min-w-0 overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 truncate">
                          <FileSearch className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="truncate">Inspection Verdict & Status</span>
                        </h4>

                        <div className="space-y-2.5 text-xs pt-1 min-w-0">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block truncate">
                              Scanned Target:
                            </span>
                            <span className="text-sm font-bold text-slate-200 block truncate" title={inspectionResult.original_filename || 'Uploaded File / Query'}>
                              {inspectionResult.original_filename || 'Uploaded File / Query'}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1 truncate">
                              Analysis Details:
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800/80 break-words">
                              {inspectionResult.metadata_summary}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 min-w-0 overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 truncate">
                          <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="truncate">Cryptographic & Audit Signature</span>
                        </h4>

                        <div className="space-y-2.5 text-xs min-w-0">
                          {inspectionResult.secret_uuid && (
                            <div className="min-w-0">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold block truncate">
                                Detected Secret UUID:
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                <span className="font-mono text-xs text-amber-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 select-all truncate min-w-0 flex-1" title={inspectionResult.secret_uuid}>
                                  {inspectionResult.secret_uuid}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUUID(inspectionResult.secret_uuid)}
                                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 shrink-0"
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
                          )}

                          {inspectionResult.sha256_checksum && (
                            <div className="min-w-0">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold block truncate">
                                SHA256 Checksum:
                              </span>
                              <span className="font-mono text-[11px] text-slate-400 break-all select-all block bg-slate-950 p-2 rounded-lg border border-slate-800 mt-0.5">
                                {inspectionResult.sha256_checksum}
                              </span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-[11px] text-emerald-400 min-w-0">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span className="break-words min-w-0 flex-1">This scan has been permanently recorded in the Security Audit Logs.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Forensic Tracked Files List */}
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3.5 sm:space-y-4 min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                    <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Recently Protected & Tracked Files</span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                    Assets carrying active Secret UUIDs and HMAC signatures
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 self-start sm:self-auto shrink-0 whitespace-nowrap">
                  {securityStats?.total_tracked_files ?? 0} Protected Files
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300 min-w-[720px]">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">File Name</th>
                      <th className="py-3 px-4 whitespace-nowrap">Uploader</th>
                      <th className="py-3 px-4 whitespace-nowrap">Secret UUID</th>
                      <th className="py-3 px-4 whitespace-nowrap">Size</th>
                      <th className="py-3 px-4 whitespace-nowrap">Uploaded</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Inspect</th>
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
                          <td className="py-3 px-4 font-semibold text-slate-200 max-w-[200px]">
                            <span className="block truncate" title={f.name}>{f.name}</span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-300 max-w-[180px]">
                            <span className="block truncate font-medium" title={f.owner_name}>{f.owner_name}</span>
                            <span className="block text-[10px] text-slate-500 truncate" title={f.owner_email}>{f.owner_email}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-blue-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span title={f.secret_uuid}>{f.secret_uuid?.slice(0, 16)}...</span>
                              <button
                                onClick={() => handleCopyUUID(f.secret_uuid)}
                                className="text-slate-500 hover:text-slate-300 shrink-0"
                                title="Copy UUID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                            {formatBytes(f.size)}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                            {formatDate(f.created_at)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
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
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-hidden font-medium"
                >
                  <option value="all">All Actions</option>
                  <option value="password_reset_request">Reset Requests</option>
                  <option value="admin_password_reset">Password Resets</option>
                  <option value="forensic_inspect">Forensic Scans</option>
                  <option value="upload">Uploads</option>
                  <option value="download">Downloads</option>
                  <option value="share">Shares</option>
                  <option value="create_folder">Folder Creation</option>
                  <option value="delete">Deletions</option>
                  <option value="ownership_transferred">Ownership</option>
                </select>

                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshingLogs(true);
                    try {
                      await loadLogs();
                    } finally {
                      setTimeout(() => setIsRefreshingLogs(false), 600);
                    }
                  }}
                  disabled={isRefreshingLogs}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-slate-100 text-xs font-semibold border border-slate-800 transition-all group disabled:opacity-60 shadow-xs"
                  title="Refresh activity logs"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 transition-transform duration-500 ${
                      isRefreshingLogs ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

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
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200 leading-tight">{l.user_name}</div>
                            {l.user_username && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">@{l.user_username}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {l.action === 'password_reset_request' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 font-mono text-[10px] uppercase font-bold text-amber-300 shadow-xs">
                                <KeyRound className="w-3 h-3 text-amber-400" />
                                <span>Reset Request</span>
                              </span>
                            ) : l.action === 'admin_password_reset' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 font-mono text-[10px] uppercase font-bold text-purple-300 shadow-xs">
                                <KeyRound className="w-3 h-3 text-purple-400" />
                                <span>Password Reset</span>
                              </span>
                            ) : l.action === 'forensic_inspect' ? (
                              l.item_type === 'failed_scan' || l.item_type === 'unmatched_asset' || l.details?.includes('INVALID') || l.details?.includes('No matching') ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 font-mono text-[10px] uppercase font-bold text-amber-400 shadow-xs">
                                  <Fingerprint className="w-3 h-3 text-amber-400" />
                                  <span>Forensic Scan (Failed)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] uppercase font-bold text-emerald-400 shadow-xs">
                                  <Fingerprint className="w-3 h-3 text-emerald-400" />
                                  <span>Forensic Scan</span>
                                </span>
                              )
                            ) : l.action === 'download' && l.details?.includes('Secret UUID') ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 font-mono text-[10px] uppercase font-bold text-blue-400">
                                <Download className="w-3 h-3 text-blue-400" />
                                <span>Download</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] uppercase font-bold text-slate-300">
                                {l.action}
                              </span>
                            )}
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
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  Platform System Settings
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Select any category below to configure platform quotas, security policies, data lifecycles, and operational controls in a dedicated window.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                  7 Policy Groups
                </span>
                {settings.maintenance_mode && (
                  <span className="px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-400 flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Maintenance Active
                  </span>
                )}
              </div>
            </div>

            {/* Settings Categories List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Storage & Quotas */}
              <div
                onClick={() => openCategoryModal('storage')}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-500/40 rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between select-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:scale-105 transition-transform">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-medium text-slate-300">
                      {settings.default_quota_gb} GB • {settings.max_upload_size_mb} MB Max
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition-colors">
                      Storage & Upload Quotas
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Baseline user drive quotas, single upload payload caps, concurrent chunked uploads, and bulk ZIP archives.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-blue-400 font-semibold group-hover:translate-x-0.5 transition-all">
                  <span>Configure Storage</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* 2. Registration & Access */}
              <div
                onClick={() => openCategoryModal('registration')}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/40 rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between select-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-medium text-slate-300">
                      {settings.allow_public_registration ? 'Signups Open' : 'Signups Closed'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                      Registration & Access Control
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Public account registration portal, mandatory administrative approval workflow, and team workspace creation.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-all">
                  <span>Configure Access</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* 3. Security & Sessions */}
              <div
                onClick={() => openCategoryModal('security')}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between select-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-105 transition-transform">
                      <Shield className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-medium text-slate-300">
                      {settings.session_timeout_hours}h Session • {settings.max_login_attempts} Max Fails
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                      Security & Session Policies
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Session inactivity lifespans, password complexity enforcement, brute-force rate-limiting, and password recovery.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-all">
                  <span>Configure Security</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* 4. Sharing & Public Links */}
              <div
                onClick={() => openCategoryModal('sharing')}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-purple-500/40 rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between select-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-105 transition-transform">
                      <Share2 className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-medium text-slate-300">
                      {settings.allow_public_shares ? 'Public Links Active' : 'Links Disabled'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                      Sharing & Public Links
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      External file and folder share links, mandatory passcode protection rules, and default link expiration durations.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-purple-400 font-semibold group-hover:translate-x-0.5 transition-all">
                  <span>Configure Sharing</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* 5. Data Retention & Lifecycle */}
              <div
                onClick={() => openCategoryModal('retention')}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between select-none"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
                      <Archive className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-medium text-slate-300">
                      Trash: {settings.trash_retention_days ? `${settings.trash_retention_days}d` : 'Indefinite'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      Data Retention & Lifecycle
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Automated purge schedules for soft-deleted trash bin items and security audit log retention periods.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:translate-x-0.5 transition-all">
                  <span>Configure Retention</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* 6. Forensic Attribution & Security (Owner Only) */}
              <div
                onClick={() => {
                  if (!isOwner) {
                    toast.error("Access Denied: 'Forensic Attribution & Security' can only be configured by the Workspace Owner.");
                    return;
                  }
                  openCategoryModal('forensics');
                }}
                className={`group relative rounded-3xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between select-none ${
                  isOwner
                    ? 'bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-teal-500/40 cursor-pointer'
                    : 'bg-slate-950/60 border border-slate-800/60 opacity-75 cursor-not-allowed'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`p-3 rounded-2xl border ${
                        isOwner
                          ? 'bg-teal-500/10 border-teal-500/20 text-teal-400 group-hover:scale-105'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      } transition-transform`}
                    >
                      <Fingerprint className="w-6 h-6" />
                    </div>
                    {isOwner ? (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-medium text-emerald-400">
                        {settings.forensic_watermarking_enabled ? 'Watermarks Active' : 'Off'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Owner Only
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-bold ${
                          isOwner ? 'text-slate-100 group-hover:text-teal-300' : 'text-slate-300'
                        } transition-colors`}
                      >
                        Forensic Attribution & Security
                      </h4>
                      {!isOwner && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm bg-slate-800 text-amber-400 border border-amber-500/20">
                          Restricted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Steganographic binary trailers, cryptographic UUID injection, forensic ZIP signatures, and download tracking.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold">
                  {isOwner ? (
                    <>
                      <span className="text-teal-400 group-hover:translate-x-0.5 transition-all">Configure Forensics</span>
                      <ChevronRight className="w-4 h-4 text-teal-400" />
                    </>
                  ) : (
                    <>
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                        Restricted to Workspace Owner
                      </span>
                      <span className="text-[11px] font-mono text-slate-600">Locked</span>
                    </>
                  )}
                </div>
              </div>

              {/* 7. System Operations & Maintenance */}
              <div
                onClick={() => openCategoryModal('maintenance')}
                className={`group relative bg-slate-900/80 hover:bg-slate-900 border rounded-3xl p-5 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between select-none md:col-span-2 ${
                  settings.maintenance_mode
                    ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-500/60'
                    : 'border-slate-800/80 hover:border-rose-500/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 group-hover:scale-105 transition-transform">
                      <Sliders className="w-6 h-6" />
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-medium ${
                        settings.maintenance_mode
                          ? 'bg-rose-500/20 border-rose-500/30 text-rose-300 animate-pulse'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {settings.maintenance_mode ? 'MAINTENANCE MODE ACTIVE' : 'Status: Operational'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition-colors">
                      System Operations & Maintenance
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Emergency platform maintenance mode, lockout barriers for non-admin sessions, and global broadcast notices.
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-rose-400 font-semibold group-hover:translate-x-0.5 transition-all">
                  <span>Configure Maintenance</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* FLOATING WINDOW CONFIGURATION MODAL */}
            {activeCategory && draftSettings && (
              <div
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeCategoryModal();
                }}
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
              >
                <div className="relative bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] border border-slate-800 shadow-2xl shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
                  {/* Ambient Glow */}
                  <div className="absolute -top-16 -right-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Modal Header */}
                  <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                        {activeCategory === 'storage' && <HardDrive className="w-5 h-5" />}
                        {activeCategory === 'registration' && <UserCheck className="w-5 h-5" />}
                        {activeCategory === 'security' && <Shield className="w-5 h-5" />}
                        {activeCategory === 'sharing' && <Share2 className="w-5 h-5" />}
                        {activeCategory === 'retention' && <Archive className="w-5 h-5" />}
                        {activeCategory === 'forensics' && <Fingerprint className="w-5 h-5" />}
                        {activeCategory === 'maintenance' && <Sliders className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-100 truncate">
                          {activeCategory === 'storage' && 'Storage & Upload Quotas'}
                          {activeCategory === 'registration' && 'Registration & Access Control'}
                          {activeCategory === 'security' && 'Security & Session Policies'}
                          {activeCategory === 'sharing' && 'Sharing & Public Links'}
                          {activeCategory === 'retention' && 'Data Retention & Lifecycle'}
                          {activeCategory === 'forensics' && 'Forensic Attribution & Security'}
                          {activeCategory === 'maintenance' && 'System Operations & Maintenance'}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          Configure platform behavioral rules and system thresholds
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeCategoryModal}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
                      title="Close (Esc)"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body / Form */}
                  <form onSubmit={handleSaveCategorySettings} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">

                      {/* 1. STORAGE CONTROLS */}
                      {activeCategory === 'storage' && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Default User Quota (GB)
                              </label>
                              <span className="text-[11px] font-mono text-blue-400 font-bold">
                                {draftSettings.default_quota_gb} GB
                              </span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              value={draftSettings.default_quota_gb}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  default_quota_gb: parseInt(e.target.value) || 1,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[5, 10, 25, 50, 100, 250].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, default_quota_gb: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.default_quota_gb === preset
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset}G
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Baseline storage capacity assigned to each newly registered account.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Maximum Upload File Size (MB)
                              </label>
                              <span className="text-[11px] font-mono text-blue-400 font-bold">
                                {draftSettings.max_upload_size_mb} MB
                              </span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="50000"
                              value={draftSettings.max_upload_size_mb}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  max_upload_size_mb: parseInt(e.target.value) || 10,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[256, 512, 1024, 2048, 5120].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, max_upload_size_mb: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.max_upload_size_mb === preset
                                      ? 'bg-blue-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset >= 1024 ? `${preset / 1024}GB` : `${preset}MB`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Ceiling limit for any single file upload request.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Quota Warning Threshold (%)
                              </label>
                              <span className="text-[11px] font-mono text-amber-400 font-bold">
                                {draftSettings.notify_quota_warning_percent}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="50"
                                max="98"
                                step="1"
                                value={draftSettings.notify_quota_warning_percent}
                                onChange={(e) =>
                                  setDraftSettings({
                                    ...draftSettings,
                                    notify_quota_warning_percent: parseInt(e.target.value) || 85,
                                  })
                                }
                                className="flex-1 accent-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-mono text-slate-300 w-12 text-right">
                                {draftSettings.notify_quota_warning_percent}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Warns users with an alert indicator when their used capacity exceeds this percentage.
                            </p>
                          </div>

                          <div className="pt-2 space-y-3">
                            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                              <div className="pr-4">
                                <div className="text-xs font-semibold text-slate-200">
                                  Enable Chunked Multi-Part Uploads
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Streams large files in resilient concurrent blocks with network resume support.
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={draftSettings.chunk_upload_enabled}
                                onChange={(e) =>
                                  setDraftSettings({ ...draftSettings, chunk_upload_enabled: e.target.checked })
                                }
                                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                              />
                            </label>

                            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                              <div className="pr-4">
                                <div className="text-xs font-semibold text-slate-200">
                                  Allow ZIP Bulk Downloads
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Allows users to package entire folders or multi-file selections into compressed archives.
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={draftSettings.allow_zip_downloads}
                                onChange={(e) =>
                                  setDraftSettings({ ...draftSettings, allow_zip_downloads: e.target.checked })
                                }
                                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* 2. REGISTRATION CONTROLS */}
                      {activeCategory === 'registration' && (
                        <div className="space-y-3">
                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Allow Public Account Registration
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Displays the account signup portal on the login screen. When disabled, only administrators can invite users.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.allow_public_registration}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  allow_public_registration: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Require Admin Approval for New Signups
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Newly registered accounts are placed in a pending verification queue until explicitly approved by an administrator.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.require_admin_approval}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  require_admin_approval: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Allow Users to Create Teams
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Permits regular users to establish new team workspaces and invite organizational members.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.allow_team_creation}
                              onChange={(e) =>
                                setDraftSettings({ ...draftSettings, allow_team_creation: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>
                        </div>
                      )}

                      {/* 3. SECURITY & SESSIONS */}
                      {activeCategory === 'security' && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Session Inactivity Timeout (Hours)
                              </label>
                              <span className="text-[11px] font-mono text-indigo-400 font-bold">
                                {draftSettings.session_timeout_hours} Hours
                              </span>
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="720"
                              value={draftSettings.session_timeout_hours}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  session_timeout_hours: parseInt(e.target.value) || 24,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[12, 24, 48, 72, 168].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, session_timeout_hours: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.session_timeout_hours === preset
                                      ? 'bg-indigo-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset >= 24 ? `${preset / 24}d` : `${preset}h`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Time before idle browser tokens automatically expire and require re-authentication.
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Max Consecutive Failed Login Attempts
                              </label>
                              <span className="text-[11px] font-mono text-indigo-400 font-bold">
                                {draftSettings.max_login_attempts} Attempts
                              </span>
                            </div>
                            <input
                              type="number"
                              min="3"
                              max="20"
                              value={draftSettings.max_login_attempts}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  max_login_attempts: parseInt(e.target.value) || 5,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[3, 5, 10].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, max_login_attempts: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.max_login_attempts === preset
                                      ? 'bg-indigo-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Threshold before IP rate-limiting lockout is applied against brute-force attacks.
                            </p>
                          </div>

                          <div className="pt-2 space-y-3">
                            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                              <div className="pr-4">
                                <div className="text-xs font-semibold text-slate-200">
                                  Enforce Strong Password Complexity
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Requires new passwords to contain at least 8 characters including uppercase, lowercase, numbers, and symbols.
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={draftSettings.enforce_strong_passwords}
                                onChange={(e) =>
                                  setDraftSettings({
                                    ...draftSettings,
                                    enforce_strong_passwords: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                              />
                            </label>

                            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                              <div className="pr-4">
                                <div className="text-xs font-semibold text-slate-200">
                                  Allow Password Reset Requests
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Enables locked or forgotten users to dispatch admin reset requests from the login screen.
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={draftSettings.allow_password_reset_requests}
                                onChange={(e) =>
                                  setDraftSettings({
                                    ...draftSettings,
                                    allow_password_reset_requests: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* 4. SHARING & PUBLIC LINKS */}
                      {activeCategory === 'sharing' && (
                        <div className="space-y-4">
                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Allow External Public Share Links
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Permits users to generate public shareable links accessible without an EleDrive account.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.allow_public_shares}
                              onChange={(e) =>
                                setDraftSettings({ ...draftSettings, allow_public_shares: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Require Passwords on Public Links
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Mandates that creators must set a security passcode on all newly created public links.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.require_link_passwords}
                              onChange={(e) =>
                                setDraftSettings({ ...draftSettings, require_link_passwords: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Default Link Expiration Period (Days)
                              </label>
                              <span className="text-[11px] font-mono text-purple-400 font-bold">
                                {draftSettings.default_link_expiry_days > 0
                                  ? `${draftSettings.default_link_expiry_days} Days`
                                  : 'Never'}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="365"
                              value={draftSettings.default_link_expiry_days}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  default_link_expiry_days: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-purple-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[7, 14, 30, 90, 0].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, default_link_expiry_days: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.default_link_expiry_days === preset
                                      ? 'bg-purple-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset === 0 ? 'Never' : `${preset}d`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Default lifespan pre-selected when generating new public links (0 for indefinite).
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 5. DATA RETENTION & LIFECYCLE */}
                      {activeCategory === 'retention' && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Trash Bin Auto-Purge Window (Days)
                              </label>
                              <span className="text-[11px] font-mono text-amber-400 font-bold">
                                {draftSettings.trash_retention_days > 0
                                  ? `${draftSettings.trash_retention_days} Days`
                                  : 'Never (Indefinite)'}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="365"
                              value={draftSettings.trash_retention_days}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  trash_retention_days: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[7, 14, 30, 60, 90, 0].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, trash_retention_days: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.trash_retention_days === preset
                                      ? 'bg-amber-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset === 0 ? 'Indefinite' : `${preset}d`}
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Days before soft-deleted files in user trash bins are permanently wiped (0 to retain indefinitely).
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-200">
                                Activity & Security Log Retention (Days)
                              </label>
                              <span className="text-[11px] font-mono text-amber-400 font-bold">
                                {draftSettings.activity_log_retention_days} Days
                              </span>
                            </div>
                            <input
                              type="number"
                              min="7"
                              max="1825"
                              value={draftSettings.activity_log_retention_days}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  activity_log_retention_days: parseInt(e.target.value) || 30,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 font-mono"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-slate-500 font-medium mr-1">Presets:</span>
                              {[30, 60, 90, 180, 365].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftSettings({ ...draftSettings, activity_log_retention_days: preset })}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                    draftSettings.activity_log_retention_days === preset
                                      ? 'bg-amber-600 text-white font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {preset}d
                                </button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                              Lifespan for system activity events, audit logs, and security tracking entries.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 6. FORENSIC ATTRIBUTION & SECURITY */}
                      {activeCategory === 'forensics' && (
                        <div className="space-y-4">
                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Steganographic Binary Trailer Watermarking
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Injects non-destructive cryptographic origin signatures and user tokens into downloaded binary files.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.forensic_watermarking_enabled}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  forensic_watermarking_enabled: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Invisible Steganographic Digital Canary
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Injects covert forensic payloads into exported archives and downloads for forensic leak detection.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.steganographic_canary_enabled}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  steganographic_canary_enabled: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors cursor-pointer select-none">
                            <div className="pr-4">
                              <div className="text-xs font-semibold text-slate-200">
                                Log Detailed Download Signatures
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Captures IP address, cryptographic hash, user ID, and timestamp in the security audit ledger on every download.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.log_forensic_downloads}
                              onChange={(e) =>
                                setDraftSettings({
                                  ...draftSettings,
                                  log_forensic_downloads: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              Active Attribution Safeguards
                            </h4>
                            <div className="space-y-1.5 text-[11px] text-slate-400">
                              <div className="flex items-center justify-between">
                                <span>Cryptographic UUID per Asset</span>
                                <span className="text-emerald-400 font-bold font-mono">ACTIVE</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Folder ZIP Forensic Signature & Trailer</span>
                                <span className="text-emerald-400 font-bold font-mono">ACTIVE</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>SHA-256 Checksum Verification</span>
                                <span className="text-emerald-400 font-bold font-mono">ACTIVE</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 7. SYSTEM OPERATIONS & MAINTENANCE */}
                      {activeCategory === 'maintenance' && (
                        <div className="space-y-4">
                          <label
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-colors cursor-pointer select-none ${
                              draftSettings.maintenance_mode
                                ? 'bg-rose-950/20 border-rose-500/40'
                                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
                            }`}
                          >
                            <div className="pr-4">
                              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                <span>Enable Maintenance Mode</span>
                                {draftSettings.maintenance_mode && (
                                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[10px] uppercase font-bold">
                                    Active Lockout
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                Restricts normal user access and displays the maintenance notice across all client pages. Administrators retain full access.
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={draftSettings.maintenance_mode}
                              onChange={(e) =>
                                setDraftSettings({ ...draftSettings, maintenance_mode: e.target.checked })
                              }
                              className="w-5 h-5 rounded text-rose-600 bg-slate-900 border-slate-700 focus:ring-0 shrink-0 cursor-pointer"
                            />
                          </label>

                          <div>
                            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                              Maintenance Broadcast Notice
                            </label>
                            <textarea
                              rows={4}
                              value={draftSettings.maintenance_notice}
                              onChange={(e) =>
                                setDraftSettings({ ...draftSettings, maintenance_notice: e.target.value })
                              }
                              placeholder="Describe scheduled maintenance window or reason..."
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-rose-500 resize-none font-sans"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Custom broadcast banner displayed to users when maintenance mode is active.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Status alerts */}
                      {settingsSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>{settingsSuccess}</span>
                        </div>
                      )}

                      {settingsError && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{settingsError}</span>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/95 shrink-0">
                      <button
                        type="button"
                        onClick={closeCategoryModal}
                        className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{savingSettings ? 'Saving Changes...' : 'Save Configuration'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Attribution */}
        <div className="text-center pt-8 pb-4 border-t border-slate-800/60">
          <p className="text-xs text-slate-500 font-medium tracking-wide">
            Developed and Powered by{' '}
            <span className="font-bold text-slate-400 tracking-wider">ELETHIYA</span>
          </p>
        </div>
      </div>

      {/* Edit User Profile Window (Enhanced with extensive options) */}
      {editUserModal && (editUserModal.role !== 'owner' || user?.role === 'owner') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          <div className="relative bg-slate-900 rounded-none sm:rounded-3xl max-w-xl w-full h-full sm:h-auto sm:max-h-[90vh] border-0 sm:border border-slate-800 shadow-none sm:shadow-2xl sm:shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
            {/* Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Fixed Header */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Edit className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">Edit User Profile</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Configure identity, credentials, roles & quotas</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const u = editUserModal;
                    setEditUserModal(null);
                    setViewUserModal(u);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="View Full Profile Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View Details</span>
                </button>
                <button
                  onClick={() => {
                    setEditUserModal(null);
                    setResetPasswordInput('');
                  }}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body with custom-scrollbar */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 relative z-10">
              {/* User Identity Visual & Color Customization */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-md ring-2 ring-slate-800 shrink-0"
                    style={{ backgroundColor: editUserModal.avatar_color || '#3b82f6' }}
                  >
                    {editUserModal.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200 text-xs truncate">{editUserModal.name || 'User'}</span>
                      {editUserModal.role === 'owner' && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                      <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">@{editUserModal.username}</span>
                    </div>
                  </div>
                </div>

                {/* Avatar Accent Color Picker */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-slate-500" />
                    <span>Avatar Accent Theme</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditUserModal({ ...editUserModal, avatar_color: color })}
                        className={`w-6 h-6 rounded-full transition-all ${
                          editUserModal.avatar_color === color
                            ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500 scale-110 shadow-sm'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Profile Fields */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Full Name</span>
                    </label>
                    <input
                      type="text"
                      value={editUserModal.name}
                      onChange={(e) => setEditUserModal({ ...editUserModal, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>Email Address</span>
                    </label>
                    <input
                      type="email"
                      value={editUserModal.email || ''}
                      onChange={(e) => setEditUserModal({ ...editUserModal, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Role Privilege</label>
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
                        Only Workspace Owner can assign or revoke Admin roles.
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
                      <option value="approved">Approved (Active)</option>
                      <option value="pending">Pending Review</option>
                      <option value="rejected">Rejected (Suspended)</option>
                    </select>
                  </div>
                </div>

                {/* Storage Quota Section with Presets */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                      <span>Allocated Storage Quota</span>
                    </label>
                    {editUserModal.role === 'owner' && (
                      <span className="text-amber-400 font-bold text-[10px]">Owner Quota</span>
                    )}
                  </div>

                  {editUserModal.role === 'owner' && user?.role !== 'owner' ? (
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-amber-400 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Admins cannot change the Owner's storage limit</span>
                    </div>
                  ) : (
                    <>
                      {/* Quick Quota Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold mr-1">Presets:</span>
                        {QUOTA_PRESETS.map((gb) => {
                          const currentGB = Math.round((editUserModal.storage_limit || 10737418240) / (1024 * 1024 * 1024));
                          return (
                            <button
                              key={gb}
                              type="button"
                              onClick={() =>
                                setEditUserModal({
                                  ...editUserModal,
                                  storage_limit: gb * 1024 * 1024 * 1024,
                                })
                              }
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                currentGB === gb
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                              }`}
                            >
                              {gb} GB
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="relative flex-1">
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
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-semibold focus:outline-hidden focus:border-blue-500 pr-9"
                          />
                          <span className="absolute right-3 top-2 text-[11px] text-slate-500 font-bold pointer-events-none">GB</span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {formatBytes(editUserModal.storage_used || 0)} consumed
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Pending Password Reset Notification inside Edit Modal */}
                {(() => {
                  const pending = pendingResets.find((pr) => pr.user_id === editUserModal.id);
                  if (!pending) return null;
                  return (
                    <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-200">
                      <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <span>User Requested Password Reset</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        </div>
                        {pending.reason && (
                          <p className="text-[11px] text-amber-200/90 mt-1 italic">
                            "{pending.reason}"
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Setting a new password below will automatically mark this pending request as resolved.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Password Reset Option */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                      <span>Reset User Password</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Optional</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPasswordInput}
                      onChange={(e) => setResetPasswordInput(e.target.value)}
                      placeholder="Leave empty to keep current password"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-purple-500 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                      title={showResetPassword ? 'Hide password' : 'Show password'}
                    >
                      {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Minimum 6 characters. Enter a new password to immediately force an account credential update.
                  </p>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
              <button
                type="button"
                onClick={() => {
                  setEditUserModal(null);
                  setResetPasswordInput('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingUserEdit}
                onClick={async () => {
                  if (editUserModal.role === 'owner' && user?.role !== 'owner') {
                    toast.error("Admins cannot change the Owner's storage limit");
                    return;
                  }
                  if (resetPasswordInput && resetPasswordInput.trim().length < 6) {
                    toast.error("New password must be at least 6 characters");
                    return;
                  }

                  setSavingUserEdit(true);
                  try {
                    const payload = {
                      name: editUserModal.name,
                      email: editUserModal.email,
                      role: editUserModal.role,
                      avatar_color: editUserModal.avatar_color,
                      status: editUserModal.status,
                      storage_limit: editUserModal.storage_limit,
                    };
                    if (resetPasswordInput && resetPasswordInput.trim().length >= 6) {
                      payload.password = resetPasswordInput.trim();
                    }

                    await adminAPI.updateUser(editUserModal.id, payload);
                    setEditUserModal(null);
                    setResetPasswordInput('');
                    loadUsers();
                    loadPasswordResets();
                    toast.success(
                      editUserModal.id === user?.id
                        ? 'Self profile & storage limit updated!'
                        : `User "${editUserModal.name}" updated successfully!`
                    );
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to update user');
                  } finally {
                    setSavingUserEdit(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingUserEdit ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile View Floating Window */}
      {viewUserModal && (viewUserModal.role !== 'owner' || user?.role === 'owner') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          <div className="relative bg-slate-900 rounded-none sm:rounded-3xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] border-0 sm:border border-slate-800 shadow-none sm:shadow-2xl sm:shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100">
            {/* Ambient Top Glow */}
            <div className="absolute -top-16 -left-16 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Fixed Header */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">User Profile Overview</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Identity, quota & forensic audit trail</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {viewUserModal.role === 'owner' && user?.role !== 'owner' ? null : (
                  <button
                    onClick={() => {
                      const u = viewUserModal;
                      setViewUserModal(null);
                      setEditUserModal(u);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    title="Edit Profile"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit Profile</span>
                  </button>
                )}
                <button
                  onClick={() => setViewUserModal(null)}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body with custom-scrollbar */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-5 relative z-10">
              {/* Hero Profile Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex items-center sm:items-start gap-3.5 sm:gap-4">
                <div
                  className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center font-bold text-white text-xl sm:text-3xl shadow-xl ring-2 sm:ring-4 ring-slate-800/80 shrink-0"
                  style={{ backgroundColor: viewUserModal.avatar_color || '#3b82f6' }}
                >
                  {viewUserModal.name?.charAt(0).toUpperCase() || 'U'}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-start gap-2 mb-1">
                    <h4 className="text-base sm:text-lg font-bold text-slate-100 truncate">{viewUserModal.name}</h4>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
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
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
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
                  <div className="flex flex-wrap items-center justify-start gap-2 text-[11px] text-slate-400">
                    <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 truncate max-w-[200px] sm:max-w-[240px]">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
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
              <div className="p-3.5 sm:p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-2">
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
              <div className="p-3.5 sm:p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-3">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Specifications</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Username</span>
                    <span className="font-semibold text-slate-200 font-mono">@{viewUserModal.username}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Email</span>
                    <span className="font-semibold text-slate-200 truncate max-w-[150px]">{viewUserModal.email}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Registered On</span>
                    <span className="font-semibold text-slate-200">{formatDate(viewUserModal.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Last Profile Update</span>
                    <span className="font-semibold text-slate-200">{formatDate(viewUserModal.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Role Privilege</span>
                    <span className="font-semibold text-slate-200">{viewUserModal.role?.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Forensic Attribution</span>
                    <span className="font-semibold text-emerald-400 font-mono text-[11px]">ACTIVE</span>
                  </div>
                </div>
              </div>

              {/* User Activity Logs Audit Trail */}
              <div className="p-3.5 sm:p-4 bg-slate-950/50 border border-slate-800/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ScrollText className="w-3.5 h-3.5 text-blue-400" />
                    Recent Activity Audit Trail
                  </h5>
                  <span className="text-[10px] text-slate-500">Last recorded events</span>
                </div>

                {(() => {
                  const userLogs = (logs || []).filter(
                    (l) =>
                      l.user_id === viewUserModal.id ||
                      l.user_name === viewUserModal.name ||
                      l.user_name === viewUserModal.username ||
                      l.details?.toLowerCase().includes(viewUserModal.username.toLowerCase()) ||
                      l.details?.toLowerCase().includes(viewUserModal.email.toLowerCase())
                  ).slice(0, 10);

                  if (userLogs.length === 0) {
                    return (
                      <div className="text-center py-4 text-xs text-slate-500">
                        No activity or forensic records logged for this user yet.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {userLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/70 text-xs gap-2"
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            {log.action === 'forensic_inspect' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold uppercase shrink-0 border border-emerald-500/30">
                                <Fingerprint className="w-2.5 h-2.5" />
                                <span>Forensic</span>
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px] font-semibold uppercase shrink-0">
                                {log.action}
                              </span>
                            )}
                            <span className="text-slate-300 truncate font-medium">{log.item_name || log.details}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Fixed Action Footer */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
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
                    <span className="hidden sm:inline">Edit User / Quota</span>
                    <span className="sm:hidden">Edit</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewUserModal(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Requests Management Modal */}
      {showResetsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-0 sm:border sm:border-slate-800 rounded-none sm:rounded-3xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Fixed Header */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-xs">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Password Reset Requests</span>
                    {pendingResets.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                        {pendingResets.length} Pending
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review and authorize credentials resets requested by team members
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadPasswordResets}
                  disabled={loadingResets}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors group disabled:opacity-60"
                  title="Refresh requests"
                >
                  <RefreshCw
                    className={`w-4 h-4 transition-transform duration-500 ${
                      loadingResets ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetsModal(false);
                    setSelectedReset(null);
                    setNewAdminPassword('');
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Sub-header Filter Tabs */}
            <div className="px-4 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {['pending', 'all', 'resolved', 'rejected'].map((filter) => {
                  const count =
                    filter === 'all'
                      ? passwordResets.length
                      : passwordResets.filter((r) => r.status === filter).length;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setResetFilter(filter)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 ${
                        resetFilter === filter
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <span>{filter}</span>
                      <span className="text-[10px] opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Real-time admin queue
              </span>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-3 relative z-10">
              {loadingResets ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Loading reset requests...</span>
                </div>
              ) : filteredResets.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">No {resetFilter !== 'all' ? resetFilter : ''} requests found</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    When users click "Forgot password?" or request a reset on the login portal, their requests will appear here.
                  </p>
                </div>
              ) : (
                filteredResets.map((req) => {
                  const isSelected = selectedReset?.id === req.id;
                  return (
                    <div
                      key={req.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        req.status === 'pending'
                          ? isSelected
                            ? 'bg-amber-950/30 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-950/60 border-amber-500/20 hover:border-amber-500/40'
                          : req.status === 'resolved'
                          ? 'bg-slate-950/40 border-emerald-500/20'
                          : 'bg-slate-950/40 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs"
                            style={{ backgroundColor: req.avatar_color || '#3b82f6' }}
                          >
                            {req.user_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-100">{req.user_name}</span>
                              <span className="text-[11px] text-slate-400">@{req.user_username}</span>
                              {req.status === 'pending' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  Pending
                                </span>
                              )}
                              {req.status === 'resolved' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  Resolved
                                </span>
                              )}
                              {req.status === 'rejected' && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold">
                                  Rejected
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="text-slate-300">{req.user_email}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {formatDate(req.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons if pending */}
                        {req.status === 'pending' && (
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedReset(null);
                                } else {
                                  setSelectedReset(req);
                                  setNewAdminPassword('');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>{isSelected ? 'Close Reset Form' : 'Reset Password'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={resolvingReset}
                              onClick={() => handleResolveReset('reject', req)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 transition-colors border border-transparent hover:border-red-500/30"
                              title="Dismiss / Reject request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {req.status === 'resolved' && (
                          <div className="text-[11px] text-emerald-400/80 font-medium self-end sm:self-center text-right">
                            <span>Reset by @{req.resolved_by || 'admin'}</span>
                          </div>
                        )}
                      </div>

                      {/* Reason note */}
                      {req.reason && (
                        <div className="mt-2.5 p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                          <span className="text-slate-500 font-semibold shrink-0">Note:</span>
                          <span className="italic text-slate-300">"{req.reason}"</span>
                        </div>
                      )}

                      {/* Inline Reset Form if this item is selected */}
                      {isSelected && req.status === 'pending' && (
                        <div className="mt-3 p-3.5 bg-slate-900 border border-amber-500/30 rounded-xl space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Assign New Password for @{req.user_username}</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const randomPass = Math.random().toString(36).slice(-8) + '!A9';
                                setNewAdminPassword(randomPass);
                                setShowNewAdminPassword(true);
                                toast.success('Generated random secure password');
                              }}
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold hover:underline flex items-center gap-1 group"
                            >
                              <RefreshCw className="w-3 h-3 transition-transform duration-500 group-hover:rotate-180" />
                              <span>Generate Random Password</span>
                            </button>
                          </div>

                          <div className="relative">
                            <input
                              type={showNewAdminPassword ? 'text' : 'password'}
                              value={newAdminPassword}
                              onChange={(e) => setNewAdminPassword(e.target.value)}
                              placeholder="Enter new password (min 6 chars)..."
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-hidden focus:border-amber-500 pr-16 font-mono"
                            />
                            <div className="absolute right-2 top-2 flex items-center gap-1">
                              {newAdminPassword && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(newAdminPassword);
                                    toast.success('Password copied to clipboard!');
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-200"
                                  title="Copy password"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                                className="p-1 text-slate-400 hover:text-slate-200"
                                title={showNewAdminPassword ? 'Hide password' : 'Show password'}
                              >
                                {showNewAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <p className="text-[10px] text-slate-400">
                              Copy and share this new password securely with the user.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedReset(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={resolvingReset || !newAdminPassword || newAdminPassword.trim().length < 6}
                                onClick={() => handleResolveReset('reset', req)}
                                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{resolvingReset ? 'Saving...' : 'Apply & Complete Reset'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Fixed Footer */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
              <span className="text-[11px] text-slate-500">
                {passwordResets.length} total request records
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowResetsModal(false);
                  setSelectedReset(null);
                  setNewAdminPassword('');
                }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Creation Requests Management Modal */}
      {showTeamRequestsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-slate-900 border-0 sm:border sm:border-slate-800 rounded-none sm:rounded-3xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Fixed Header */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Team Creation Proposals</span>
                    {pendingTeamRequests.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                        {pendingTeamRequests.length} Pending
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Review and authorize team workspace creation requests
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadTeamRequests}
                  disabled={loadingTeamRequests}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors group disabled:opacity-60"
                  title="Refresh proposals"
                >
                  <RefreshCw
                    className={`w-4 h-4 transition-transform duration-500 ${
                      loadingTeamRequests ? 'animate-spin text-blue-400' : 'group-hover:rotate-180 text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTeamRequestsModal(false);
                    setRejectingRequest(null);
                    setRejectAdminNote('');
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {['pending', 'all', 'approved', 'rejected'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTeamRequestFilter(f)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors shrink-0 ${
                    teamRequestFilter === f
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {f === 'pending'
                    ? `Pending (${pendingTeamRequests.length})`
                    : f === 'all'
                    ? `All (${teamRequests.length})`
                    : f}
                </button>
              ))}
            </div>

            {/* Scrollable Proposals List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
              {loadingTeamRequests ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                  Loading proposals...
                </div>
              ) : filteredTeamRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                  <p>No team proposals match the "{teamRequestFilter}" filter.</p>
                </div>
              ) : (
                filteredTeamRequests.map((req) => {
                  const isRejectingThis = rejectingRequest?.id === req.id;
                  const isProcessing = processingTeamRequestId === req.id;

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition-all"
                    >
                      {/* Requester & Team Details */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 ring-1 ring-white/10"
                            style={{ backgroundColor: req.avatar_color || '#3b82f6' }}
                          >
                            {req.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-100 truncate">{req.name}</h4>
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                                Requested by <strong className="text-slate-200 font-semibold">{req.user_name}</strong> (@{req.user_username})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {req.user_email} • Submitted {formatDate(req.created_at)}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 self-start sm:self-auto">
                          {req.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-amber-500/15 text-amber-300 border-amber-500/30">
                              <Clock className="w-3 h-3 animate-pulse" />
                              Pending Review
                            </span>
                          ) : req.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-red-500/15 text-red-300 border-red-500/30">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {req.description && (
                        <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-855">
                          {req.description}
                        </p>
                      )}

                      {/* Requested Initial Teammates */}
                      {req.initial_members && req.initial_members.length > 0 && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <span>Requested Teammates: </span>
                          <strong className="text-slate-200">{req.initial_members.length} members</strong>
                        </div>
                      )}

                      {/* Review Metadata for processed items */}
                      {req.status === 'approved' && req.reviewed_at && (
                        <div className="text-[11px] text-emerald-400/90 font-mono bg-emerald-950/20 border border-emerald-500/20 p-2 rounded-xl flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Approved by {req.reviewed_by || 'Admin'} on {formatDate(req.reviewed_at)}</span>
                        </div>
                      )}

                      {req.status === 'rejected' && (
                        <div className="text-[11px] text-red-400/90 bg-red-950/20 border border-red-500/20 p-2.5 rounded-xl space-y-1">
                          <div className="font-semibold text-red-300 flex items-center gap-1">
                            <X className="w-3 h-3" />
                            <span>Rejected by {req.reviewed_by || 'Admin'} {req.reviewed_at ? `on ${formatDate(req.reviewed_at)}` : ''}</span>
                          </div>
                          {req.admin_note && (
                            <p className="text-slate-300 text-[11px]">{req.admin_note}</p>
                          )}
                        </div>
                      )}

                      {/* Pending Actions */}
                      {req.status === 'pending' && (
                        <div className="pt-2 border-t border-slate-900">
                          {isRejectingThis ? (
                            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                              <label className="block text-xs font-semibold text-slate-200">
                                Feedback / Rejection Reason (Optional):
                              </label>
                              <textarea
                                rows={2}
                                value={rejectAdminNote}
                                onChange={(e) => setRejectAdminNote(e.target.value)}
                                placeholder="Explain why this team proposal was not approved..."
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-red-500 resize-none"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingRequest(null);
                                    setRejectAdminNote('');
                                  }}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={handleRejectTeamRequest}
                                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                                >
                                  {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => {
                                  setRejectingRequest(req);
                                  setRejectAdminNote('');
                                }}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApproveTeamRequest(req.id, req.name)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isProcessing ? 'Approving...' : 'Approve & Create Team'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Fixed Footer */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-sm relative z-10">
              <span className="text-[11px] text-slate-500 font-mono">
                {teamRequests.length} total team proposals
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowTeamRequestsModal(false);
                  setRejectingRequest(null);
                  setRejectAdminNote('');
                }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
