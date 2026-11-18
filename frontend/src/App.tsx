import React, { useState } from 'react';
import { VoterPortal } from './components/VoterPortal';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { ShieldCheck, Vote, Lock, Cpu, Database, Server, UserCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'voter' | 'admin'>('voter');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);

  const handleAdminLoginSuccess = (token: string, username: string) => {
    setAdminToken(token);
    setAdminUsername(username);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setAdminUsername(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header & Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Branding Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-white tracking-tight">Biometric Voting System</h1>
                  <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Multi-Factor Biometrics
                  </span>
                </div>
                <p className="text-xs text-slate-400">InsightFace (buffalo_s) + Spring Boot Core Backend + MongoDB</p>
              </div>
            </div>

            {/* Main Navigation Tabs */}
            <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveTab('voter')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'voter'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Vote className="w-4 h-4" />
                <span>Voter Portal</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Admin Portal</span>
                {adminToken && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeTab === 'voter' && <VoterPortal />}
        {activeTab === 'admin' && (
          adminToken && adminUsername ? (
            <AdminDashboard adminUsername={adminUsername} onLogout={handleAdminLogout} />
          ) : (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          )
        )}
      </main>

      {/* Footer System Badges */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>AI Sidecar: <strong>FastAPI (InsightFace buffalo_s)</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <span>Core API: <strong>Java 21 Spring Boot 3.3</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Database: <strong>MongoDB</strong></span>
            </div>
          </div>

          <div className="text-slate-500 font-mono text-[11px]">
            Facial Threshold: <span className="text-indigo-400 font-bold">≥ 0.45 (45%)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
