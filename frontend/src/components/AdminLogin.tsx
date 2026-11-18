import React, { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8080/api/v1/admin';

interface AdminLoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both Admin username and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await axios.post(`${API_BASE}/login`, {
        username: username.trim(),
        password: password.trim(),
      });

      if (res.data.authenticated) {
        onLoginSuccess(res.data.token, res.data.username);
      } else {
        throw new Error(res.data.message || 'Invalid credentials.');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || 'Login failed. Invalid username or password.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="glass-card rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6 glow-indigo">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Admin Portal Authentication</h2>
            <p className="text-xs text-slate-400">Enter secure admin credentials to access election controls</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                required
              />
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>Default Admin Login:</span>
            <span className="text-indigo-300 font-bold">admin / admin123</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 text-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Login to Admin Portal</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
