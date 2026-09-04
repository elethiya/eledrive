import React, { useState } from 'react';
import { HardDrive, ArrowRight, Lock, Mail, KeyRound, CheckCircle2, ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';
import RegistrationReviewScreen from '../components/RegistrationReviewScreen';

export default function LoginPage({ onNavigateRegister }) {
  const { login } = useAuth();
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPendingReview, setIsPendingReview] = useState(false);
  const [pendingIdentifier, setPendingIdentifier] = useState('');

  // Password Reset State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(emailOrUser, password);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || '';
      if (
        (err.response?.status === 403 && errMsg.toLowerCase().includes('pending')) ||
        errMsg.toLowerCase().includes('pending administrator') ||
        err.response?.data?.status === 'pending'
      ) {
        setPendingIdentifier(emailOrUser ? (emailOrUser.includes('@') ? emailOrUser : `@${emailOrUser}`) : '');
        setIsPendingReview(true);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReset = () => {
    setResetIdentifier(emailOrUser);
    setResetReason('');
    setResetError('');
    setResetSuccess(null);
    setIsResetMode(true);
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetIdentifier.trim()) {
      setResetError('Please provide your email address or username.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const res = await authAPI.requestPasswordReset({
        email_or_username: resetIdentifier.trim(),
        reason: resetReason.trim(),
      });
      setResetSuccess(
        res?.message ||
          'Password reset request submitted successfully! Workspace administrators have been notified.'
      );
    } catch (err) {
      setResetError(err.message || 'Failed to submit reset request. Please check your account identifier.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-slate-900 rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-800 relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              EleDrive
            </h1>
            <p className="text-xs text-slate-400">Team Cloud Drive & Project Workspace</p>
          </div>
        </div>

        {isPendingReview ? (
          <RegistrationReviewScreen
            identifier={pendingIdentifier}
            onReturn={() => {
              setIsPendingReview(false);
              setError('');
            }}
          />
        ) : isResetMode ? (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            {resetSuccess ? (
              <div className="py-2 animate-in fade-in zoom-in-95 duration-200">
                {/* Header with check icon box in front of title and message */}
                <div className="flex items-start gap-3.5 mb-5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 shadow-sm shadow-emerald-500/10">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 leading-tight">
                      Request Dispatched
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {resetSuccess}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left mb-6 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px] uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Administrator Review Pending</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Your workspace administrators have received your request. Once verified and reset, your administrator will supply you with your updated password.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setResetSuccess(null);
                    if (resetIdentifier) setEmailOrUser(resetIdentifier);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 leading-tight">
                      Reset Password
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Request a credential reset from your workspace administrators.
                    </p>
                  </div>
                </div>

                {resetError && (
                  <div className="mb-4 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 bg-red-950/40 border border-red-500/40 text-red-300">
                    <span>{resetError}</span>
                  </div>
                )}

                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Your Email or Username
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(e.target.value)}
                        placeholder="name@company.com or username"
                        className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Reason / Notes for Admin{' '}
                      <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={resetReason}
                      onChange={(e) => setResetReason(e.target.value)}
                      placeholder="e.g. Forgot password, lost access to device"
                      className="w-full text-xs p-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-100 outline-none resize-none"
                    />
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1" />
                    <span>
                      Reset requests are reviewed securely by workspace administrators in the Admin Console.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(false);
                        setResetError('');
                      }}
                      className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-2/3 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{resetLoading ? 'Submitting...' : 'Send Request'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-100 mb-1">Welcome back</h2>
            <p className="text-xs text-slate-400 mb-6">
              Sign in to access your projects, shared folders, and drive.
            </p>

            {error && (
              <div className="mb-4 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 bg-red-950/40 border border-red-500/40 text-red-300">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={emailOrUser}
                    onChange={(e) => setEmailOrUser(e.target.value)}
                    placeholder="name@company.com or username"
                    className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenReset}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-4 text-center text-xs text-slate-400">
              Don't have an account?{' '}
              <button
                onClick={onNavigateRegister}
                className="text-blue-400 font-bold hover:underline"
              >
                Create Team Account
              </button>
            </div>
          </>
        )}

        {/* Footer Attribution */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-500 font-medium tracking-wide">
            Developed and Powered by{' '}
            <span className="font-bold text-slate-400 tracking-wider">ELETHIYA</span>
          </p>
        </div>
      </div>
    </div>
  );
}
