import React, { useState } from 'react';
import { HardDrive, ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RegistrationReviewScreen from '../components/RegistrationReviewScreen';

export default function LoginPage({ onNavigateRegister }) {
  const { login } = useAuth();
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPendingReview, setIsPendingReview] = useState(false);
  const [pendingIdentifier, setPendingIdentifier] = useState('');

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
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
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

        <div className="mt-6 text-center text-xs text-slate-400">
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
        <div className="mt-8 pt-4 border-t border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-500 font-medium tracking-wide">
            Developed and Powered by{' '}
            <span className="font-bold text-slate-400 tracking-wider">ELETHIYA</span>
          </p>
        </div>
      </div>
    </div>
  );
}
