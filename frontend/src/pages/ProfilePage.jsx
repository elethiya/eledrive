import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  KeyRound,
  HardDrive,
  Save,
  CheckCircle,
  AlertCircle,
  Calendar,
  Mail,
  AtSign,
  Palette,
  Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { profileAPI, statsAPI } from '../api/client';
import { formatBytes, formatDate } from '../utils/formatters';

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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#3b82f6');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Owner Self Storage Limit state
  const [selfLimitGB, setSelfLimitGB] = useState(
    Math.round((user?.storage_limit || 10737418240) / (1024 * 1024 * 1024))
  );
  const [savingSelfLimit, setSavingSelfLimit] = useState(false);

  // Storage stats
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarColor(user.avatar_color || '#3b82f6');
      setSelfLimitGB(Math.round((user.storage_limit || 10737418240) / (1024 * 1024 * 1024)));
    }
    loadStats();
  }, [user]);

  const handleUpdateSelfStorage = async (e) => {
    e.preventDefault();
    const gb = parseInt(selfLimitGB);
    if (!gb || gb <= 0) {
      toast.error('Please enter a valid storage quota in GB');
      return;
    }
    setSavingSelfLimit(true);
    try {
      await profileAPI.updateSelfStorageLimit(gb);
      toast.success(`Owner storage limit updated to ${gb} GB!`);
      if (refreshUser) refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update storage limit');
    } finally {
      setSavingSelfLimit(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await statsAPI.getStats();
      if (res.data) setStats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    if (!name.trim()) {
      setProfileError('Display name is required');
      return;
    }

    setProfileSaving(true);
    try {
      await profileAPI.updateProfile({ name: name.trim(), avatar_color: avatarColor });
      setProfileSuccess('Profile updated successfully!');
      await refreshUser();
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      await profileAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const used = user?.storage_used || 0;
  const limit = user?.storage_limit || 10 * 1024 * 1024 * 1024;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-3.5 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
        {/* Profile Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 shadow-xl">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-2xl ring-4 ring-slate-800/80 shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <h1 className="text-xl md:text-2xl font-bold text-slate-100">{user?.name}</h1>
              <span className={`self-center sm:self-auto px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                user?.role === 'owner'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : user?.role === 'admin'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}>
                {user?.role === 'owner' ? 'Workspace Owner' : user?.role === 'admin' ? 'Administrator' : 'Team Member'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">{user?.email}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-slate-500" />
                <span>@{user?.username}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Joined {formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Form 1: Profile Settings */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Personal Information</h3>
                <p className="text-[11px] text-slate-400">Update your identity and avatar style</p>
              </div>
            </div>

            {profileSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" />
                  <span>Avatar Accent Color</span>
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        avatarColor === c
                          ? 'scale-125 ring-2 ring-offset-2 ring-offset-slate-900 ring-blue-500'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.username || ''}
                    className="w-full text-xs px-3 py-2 bg-slate-950/60 border border-slate-800 text-slate-500 rounded-xl cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.email || ''}
                    className="w-full text-xs px-3 py-2 bg-slate-950/60 border border-slate-800 text-slate-500 rounded-xl cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Form 2: Password Security */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Security & Password</h3>
                <p className="text-[11px] text-slate-400">Change your login authentication password</p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                  <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Section 3: Storage Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Personal Storage Breakdown</h3>
                <p className="text-[11px] text-slate-400">
                  {formatBytes(used)} of {formatBytes(limit)} used ({percent}%)
                </p>
              </div>
            </div>
            {user?.role === 'owner' && (
              <span className="self-start sm:self-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-amber-400" />
                Owner Storage Controls Active
              </span>
            )}
          </div>

          {/* Owner Self Storage Limit Controller */}
          {user?.role === 'owner' && (
            <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl shadow-inner">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    Change Self Storage Limit
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    As Workspace Owner, you have exclusive authority to adjust your personal storage quota.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[10, 25, 50, 100, 250].map((gb) => (
                      <button
                        key={gb}
                        type="button"
                        onClick={() => setSelfLimitGB(gb.toString())}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          parseInt(selfLimitGB) === gb
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {gb} GB
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleUpdateSelfStorage} className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={selfLimitGB}
                        onChange={(e) => setSelfLimitGB(e.target.value)}
                        className="w-full sm:w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-semibold focus:outline-hidden focus:border-amber-400 pr-8"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-bold pointer-events-none">GB</span>
                    </div>
                    <button
                      type="submit"
                      disabled={savingSelfLimit}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingSelfLimit ? 'Saving...' : 'Update'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percent > 90 ? 'bg-red-500 shadow-md shadow-red-500/50' : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-md shadow-blue-500/50'
                }`}
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>

            {stats?.type_stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                {Object.entries(stats.type_stats).map(([cat, sz]) => (
                  <div key={cat} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {cat}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                      {formatBytes(sz)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
