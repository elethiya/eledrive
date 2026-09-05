import React, { useState, useEffect, useRef } from 'react';
import {
  Fingerprint,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  Search,
  Upload,
  FileText,
  X,
  Hash,
  AlertTriangle,
  RefreshCw,
  Eye,
  Download,
  Copy,
  Check,
  Clock,
  UserPlus,
  Trash2,
  Lock,
  ArrowLeft,
  Users,
  ScanLine,
  Key,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtimeEvent } from '../context/RealtimeContext';
import { forensicAPI, authAPI } from '../api/client';
import { formatBytes, formatDate } from '../utils/formatters';

export default function ForensicPage({ onNavigateView }) {
  const { user } = useAuth();
  const toast = useToast();

  // Active Tab: 'scanner' | 'files'
  const [activeTab, setActiveTab] = useState('scanner');

  // Floating Window (Modal) State for Forensic Access Manager
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

  // Access status & Owner verification
  const [accessStatus, setAccessStatus] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);

  // Inspector State
  const [inspectQuery, setInspectQuery] = useState('');
  const [inspectFile, setInspectFile] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [inspectError, setInspectError] = useState('');
  const [copiedUUID, setCopiedUUID] = useState('');
  const [isForensicDragOver, setIsForensicDragOver] = useState(false);
  const fileDropRef = useRef(null);

  // Stats & Recent
  const [securityStats, setSecurityStats] = useState(null);
  const [_loadingStats, setLoadingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Owner Management State
  const [grants, setGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState('owner_only');
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Grant Modal / Form
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [grantDuration, setGrantDuration] = useState('24h'); // '1h' | '24h' | '7d' | '30d' | 'custom' | 'forever'
  const [customDateTime, setCustomDateTime] = useState('');
  const [grantNote, setGrantNote] = useState('');
  const [submittingGrant, setSubmittingGrant] = useState(false);

  // Load access status
  const loadAccess = async () => {
    try {
      const res = await forensicAPI.getAccess();
      const data = res?.data !== undefined ? res.data : res;
      if (data) {
        setAccessStatus(data);
        setCurrentPolicy(data.policy || 'owner_only');
      }
    } catch (err) {
      console.error('Failed to load forensic access status:', err);
    } finally {
      setLoadingAccess(false);
    }
  };

  // Load stats
  const loadStats = async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    setLoadingStats(true);
    try {
      const res = await forensicAPI.getStats();
      const data = res?.data !== undefined ? res.data : res;
      if (data) {
        setSecurityStats(data);
      }
    } catch (err) {
      console.error('Failed to load forensic stats:', err);
    } finally {
      setLoadingStats(false);
      if (showIndicator) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  // Load owner grants
  const loadGrants = async () => {
    setLoadingGrants(true);
    try {
      const res = await forensicAPI.getGrants();
      const data = res?.data !== undefined ? res.data : res;
      if (data) {
        setGrants(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load access grants:', err);
    } finally {
      setLoadingGrants(false);
    }
  };

  // Load user candidates for granting access
  const loadUsersList = async () => {
    try {
      const res = await authAPI.listMembers();
      const data = res?.data !== undefined ? res.data : res;
      if (Array.isArray(data)) {
        setAllUsers(data.filter((u) => u.id !== user?.id));
      }
    } catch (err) {
      console.error('Failed to load members for grant selector:', err);
    }
  };

  useEffect(() => {
    loadAccess();
  }, [user]);

  useEffect(() => {
    if (accessStatus?.has_access) {
      loadStats();
    }
    if (accessStatus?.is_owner) {
      loadGrants();
      loadUsersList();
    }
  }, [accessStatus?.has_access, accessStatus?.is_owner]);

  // Real-time updates on file or sync events
  useRealtimeEvent(['file', 'sync', 'forensic'], () => {
    if (accessStatus?.has_access) {
      loadStats();
    }
    if (accessStatus?.is_owner) {
      loadGrants();
    }
  });

  // Close Access Modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAccessModalOpen(false);
      }
    };
    if (isAccessModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccessModalOpen]);

  const handleCopyUUID = (uuid) => {
    if (!uuid) return;
    navigator.clipboard.writeText(uuid);
    setCopiedUUID(uuid);
    setTimeout(() => setCopiedUUID(''), 2500);
  };

  // Forensic Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isForensicDragOver) setIsForensicDragOver(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsForensicDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsForensicDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsForensicDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      setInspectFile(dropped);
      setInspectError('');
      toast.info(`Loaded suspect file: ${dropped.name}`);
    }
  };

  // Run Forensic Inspection
  const handleInspect = async (e) => {
    if (e) e.preventDefault();
    if (!inspectFile && !inspectQuery.trim()) {
      setInspectError('Please select a suspect file or enter a Secret UUID.');
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
        res = await forensicAPI.inspect(formData);
      } else {
        res = await forensicAPI.inspect({ query: inspectQuery.trim() });
      }

      const data = res?.data !== undefined ? res.data : res;
      if (data) {
        setInspectionResult(data);
      }
    } catch (err) {
      setInspectError(err.response?.data?.error || err.message || 'Forensic analysis failed to find matching asset.');
    } finally {
      setInspecting(false);
    }
  };

  // Update Access Policy (Owner only)
  const handlePolicyChange = async (newPolicy) => {
    setSavingPolicy(true);
    try {
      await forensicAPI.updatePolicy(newPolicy);
      setCurrentPolicy(newPolicy);
      setAccessStatus((prev) => ({ ...prev, policy: newPolicy }));
      toast.success(`Access policy updated to: ${newPolicy}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update access policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  // Create or Update Access Grant
  const handleCreateGrant = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a user to grant access');
      return;
    }

    let expiresAt = null;
    const now = new Date();

    if (grantDuration === '1h') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (grantDuration === '24h') {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (grantDuration === '7d') {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (grantDuration === '30d') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (grantDuration === 'custom') {
      if (!customDateTime) {
        toast.error('Please specify a custom expiration date and time');
        return;
      }
      const customDate = new Date(customDateTime);
      if (customDate <= now) {
        toast.error('Expiration date must be in the future');
        return;
      }
      expiresAt = customDate.toISOString();
    } else if (grantDuration === 'forever') {
      expiresAt = null; // permanent
    }

    setSubmittingGrant(true);
    try {
      await forensicAPI.createGrant({
        user_id: selectedUserId,
        expires_at: expiresAt,
        notes: grantNote.trim(),
      });
      toast.success('Forensic tool access granted successfully!');
      setSelectedUserId('');
      setGrantNote('');
      setCustomDateTime('');
      setGrantDuration('24h');
      loadGrants();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to grant access');
    } finally {
      setSubmittingGrant(false);
    }
  };

  // Revoke Access Grant
  const handleRevokeGrant = async (grantId, userName) => {
    try {
      await forensicAPI.revokeGrant(grantId);
      toast.success(`Revoked forensic access for ${userName || 'user'}`);
      loadGrants();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke grant');
    }
  };

  // Loading state
  if (loadingAccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium">Verifying forensic authorization...</p>
      </div>
    );
  }

  // Access Denied Screen (if user does not have permission)
  if (!accessStatus?.has_access) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-4 sm:p-6 text-center text-slate-100 min-h-0 overflow-y-auto">
        <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-amber-500/30 text-center max-w-lg w-full mx-auto space-y-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-7 h-7 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono font-bold uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" />
              <span>Owner Access Policy Active</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100">
              Forensic Detective Restricted
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              Cryptographic forensic leak inspection, watermark decoding, and digital attribution tools are restricted by the Workspace Owner.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Current Workspace Policy:</span>
              <span className="font-mono font-bold text-amber-400 uppercase">
                {accessStatus?.policy === 'owner_only'
                  ? 'Owner Only'
                  : accessStatus?.policy === 'admins'
                  ? 'Administrators'
                  : accessStatus?.policy === 'all_users'
                  ? 'All Members'
                  : accessStatus?.policy === 'custom'
                  ? 'User Grants Only'
                  : accessStatus?.policy}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Your Status:</span>
              <span className="font-mono text-rose-400 font-semibold">{accessStatus?.reason || 'No Active Grant'}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Contact your Workspace Owner to request time-limited or permanent forensic authorization.
          </p>

          <button
            onClick={() => onNavigateView && onNavigateView('drive')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold mx-auto transition-colors shadow-lg shadow-blue-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Drive</span>
          </button>
        </div>
      </div>
    );
  }

  const isOwner = accessStatus?.is_owner;
  const activeGrant = accessStatus?.active_grant;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100 font-sans select-none min-w-0">
      {/* Top Action Bar - Optimized for Mobile & Desktop UI */}
      <div className="h-14 sm:h-16 px-3 sm:px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 shrink-0 min-w-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/10">
            <Fingerprint className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate tracking-tight">
                Forensic Detective
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase font-bold tracking-wide">
                100% Attribution
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate sm:hidden">
              Cryptographic Leak Ledger
            </p>
          </div>
        </div>

        {/* Right Controls: Expiration/Owner Badge, Access Manager Button & Refresh */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isOwner ? (
            <>
              {/* Desktop Owner Badge */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Workspace Owner</span>
              </span>
              {/* Mobile Owner Icon Badge */}
              <span
                className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold"
                title="Workspace Owner"
              >
                <Crown className="w-3 h-3 text-amber-400" />
                <span className="hidden min-[380px]:inline">Owner</span>
              </span>
            </>
          ) : activeGrant ? (
            <>
              {/* Desktop Grant Expiration */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{activeGrant.expires_at ? `Expires ${formatDate(activeGrant.expires_at)}` : 'Permanent Grant'}</span>
              </span>
              {/* Mobile Grant Indicator */}
              <span
                className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-semibold"
                title={activeGrant.expires_at ? `Expires ${formatDate(activeGrant.expires_at)}` : 'Permanent Grant'}
              >
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="hidden min-[380px]:inline">
                  {activeGrant.expires_at ? 'Active' : 'Perm'}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Authorized</span>
              </span>
              <span
                className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold"
                title="Authorized Access"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
              </span>
            </>
          )}


          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => {
              loadStats(true);
              if (isOwner) loadGrants();
            }}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all shrink-0 disabled:opacity-60"
            title="Refresh statistics & ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Bar (Tab List & List Type Button for Access Manager) */}
      <div className="px-3.5 sm:px-6 pt-2 pb-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'scanner'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>Scanner & Detective</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'files'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Tracked Files</span>
            {securityStats?.total_tracked_files > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${activeTab === 'files' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>
                {securityStats.total_tracked_files}
              </span>
            )}
          </button>
          
          {/* List Type Button to open Forensic Access Manager in Floating Window */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsAccessModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-all shrink-0 shadow-xs"
              title="Open Forensic Access Manager"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Forensic Access Manager</span>
              {grants.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
                  {grants.length}
                </span>
              )}
            </button>
          )}

        </div>
      </div>

      {/* Main Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-6 min-w-0">
        <div className="max-w-7xl mx-auto space-y-6 min-w-0">
          {/* ===================================================================== */}
          {/* TAB 1: SCANNER & LEAK DETECTIVE */}
          {/* ===================================================================== */}
          {activeTab === 'scanner' && (
            <div className="space-y-6 min-w-0">
              {/* Quick Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 min-w-0">
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xs min-w-0">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold mb-1 truncate">
                    <span className="truncate">Tracked Files</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-100 truncate">
                    {securityStats?.total_tracked_files ?? 0}
                  </div>
                  <p className="text-[10px] text-emerald-400 font-mono truncate mt-0.5">
                    Steganographic active
                  </p>
                </div>

                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xs min-w-0">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold mb-1 truncate">
                    <span className="truncate">Exfiltration Events</span>
                    <Eye className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-slate-100 truncate">
                    {securityStats?.total_downloads_logged ?? 0}
                  </div>
                  <p className="text-[10px] text-blue-400 font-mono truncate mt-0.5">
                    Downloads & views
                  </p>
                </div>

                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xs min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold mb-1 truncate">
                      <span className="truncate">Access Policy</span>
                      <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-100 truncate uppercase font-mono mt-1">
                      {accessStatus?.policy === 'owner_only' ? 'Owner Only' : accessStatus?.policy === 'admins' ? 'Admins' : accessStatus?.policy === 'all_users' ? 'All Users' : 'Custom'}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px] text-purple-400 font-mono truncate">
                      Enforced by Owner
                    </p>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setIsAccessModalOpen(true)}
                        className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 ml-1 shrink-0"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xs min-w-0">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold mb-1 truncate">
                    <span className="truncate">Detective Engine</span>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-400 truncate mt-1">
                    Operational
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                    SHA-256 + HMAC-UUID
                  </p>
                </div>
              </div>

              {/* Interactive Scanner Card */}
              <div className="sm:p-6 sm:rounded-3xl sm:bg-slate-900 sm:border sm:border-slate-800 sm:shadow-xl space-y-4 sm:space-y-5 min-w-0">
                <div className="min-w-0 px-1 sm:px-0">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-emerald-400" />
                    <span>Suspect Asset Analyzer & Ledger Search</span>
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Upload an exfiltrated file or paste an extracted UUID / token to pinpoint the exact user who leaked or saved it.
                  </p>
                </div>

                <form onSubmit={handleInspect} className="space-y-4 min-w-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                    {/* Drop Area */}
                    <div
                      ref={fileDropRef}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => {
                        const input = document.getElementById('forensic-file-upload');
                        if (input) input.click();
                      }}
                      className={`relative p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center group min-h-[130px] min-w-0 ${
                        isForensicDragOver
                          ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                          : inspectFile
                          ? 'border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950'
                      }`}
                    >
                      <input
                        id="forensic-file-upload"
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
                        <div className="flex flex-col items-center gap-1.5 animate-pulse">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-blue-300 truncate">Release file to inspect</span>
                        </div>
                      ) : inspectFile ? (
                        <div className="flex items-center gap-2.5 w-full px-2 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-bold text-slate-200 truncate" title={inspectFile.name}>
                              {inspectFile.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{formatBytes(inspectFile.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectFile(null);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 shrink-0"
                            title="Remove file"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1 pointer-events-none min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 group-hover:text-emerald-400 border border-slate-700/60 flex items-center justify-center mx-auto transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                          </div>
                          <p className="text-xs font-semibold text-slate-300">
                            Click or drag suspect file here
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Images, Videos, PDFs, Audio, Code, Zip, or any binary
                          </p>
                        </div>
                      )}
                    </div>

                    {/* UUID Input Area */}
                    <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3 min-w-0">
                      <div className="min-w-0">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                          Or Search by Secret UUID / Token
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">
                          Query the cryptographic audit ledger directly with an extracted tracking atom.
                        </p>
                        <div className="relative min-w-0">
                          <Hash className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                          <input
                            type="text"
                            placeholder="e.g. 8f14e45f-..."
                            value={inspectQuery}
                            onChange={(e) => {
                              setInspectQuery(e.target.value);
                              setInspectError('');
                            }}
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono"
                          />
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 min-w-0">
                        <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">Matches uploader, downloads & browser preview sessions</span>
                      </div>
                    </div>
                  </div>

                  {inspectError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="break-words min-w-0 flex-1">{inspectError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {(inspectFile || inspectQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectFile(null);
                          setInspectQuery('');
                          setInspectionResult(null);
                          setInspectError('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                      >
                        Clear
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={inspecting}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-60"
                    >
                      {inspecting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing Watermarks...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Inspect & Attribute Leak</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Inspection Result Presentation */}
                {inspectionResult && (
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-200 min-w-0 ${
                      inspectionResult.matched
                        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border-emerald-500/40 shadow-xl'
                        : inspectionResult.risk_assessment === 'UNMATCHED_ASSET'
                        ? 'bg-slate-950 border-slate-800 text-slate-300'
                        : 'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30 border-amber-500/40 shadow-xl'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            inspectionResult.matched
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {inspectionResult.matched ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                MATCH CONFIRMED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                NO RECORD
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inspectionResult.matched
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Risk: {inspectionResult.matched ? (inspectionResult.risk_assessment || 'HIGH_IMPACT_BREACH') : 'NONE'}
                            </span>
                          </div>
                          <div
                            className="text-xs sm:text-sm font-black text-slate-100 truncate mt-1"
                            title={inspectionResult.original_filename || 'Target Asset'}
                          >
                            {inspectionResult.matched
                              ? `Identified Asset: ${inspectionResult.original_filename}`
                              : `Target: ${inspectionResult.original_filename || 'Unknown File'}`}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Certainty</div>
                        <div className="text-base font-black font-mono text-emerald-400">
                          {inspectionResult.matched
                            ? `${(inspectionResult.confidence_score * 100).toFixed(0)}% Match`
                            : '0% Trace'}
                        </div>
                      </div>
                    </div>

                    {inspectionResult.matched ? (
                      <div className="pt-3.5 space-y-3.5 min-w-0">
                        {/* Vector Banner */}
                        {inspectionResult.leaker_identified && (
                          <div
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 min-w-0 ${
                              inspectionResult.access_type === 'BROWSER_VIEW'
                                ? 'bg-rose-500/10 border-rose-500/30'
                                : inspectionResult.access_type === 'DIRECT_DOWNLOAD'
                                ? 'bg-blue-500/10 border-blue-500/30'
                                : 'bg-emerald-500/10 border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  inspectionResult.access_type === 'BROWSER_VIEW'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}
                              >
                                {inspectionResult.access_type === 'BROWSER_VIEW' ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                                  <span>Vector:</span>
                                  <span className="font-mono uppercase font-black">
                                    {inspectionResult.access_type_label || inspectionResult.access_type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 break-words">
                                  {inspectionResult.access_type === 'BROWSER_VIEW' ? (
                                    <>Suspect opened/previewed this file in browser, then exfiltrated it via right-click save, screen capture, or browser extension.</>
                                  ) : (
                                    <>Suspect downloaded the file directly from EleDrive interface or public link.</>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Leaker Profile Grid - Fully responsive */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 min-w-0">
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                              Identified Leaker
                            </span>
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                                style={{
                                  backgroundColor: inspectionResult.avatar_color || '#3b82f6',
                                }}
                              >
                                {(inspectionResult.leaker_name || inspectionResult.leaker_username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-100 truncate">
                                  {inspectionResult.leaker_name || 'Identified User'}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  @{inspectionResult.leaker_username || 'user'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                              User Email
                            </span>
                            <div className="text-xs font-semibold text-slate-200 truncate" title={inspectionResult.leaker_email}>
                              {inspectionResult.leaker_email || 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                              ID: {inspectionResult.leaker_id ? inspectionResult.leaker_id.slice(0, 8) + '...' : 'N/A'}
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                              Timestamp
                            </span>
                            <div className="text-xs font-mono font-bold text-slate-200 truncate">
                              {inspectionResult.accessed_at || inspectionResult.download_timestamp
                                ? formatDate(inspectionResult.accessed_at || inspectionResult.download_timestamp)
                                : 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                              Exact Stamped Time
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                              Source IP
                            </span>
                            <div className="text-xs font-mono font-bold text-slate-200 truncate">
                              {inspectionResult.client_ip || inspectionResult.leaker_ip || '127.0.0.1'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate" title={inspectionResult.user_agent}>
                              {inspectionResult.user_agent || 'Browser Session'}
                            </div>
                          </div>
                        </div>

                        {/* Evidence Hashes */}
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 min-w-0">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-400" /> Cryptographic Ledger
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Technique: {inspectionResult.detection_technique || 'STEGANOGRAPHIC_TRAILER'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono min-w-0">
                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 min-w-0">
                              <span className="text-slate-500 shrink-0">UUID:</span>
                              <span className="text-emerald-400 font-semibold truncate min-w-0">
                                {inspectionResult.secret_uuid || 'N/A'}
                              </span>
                              {inspectionResult.secret_uuid && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyUUID(inspectionResult.secret_uuid)}
                                  className="p-1 text-slate-400 hover:text-slate-200 shrink-0"
                                  title="Copy UUID"
                                >
                                  {copiedUUID === inspectionResult.secret_uuid ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 min-w-0">
                              <span className="text-slate-500 shrink-0">SHA-256:</span>
                              <span className="text-slate-300 font-semibold truncate min-w-0">
                                {inspectionResult.original_sha256 || 'N/A'}
                              </span>
                              {inspectionResult.original_sha256 && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyUUID(inspectionResult.original_sha256)}
                                  className="p-1 text-slate-400 hover:text-slate-200 shrink-0"
                                  title="Copy Hash"
                                >
                                  {copiedUUID === inspectionResult.original_sha256 ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 text-xs text-slate-400">
                        This file does not contain any known EleDrive watermark atoms or signatures.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 2: TRACKED FILES LEDGER */}
          {/* ===================================================================== */}
          {activeTab === 'files' && (
            <div className="sm:p-6 sm:rounded-3xl sm:bg-slate-900 sm:border sm:border-slate-800 space-y-4 min-w-0">
              <div className="flex items-center justify-between min-w-0 px-1 sm:px-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                    Protected & Watermarked Assets
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  Live Engine Active
                </span>
              </div>

              {!securityStats?.recent_tracked_files || securityStats.recent_tracked_files.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <FileText className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs">No watermarked files recorded yet.</p>
                  <p className="text-[10px] text-slate-600">
                    Uploaded files automatically receive steganographic tracking atoms.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto min-w-0">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th className="pb-3 font-semibold">File Name</th>
                          <th className="pb-3 font-semibold">Secret UUID</th>
                          <th className="pb-3 font-semibold">Size</th>
                          <th className="pb-3 font-semibold">Uploaded</th>
                          <th className="pb-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {securityStats.recent_tracked_files.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="py-3 pr-3 font-medium text-slate-200 flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="truncate max-w-[200px]" title={f.name}>{f.name}</span>
                            </td>
                            <td className="py-3 font-mono text-[11px] text-emerald-400/90">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[140px]">{f.secret_uuid}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyUUID(f.secret_uuid)}
                                  className="text-slate-500 hover:text-slate-300 shrink-0 p-0.5"
                                  title="Copy UUID"
                                >
                                  {copiedUUID === f.secret_uuid ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 text-[11px] text-slate-400 whitespace-nowrap">{formatBytes(f.size)}</td>
                            <td className="py-3 text-[11px] text-slate-400 whitespace-nowrap">{formatDate(f.created_at)}</td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectQuery(f.secret_uuid);
                                  setInspectFile(null);
                                  setActiveTab('scanner');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition-colors"
                              >
                                Scan
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards List */}
                  <div className="md:hidden space-y-2.5 min-w-0">
                    {securityStats.recent_tracked_files.map((f) => (
                      <div key={f.id} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-200 truncate">{f.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(f.size)}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-[11px] font-mono min-w-0">
                          <span className="text-emerald-400/90 truncate min-w-0 flex-1">{f.secret_uuid}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyUUID(f.secret_uuid)}
                            className="text-slate-400 hover:text-slate-200 shrink-0 p-1"
                            title="Copy UUID"
                          >
                            {copiedUUID === f.secret_uuid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                          <span>{formatDate(f.created_at)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectQuery(f.secret_uuid);
                              setInspectFile(null);
                              setActiveTab('scanner');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                          >
                            Load in Scanner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ===================================================================== */}
      {/* FLOATING WINDOW: FORENSIC ACCESS MANAGER */}
      {/* ===================================================================== */}
      {isOwner && isAccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
          {/* Backdrop Click Dismiss */}
          <div
            className="fixed inset-0"
            onClick={() => setIsAccessModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl border border-amber-500/30 shadow-2xl shadow-black/90 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-slate-100 z-10">
            {/* Ambient Top Amber Glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800/90 flex items-center justify-between gap-3 shrink-0 bg-slate-950/40 relative z-10">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10">
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                      Forensic Access Manager
                    </h2>
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase">
                      Owner Console
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                    Configure global scanning policies and manage granular team member grants
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAccessModalOpen(false)}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0 relative z-10">
              {/* Global Access Policy Card */}
              <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/70 border border-amber-500/25 shadow-lg space-y-3.5 min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                        Global Tool Access Policy
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Define which platform roles are authorized to run forensic scans.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <select
                      value={currentPolicy}
                      onChange={(e) => handlePolicyChange(e.target.value)}
                      disabled={savingPolicy}
                      className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-amber-500/40 text-amber-200 font-semibold text-xs rounded-xl focus:border-amber-400 focus:outline-none cursor-pointer"
                    >
                      <option value="owner_only">Owner Only (Strict)</option>
                      <option value="admins">Owner & Administrators</option>
                      <option value="all_users">All Workspace Members</option>
                      <option value="custom">Granular Grants Only</option>
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Current enforcement: <strong className="text-amber-300 uppercase font-mono">{currentPolicy.replace('_', ' ')}</strong>. Individual grants below can override this policy for specific team members.
                  </span>
                </div>
              </div>

              {/* Grant Form + Active Grants Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 min-w-0">
                {/* Authorize Specific User Form */}
                <div className="lg:col-span-1 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/70 border border-slate-800/90 shadow-lg space-y-3.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 min-w-0">
                    <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Grant User Access</span>
                  </div>

                  <form onSubmit={handleCreateGrant} className="space-y-3 min-w-0">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Select Member:
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Choose team member --</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} (@{u.username}) - {u.role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Access Duration:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: '1h', label: '1 Hour' },
                          { id: '24h', label: '24 Hours' },
                          { id: '7d', label: '7 Days' },
                          { id: '30d', label: '30 Days' },
                          { id: 'custom', label: 'Custom' },
                          { id: 'forever', label: 'Forever' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setGrantDuration(item.id)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              grantDuration === item.id
                                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      {grantDuration === 'custom' && (
                        <div className="mt-2 min-w-0">
                          <label className="text-[10px] text-slate-400 block mb-1">Expire on date/time:</label>
                          <input
                            type="datetime-local"
                            value={customDateTime}
                            onChange={(e) => setCustomDateTime(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Audit Note (Optional):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Authorized for forensic security audit"
                        value={grantNote}
                        onChange={(e) => setGrantNote(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingGrant || !selectedUserId}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submittingGrant ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Key className="w-3.5 h-3.5" />
                      )}
                      <span>Authorize Access</span>
                    </button>
                  </form>
                </div>

                {/* Active Grants List */}
                <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/70 border border-slate-800/90 shadow-lg flex flex-col justify-between space-y-4 min-w-0">
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200 truncate">Active User Grants</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                        {grants.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={loadGrants}
                      disabled={loadingGrants}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingGrants ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {grants.length === 0 ? (
                      <div className="py-10 flex flex-col items-center justify-center text-center text-slate-500 min-w-0">
                        <Users className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-xs font-medium">No individual user grants active.</p>
                        <p className="text-[10px] text-slate-600 mt-0.5 max-w-xs">
                          {currentPolicy === 'owner_only'
                            ? 'Only you (Workspace Owner) have access.'
                            : currentPolicy === 'admins'
                            ? 'All administrators currently have access via global policy.'
                            : currentPolicy === 'all_users'
                            ? 'All members have access via global policy.'
                            : 'Use the form to authorize individual users.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Grants Table */}
                        <div className="hidden sm:block overflow-x-auto min-w-0">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                                <th className="pb-2.5 font-semibold">User</th>
                                <th className="pb-2.5 font-semibold">Granted By</th>
                                <th className="pb-2.5 font-semibold">Expiration</th>
                                <th className="pb-2.5 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {grants.map((g) => (
                                <tr key={g.id} className="hover:bg-slate-900/50">
                                  <td className="py-2.5 pr-2 min-w-0">
                                    <div className="font-semibold text-slate-200 truncate">{g.user_name}</div>
                                    <div className="text-[10px] text-slate-500 truncate">@{g.user_username} • {g.user_email}</div>
                                  </td>
                                  <td className="py-2.5 text-slate-400 text-[11px] whitespace-nowrap">
                                    @{g.granted_by_name || g.granted_by_username || 'Owner'}
                                  </td>
                                  <td className="py-2.5 text-[11px] whitespace-nowrap">
                                    {g.expires_at ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-[10px]">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(g.expires_at)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[10px]">
                                        <Check className="w-3 h-3" />
                                        Permanent
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeGrant(g.id, g.user_name)}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                      title="Revoke Access"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Grants Cards */}
                        <div className="sm:hidden space-y-2 min-w-0 max-h-64 overflow-y-auto">
                          {grants.map((g) => (
                            <div key={g.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 min-w-0">
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{g.user_name}</div>
                                  <div className="text-[10px] text-slate-500 truncate">@{g.user_username}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeGrant(g.id, g.user_name)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 shrink-0"
                                  title="Revoke Access"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                                <span>Granted by @{g.granted_by_name || g.granted_by_username || 'Owner'}</span>
                                {g.expires_at ? (
                                  <span className="text-blue-400 font-mono">{formatDate(g.expires_at)}</span>
                                ) : (
                                  <span className="text-emerald-400 font-semibold">Permanent</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0 relative z-10">
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="truncate">Policy: <strong className="text-amber-300 uppercase font-mono">{currentPolicy.replace('_', ' ')}</strong></span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">{grants.length} active grant{grants.length === 1 ? '' : 's'}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loadGrants();
                    loadUsersList();
                  }}
                  disabled={loadingGrants}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/60 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingGrants ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccessModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
