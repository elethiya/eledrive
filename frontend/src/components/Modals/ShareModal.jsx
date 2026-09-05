import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  Trash2,
  Lock,
  UploadCloud,
  Eye,
  Shield,
} from 'lucide-react';
import { shareAPI, publicShareAPI, authAPI, teamAPI, systemAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function ShareModal({ isOpen, onClose, item, itemType = 'folder' }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('team');

  // Sharing System Policy state
  const [sharingPolicy, setSharingPolicy] = useState({
    allow_public_shares: true,
    require_link_passwords: false,
    default_link_expiry_days: 30,
  });

  // Team Share state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [memberPermission, setMemberPermission] = useState('editor');
  const [sharedList, setSharedList] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [availableTeammates, setAvailableTeammates] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);

  // Link Share state
  const [linkInfo, setLinkInfo] = useState(null);
  const [linkPermission, setLinkPermission] = useState(itemType === 'folder' ? 'upload_and_view' : 'view');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkExpireDays, setLinkExpireDays] = useState(30);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      loadTeamShares();
      loadPublicLink();
      systemAPI.getStatus().then((res) => {
        const data = res?.data !== undefined ? res.data : res;
        if (data) {
          setSharingPolicy({
            allow_public_shares: data.allow_public_shares !== false,
            require_link_passwords: Boolean(data.require_link_passwords),
            default_link_expiry_days: data.default_link_expiry_days !== undefined ? data.default_link_expiry_days : 30,
          });
          if (data.default_link_expiry_days !== undefined) {
            setLinkExpireDays(data.default_link_expiry_days);
          }
        }
      }).catch(console.error);
      teamAPI.getAvailableUsers().then((res) => {
        if (res.data) setAvailableTeammates(res.data);
      }).catch(console.error);
      teamAPI.listTeams().then((res) => {
        if (res.data) setAvailableTeams(res.data);
      }).catch(console.error);
    }
  }, [isOpen, item]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      authAPI.searchUsers(searchQuery).then((res) => {
        if (res.data) setSearchResults(res.data);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadTeamShares = async () => {
    try {
      const res = await shareAPI.getTargetShares(itemType, item.id || 'root');
      if (res.data) {
        setSharedList(Array.isArray(res.data) ? res.data : []);
      } else {
        setSharedList([]);
      }
    } catch (e) {
      console.error(e);
      setSharedList([]);
    }
  };

  const loadPublicLink = async () => {
    try {
      const res = await publicShareAPI.getTargetLink(itemType, item.id || 'root');
      if (res.data && res.data.link) {
        setLinkInfo(res.data);
        setLinkPermission(res.data.link.permission);
      } else {
        setLinkInfo(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen || !item) return null;

  const handleAddMember = async () => {
    if (!selectedUser) return;
    setTeamLoading(true);
    try {
      await shareAPI.createShare({
        target_type: itemType,
        target_id: item.id || 'root',
        user_id: selectedUser.id,
        permission: memberPermission,
      });
      setSelectedUser(null);
      setSearchQuery('');
      await loadTeamShares();
      window.dispatchEvent(new CustomEvent('eledrive:refresh_content'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleShareWithTeam = async (t) => {
    const itemName = itemType === 'drive' ? 'Entire Drive' : (item?.name || 'this item');
    const permLabel = memberPermission === 'editor' ? 'Can Edit & Upload' : 'Can View Only';

    const ok = await confirm({
      title: 'Share Content with Team',
      message: `Are you sure you want to share ${itemType === 'drive' ? 'your' : ''} ${itemName} with team "${t.name}"?`,
      confirmText: `Share with ${t.name}`,
      cancelText: 'Cancel',
      variant: 'info',
      icon: <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />,
      itemHighlight: {
        teamName: t.name,
        membersCount: t.members_count,
        permission: permLabel,
        avatarColor: t.avatar_color,
      },
      subMessage: `All ${t.members_count} member(s) of "${t.name}" will receive "${permLabel}" permissions immediately.`,
    });
    if (!ok) return;

    setTeamLoading(true);
    try {
      await shareAPI.createShare({
        target_type: itemType,
        target_id: item.id || 'root',
        team_id: t.id,
        permission: memberPermission,
      });
      await loadTeamShares();
      window.dispatchEvent(new CustomEvent('eledrive:refresh_content'));
      toast.success(`Successfully shared ${itemType === 'drive' ? 'My Drive' : item.name} with team "${t.name}"!`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to share with team');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleRemoveShare = async (shareId, isTeam = false, targetName = '') => {
    const ok = await confirm({
      title: isTeam ? 'Revoke Team Access' : 'Revoke Share Access',
      message: isTeam
        ? `Are you sure you want to remove access for team "${targetName || 'this team'}"? All members of this team will immediately lose access.`
        : `Are you sure you want to remove access for ${targetName ? `"${targetName}"` : 'this collaborator'}? They will no longer be able to access this content.`,
      confirmText: 'Revoke Access',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await shareAPI.deleteShare(shareId);
      setSharedList((prev) => prev.filter((s) => s.id !== shareId));
      await loadTeamShares();
      window.dispatchEvent(new CustomEvent('eledrive:refresh_content'));
      toast.success(isTeam ? 'Team share access revoked' : 'Share access removed');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to remove share');
      await loadTeamShares();
    }
  };

  const handleCreateLink = async () => {
    if (!sharingPolicy.allow_public_shares) {
      toast.error('Public share links are currently disabled by platform administrator policy');
      return;
    }
    if (sharingPolicy.require_link_passwords && !linkPassword.trim()) {
      toast.error('A security passcode is required on all public links by platform policy');
      return;
    }
    setLinkLoading(true);
    try {
      const res = await publicShareAPI.createLink({
        target_type: itemType,
        target_id: item.id,
        permission: linkPermission,
        password: linkPassword.trim() || undefined,
        expire_days: linkExpireDays > 0 ? linkExpireDays : undefined,
      });
      if (res.data) {
        setLinkInfo({ link: res.data, url: res.data.url });
        window.dispatchEvent(new CustomEvent('eledrive:refresh_content'));
        toast.success('Public share link created!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to create share link');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!linkInfo?.link?.id) return;
    const ok = await confirm({
      title: 'Deactivate Share Link',
      message: 'Are you sure you want to disable this public share link? Anyone with this URL will immediately lose access.',
      confirmText: 'Deactivate Link',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    setLinkLoading(true);
    try {
      await publicShareAPI.deleteLink(linkInfo.link.id);
      setLinkInfo(null);
      window.dispatchEvent(new CustomEvent('eledrive:refresh_content'));
      toast.success('Public share link deactivated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (linkInfo?.url) {
      navigator.clipboard.writeText(linkInfo.url);
      setCopied(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl shadow-black/80 border border-slate-800 p-5 sm:p-6 animate-in zoom-in-95 duration-150 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/10">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  {itemType === 'drive' ? 'Share My Entire Drive' : 'Share'}
                </h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {itemType === 'drive' ? 'Full Drive' : itemType}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-[260px]">
                {itemType === 'drive' ? 'Collaborate on all files & projects with team' : item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mt-3 text-xs">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 font-semibold border-b-2 transition-all ${
              activeTab === 'team'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Members</span>
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 font-semibold border-b-2 transition-all ${
              activeTab === 'link'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Public Share Link</span>
          </button>
        </div>

        {/* Tab 1: Team Members */}
        {activeTab === 'team' && (
          <div className="mt-4 space-y-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Add Team Member
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by username, name or email..."
                    value={selectedUser ? `${selectedUser.name} (@${selectedUser.username})` : searchQuery}
                    onChange={(e) => {
                      setSelectedUser(null);
                      setSearchQuery(e.target.value);
                    }}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:border-blue-500 outline-none"
                  />
                  {selectedUser && (
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={memberPermission}
                  onChange={(e) => setMemberPermission(e.target.value)}
                  className="text-xs px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl outline-none text-slate-200"
                >
                  <option value="editor">Can Edit & Upload</option>
                  <option value="viewer">Can View Only</option>
                </select>

                <button
                  disabled={!selectedUser || teamLoading}
                  onClick={handleAddMember}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                >
                  {teamLoading ? '...' : 'Add'}
                </button>
              </div>

              {/* Suggestions dropdown */}
              {!selectedUser && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-16 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 p-1">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setSearchResults([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 rounded-lg text-left transition-colors"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-slate-100 block">{u.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          @{u.username} • {u.email}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Share with Teams */}
              {availableTeams.length > 0 && !selectedUser && (
                <div className="pt-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Share with Entire Team:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleShareWithTeam(t)}
                        disabled={teamLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: t.avatar_color || '#3b82f6' }}
                        />
                        <span>{t.name}</span>
                        <span className="text-[10px] text-slate-500">({t.members_count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Teammates Suggestions */}
              {!searchQuery && !selectedUser && availableTeammates.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Workspace Teammates:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {availableTeammates.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors group text-left"
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: u.avatar_color || '#3b82f6' }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-200 leading-tight truncate">{u.name}</span>
                          <span className="block text-[9px] text-slate-400 font-mono leading-tight truncate">@{u.username}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Teams with Access Section */}
              {sharedList.some((s) => s.is_team) && (
                <div>
                  <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Teams with access</span>
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {sharedList.filter((s) => s.is_team).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs"
                            style={{ backgroundColor: s.team?.avatar_color || '#6366f1' }}
                          >
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-100 truncate">
                                {s.team?.name || 'Team'}
                              </span>
                              <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/25 border border-indigo-400/40 px-1.5 py-0.2 rounded shrink-0">
                                Team
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate font-mono">
                              {s.team?.members_count || 0} member(s)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              s.permission === 'editor'
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {s.permission === 'editor' ? 'Can Edit' : 'Viewer'}
                          </span>
                          <button
                            onClick={() => handleRemoveShare(s.id, true, s.team?.name)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Revoke team access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* People with access Section */}
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  People with access
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {/* Owner */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
                      >
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">
                          {user?.name} (You)
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {user?.username ? `@${user.username} • ${user.email}` : user?.email}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-md">
                      Owner
                    </span>
                  </div>

                  {/* Direct Shared Users */}
                  {sharedList.filter((s) => !s.is_team).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate mr-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: s.shared_with?.avatar_color || '#10b981' }}
                        >
                          {s.shared_with?.name?.charAt(0) || 'M'}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-semibold text-slate-200 block truncate">
                            {s.shared_with?.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate font-mono">
                            {s.shared_with?.username ? `@${s.shared_with?.username} • ${s.shared_with?.email}` : s.shared_with?.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            s.permission === 'editor'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {s.permission === 'editor' ? 'Can Edit' : 'Viewer'}
                        </span>
                        <button
                          onClick={() => handleRemoveShare(s.id, false, s.shared_with?.name)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Remove access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Public Share Link */}
        {activeTab === 'link' && (
          <div className="mt-4 space-y-4 text-xs">
            {linkInfo ? (
              <div className="space-y-3.5 bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-slate-200">Share Link is Active</span>
                  </div>
                  <button
                    onClick={handleDeleteLink}
                    disabled={linkLoading}
                    className="font-medium text-rose-400 hover:underline"
                  >
                    Disable Link
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={linkInfo.url}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 select-all outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-xs transition-all shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 flex flex-wrap gap-3 pt-1">
                  <span className="flex items-center gap-1">
                    {linkInfo.link?.permission === 'upload_and_view' ? (
                      <>
                        <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                        <span>Anyone can view & <b>upload files</b></span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View & download only</span>
                      </>
                    )}
                  </span>
                  {linkInfo.link?.has_password && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Lock className="w-3 h-3" /> Password protected
                    </span>
                  )}
                </div>
              </div>
            ) : !sharingPolicy.allow_public_shares ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <Lock className="w-4 h-4" />
                    <span>Public Share Links Disabled</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    External public share links are currently disabled by the platform administrator. You can still share files and folders directly with team members and collaborators under the "Collaborators & Teams" tab.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-400">
                  Generate a shareable link that anyone with the URL can access.
                  {itemType === 'folder' && ' You can allow collaborators to upload files into this folder.'}
                </p>

                {itemType === 'folder' && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">
                      Link Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLinkPermission('upload_and_view')}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          linkPermission === 'upload_and_view'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-300 font-semibold'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                          <span>Allow Uploads</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">
                          Teammates can view, download & upload files directly
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLinkPermission('view')}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          linkPermission === 'view'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-300 font-semibold'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>View & Download</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">
                          Read-only access to files and ZIP download
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-300">
                      {sharingPolicy.require_link_passwords ? 'Mandatory Passcode' : 'Optional Password Protection'}
                    </label>
                    {sharingPolicy.require_link_passwords && (
                      <span className="text-[10px] font-mono uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        Required by Admin
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder={sharingPolicy.require_link_passwords ? "Enter required passcode" : "Leave blank for public link"}
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 bg-slate-950 border rounded-xl text-slate-100 outline-none ${
                        sharingPolicy.require_link_passwords && !linkPassword.trim()
                          ? 'border-amber-500/50 focus:border-amber-500'
                          : 'border-slate-800 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {sharingPolicy.require_link_passwords && (
                    <p className="text-[10px] text-amber-400/90 mt-1">
                      Platform security policy requires a passcode on all external public share links.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-300">
                      Link Expiration
                    </label>
                    {sharingPolicy.default_link_expiry_days > 0 && (
                      <span className="text-[10px] font-mono text-purple-400 font-medium">
                        Default: {sharingPolicy.default_link_expiry_days} Days
                      </span>
                    )}
                  </div>
                  <select
                    value={linkExpireDays}
                    onChange={(e) => setLinkExpireDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl outline-none text-slate-200"
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={0}>Never expires</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateLink}
                  disabled={linkLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {linkLoading ? 'Creating...' : 'Create Share Link'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end pt-4 mt-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
