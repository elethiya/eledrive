import React, { useState } from 'react';
import { HardDrive, ArrowRight, Lock, Mail, User, AtSign, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage({ onNavigateLogin }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingSuccess, setPendingSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await register(name, username, email, password);
      if (res && res.status === 'pending') {
        setPendingSuccess(res.message || 'Account created successfully! An administrator must manually verify and approve your account before you can sign in.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-slate-900 rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-800 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              EleDrive
            </h1>
            <p className="text-xs text-slate-400">Join Team Drive</p>
          </div>
        </div>

        {pendingSuccess ? (
          <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Clock className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-slate-100 mb-2">
              Registration Under Review
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Your account for <strong className="text-amber-300">@{username}</strong> ({email}) was created successfully.
            </p>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 text-left mb-6 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Manual Admin Verification</span>
              </div>
              <p className="text-[11px] text-slate-400">
                To protect team workspaces and data, an administrator must manually verify and approve your account before you can sign in.
              </p>
            </div>

            <button
              onClick={onNavigateLogin}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/25 transition-all"
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-100 mb-1">Create an account</h2>
            <p className="text-xs text-slate-400 mb-6">
              Get 10 GB free team cloud storage to collaborate and share files.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-2xl text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. David Kim"
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. davidkim"
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="david@company.com"
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
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
                placeholder="At least 6 characters"
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-blue-500 text-slate-100 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all mt-2"
          >
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <button
            onClick={onNavigateLogin}
            className="text-blue-400 font-bold hover:underline"
          >
            Sign In
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
