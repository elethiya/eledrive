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
  Clock,
  Shield,
} from 'lucide-react';
import { shareAPI, publicShareAPI, authAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function ShareModal({ isOpen, onClose, item, itemType = 'folder' }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('team'); // 'team' | 'link'

  // Team Share state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [memberPermission, setMemberPermission] = useState('editor');
  const [sharedList, setSharedList] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);

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
    }
  }, [isOpen, item]);

  // Search users with debounce
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
      const res = await shareAPI.getTargetShares(itemType, item.id);
      if (res.data) setSharedList(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPublicLink = async () => {
    try {
      const res = await publicShareAPI.getTargetLink(itemType, item.id);
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

  // Add team member share
  const handleAddMember = async () => {
    if (!selectedUser) return;
    setTeamLoading(true);
    try {
      await shareAPI.createShare({
        target_type: itemType,
        target_id: item.id,
        user_id: selectedUser.id,
        permission: memberPermission,
      });
      setSelectedUser(null);
      setSearchQuery('');
      await loadTeamShares();
    } catch (err) {
      alert(err.message);
    } finally {
      setTeamLoading(false);
    }
  };

  // Remove team member share
  const handleRemoveShare = async (shareId) => {
    try {
      await shareAPI.deleteShare(shareId);
      await loadTeamShares();
    } catch (err) {
      alert(err.message);
    }
  };

  // Create public link
  const handleCreateLink = async () => {
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
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  // Delete public link
  const handleDeleteLink = async () => {
    if (!linkInfo?.link?.id) return;
    setLinkLoading(true);
    try {
      await publicShareAPI.deleteLink(linkInfo.link.id);
      setLinkInfo(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (linkInfo?.url) {
      navigator.clipboard.writeText(linkInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Share</h3>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {itemType}
                </span>
              </div>
              <p className="text-xs text-slate-600 truncate max-w-[260px]">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-600 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 mt-3">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Members</span>
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Public Share Link</span>
          </button>
        </div>

        {/* Tab 1: Team Members */}
        {activeTab === 'team' && (
          <div className="mt-4 space-y-4">
            {/* Search & Add Member */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Add Team Member
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by name or email (e.g. alex@eledrive.local)"
                    value={selectedUser ? `${selectedUser.name} (${selectedUser.email})` : searchQuery}
                    onChange={(e) => {
                      setSelectedUser(null);
                      setSearchQuery(e.target.value);
                    }}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                  />
                  {selectedUser && (
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={memberPermission}
                  onChange={(e) => setMemberPermission(e.target.value)}
                  className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700"
                >
                  <option value="editor">Can Edit & Upload</option>
                  <option value="viewer">Can View Only</option>
                </select>

                <button
                  disabled={!selectedUser || teamLoading}
                  onClick={handleAddMember}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                >
                  {teamLoading ? '...' : 'Add'}
                </button>
              </div>

              {/* Search Suggestions Dropdown */}
              {!selectedUser && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-16 bg-white border border-slate-100 rounded-xl shadow-xl z-20 p-1">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setSearchResults([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 rounded-lg text-left transition-colors"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-slate-800 block">{u.name}</span>
                        <span className="text-[10px] text-slate-600 block">{u.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* List of People with Access */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-2">
                People with access
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {/* Owner */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: user?.avatar_color || '#3b82f6' }}
                    >
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        {user?.name} (You)
                      </span>
                      <span className="text-[10px] text-slate-600 block">{user?.email}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 px-2 py-1 bg-slate-200/60 rounded-lg">
                    Owner
                  </span>
                </div>

                {/* Collaborators */}
                {sharedList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: s.shared_with?.avatar_color || '#10b981' }}
                      >
                        {s.shared_with?.name?.charAt(0) || 'M'}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-slate-800 block truncate">
                          {s.shared_with?.name}
                        </span>
                        <span className="text-[10px] text-slate-600 block truncate">
                          {s.shared_with?.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
                          s.permission === 'editor'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.permission === 'editor' ? 'Can Edit' : 'Viewer'}
                      </span>
                      <button
                        onClick={() => handleRemoveShare(s.id)}
                        className="p-1 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
        )}

        {/* Tab 2: Public Share Link */}
        {activeTab === 'link' && (
          <div className="mt-4 space-y-4">
            {linkInfo ? (
              <div className="space-y-3.5 bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-900">Share Link is Active</span>
                  </div>
                  <button
                    onClick={handleDeleteLink}
                    disabled={linkLoading}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Disable Link
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={linkInfo.url}
                    className="flex-1 text-xs px-3 py-2 bg-white border border-blue-200 rounded-xl text-slate-700 select-all outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-600 flex flex-wrap gap-3 pt-1">
                  <span className="flex items-center gap-1">
                    {linkInfo.link?.permission === 'upload_and_view' ? (
                      <>
                        <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                        <span>Anyone can view and <b>upload files</b></span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View & download only</span>
                      </>
                    )}
                  </span>
                  {linkInfo.link?.has_password && (
                    <span className="flex items-center gap-1 text-amber-700">
                      <Lock className="w-3 h-3" /> Password protected
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Generate a shareable link that anyone with the URL can access.
                  {itemType === 'folder' && ' You can allow collaborators to upload files into this folder.'}
                </p>

                {/* Permission select */}
                {itemType === 'folder' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Link Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLinkPermission('upload_and_view')}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          linkPermission === 'upload_and_view'
                            ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                          <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                          <span>Allow Uploads</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-normal">
                          Teammates can view, download & upload files directly
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLinkPermission('view')}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          linkPermission === 'view'
                            ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>View & Download</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-normal">
                          Read-only access to files and ZIP download
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Optional password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Optional Password Protection
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder="Leave blank for public link"
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Link Expiration
                  </label>
                  <select
                    value={linkExpireDays}
                    onChange={(e) => setLinkExpireDays(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700"
                  >
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={0}>Never expires</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateLink}
                  disabled={linkLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
                >
                  {linkLoading ? 'Creating...' : 'Create Share Link'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end pt-4 mt-5 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
