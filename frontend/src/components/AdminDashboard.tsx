import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { Users, Vote, PieChart, Award, Plus, Trash2, RefreshCw, ShieldCheck, CheckCircle2, XCircle, Search, Landmark, UserPlus, Fingerprint, Camera, Lock, LogOut, Layers, Calendar, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:8080/api/v1/admin';
const TOTAL_FRAMES = 15;

interface Election {
  id: string;
  electionId: string;
  title: string;
  description: string;
  startTime?: string;
  endTime?: string;
  status: string;
  active: boolean;
  createdAt: string;
}

interface Candidate {
  id: string;
  candidateId: string;
  electionId?: string;
  name: string;
  partyName: string;
  partySymbol: string;
  description: string;
  voteCount: number;
}

interface VoterAudit {
  voterId: string;
  name: string;
  hasVoted: boolean;
  votedCandidateId?: string;
  registeredAt: string;
  votedAt?: string;
}

interface AdminStats {
  totalVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  turnoutPercentageFormatted: string;
  candidates: Candidate[];
  voterAudits: VoterAudit[];
}

interface AdminDashboardProps {
  adminUsername: string;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminUsername, onLogout }) => {
  const [subTab, setSubTab] = useState<'register' | 'elections' | 'tallies' | 'audits'>('tallies');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Register Voter Form state
  const [regVoterId, setRegVoterId] = useState('');
  const [regName, setRegName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFramesCount, setCapturedFramesCount] = useState(0);
  const [regStatus, setRegStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const webcamRef = useRef<Webcam>(null);

  // Election Form state
  const [elecId, setElecId] = useState('');
  const [elecTitle, setElecTitle] = useState('');
  const [elecDesc, setElecDesc] = useState('');
  const [elecStartTime, setElecStartTime] = useState('');
  const [elecEndTime, setElecEndTime] = useState('');
  const [showAddElectionModal, setShowAddElectionModal] = useState(false);
  const [isCreatingElection, setIsCreatingElection] = useState(false);

  const openCreateElectionModal = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;

    setElecStartTime(startStr);
    setElecEndTime(endStr);
    setShowAddElectionModal(true);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Not Scheduled';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getElectionScheduleStatus = (elec: Election) => {
    const now = new Date();
    if (elec.startTime && new Date(elec.startTime) > now) {
      return { label: 'SCHEDULED (UPCOMING)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    }
    if (elec.endTime && new Date(elec.endTime) < now) {
      return { label: 'CONCLUDED (ENDED)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    }
    if (elec.active) {
      return { label: 'LIVE & ACTIVE', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    }
    return { label: 'INACTIVE', color: 'bg-slate-800 text-slate-400 border-slate-700' };
  };

  // Candidate Form state
  const [candId, setCandId] = useState('');
  const [candName, setCandName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partySymbol, setPartySymbol] = useState('');
  const [candDesc, setCandDesc] = useState('');
  const [candElectionId, setCandElectionId] = useState('');
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);

  // Election Selection Filter for Tallies
  const [selectedElectionId, setSelectedElectionId] = useState<string>('ACTIVE');

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, electionsRes] = await Promise.all([
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/elections`),
      ]);
      setStats(statsRes.data);
      setElections(electionsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Register Voter Capture handler
  const captureFrames = useCallback(async (): Promise<string[]> => {
    const frames: string[] = [];
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      setCapturedFramesCount(i);
      if (webcamRef.current) {
        const screenshot = webcamRef.current.getScreenshot();
        if (screenshot) frames.push(screenshot);
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return frames;
  }, []);

  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regVoterId.trim() || !regName.trim()) return;

    setIsCapturing(true);
    setRegStatus({ type: 'info', text: 'Capturing camera frames & extracting embeddings...' });

    try {
      const frames = await captureFrames();
      if (frames.length < 5) throw new Error('Insufficient frames captured from webcam.');

      await axios.post(`${API_BASE}/register-voter`, {
        voterId: regVoterId.trim().toUpperCase(),
        name: regName.trim(),
        frames: frames,
      });

      setRegStatus({ type: 'success', text: `Voter ${regName} (${regVoterId}) registered successfully!` });
      setRegVoterId('');
      setRegName('');
      fetchAdminData();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || 'Voter registration failed.';
      setRegStatus({ type: 'error', text: msg });
    } finally {
      setIsCapturing(false);
      setCapturedFramesCount(0);
    }
  };

  // Create Election
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elecId.trim() || !elecTitle.trim()) return;

    if (elecStartTime && elecEndTime && new Date(elecEndTime) <= new Date(elecStartTime)) {
      alert('Election End Time must be later than Start Time.');
      return;
    }

    setIsCreatingElection(true);
    try {
      await axios.post(`${API_BASE}/elections`, {
        electionId: elecId.trim().toUpperCase(),
        title: elecTitle.trim(),
        description: elecDesc.trim(),
        startTime: elecStartTime || null,
        endTime: elecEndTime || null,
      });
      setElecId('');
      setElecTitle('');
      setElecDesc('');
      setElecStartTime('');
      setElecEndTime('');
      setShowAddElectionModal(false);
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create election.');
    } finally {
      setIsCreatingElection(false);
    }
  };

  const handleActivateElection = async (electionId: string) => {
    try {
      await axios.post(`${API_BASE}/elections/${electionId}/activate`);
      fetchAdminData();
    } catch (err: any) {
      alert('Failed to set active election.');
    }
  };

  const handleDeleteElection = async (electionId: string) => {
    if (!window.confirm('Delete this election? All tallies will be cleared.')) return;
    try {
      await axios.delete(`${API_BASE}/elections/${electionId}`);
      fetchAdminData();
    } catch (err) {
      alert('Failed to delete election.');
    }
  };

  // Candidate Manager
  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candId.trim() || !candName.trim() || !partyName.trim()) return;
    setIsAddingCandidate(true);
    try {
      await axios.post(`${API_BASE}/candidates`, {
        candidateId: candId.trim().toUpperCase(),
        name: candName.trim(),
        partyName: partyName.trim(),
        partySymbol: partySymbol.trim() || '🗳️',
        description: candDesc.trim(),
        electionId: candElectionId || undefined,
      });
      setCandId('');
      setCandName('');
      setPartyName('');
      setPartySymbol('');
      setCandDesc('');
      setCandElectionId('');
      setShowAddCandidateModal(false);
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add candidate.');
    } finally {
      setIsAddingCandidate(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!window.confirm('Delete this candidate?')) return;
    try {
      await axios.delete(`${API_BASE}/candidates/${id}`);
      fetchAdminData();
    } catch (err) {
      alert('Failed to delete candidate.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <span className="text-sm font-semibold text-slate-400">Loading Protected Admin Center...</span>
      </div>
    );
  }

  const activeElection = elections.find(e => e.active);
  const effectiveElectionId = selectedElectionId === 'ACTIVE'
    ? (activeElection?.electionId || elections[0]?.electionId || 'ALL')
    : selectedElectionId;

  const currentSelectedElection = elections.find(e => e.electionId === effectiveElectionId);

  // Filter candidates specifically for the selected election (or all if effectiveElectionId is 'ALL')
  const electionCandidates = stats?.candidates ? stats.candidates.filter(c => {
    if (effectiveElectionId === 'ALL') return true;
    return c.electionId === effectiveElectionId;
  }) : [];

  const electionVotesCast = electionCandidates.reduce((acc, c) => acc + (c.voteCount || 0), 0);
  const totalVotersCount = stats?.totalVoters || 0;
  const electionTurnout = totalVotersCount > 0 ? (electionVotesCast / totalVotersCount) * 100 : 0;
  const electionTurnoutFormatted = `${electionTurnout.toFixed(1)}%`;

  const electionLeader = electionCandidates.length > 0
    ? [...electionCandidates].sort((a, b) => b.voteCount - a.voteCount)[0]
    : null;

  const filteredVoters = stats?.voterAudits?.filter(v =>
    v.voterId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8">
      {/* Admin Protected Header */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Admin Control Center</h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono">
                Authenticated: {adminUsername}
              </span>
            </div>
            <p className="text-xs text-slate-400">Active Election: <strong className="text-indigo-300">{activeElection?.title || 'None'}</strong> ({activeElection?.electionId || 'N/A'})</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdminData}
            className="p-2.5 rounded-xl border border-slate-800 glass-card text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-300 border border-rose-500/30 hover:bg-rose-950/40 transition-all flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setSubTab('tallies')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            subTab === 'tallies' ? 'bg-indigo-600 text-white' : 'glass-card text-slate-400 hover:text-white'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Election Tallies</span>
        </button>

        <button
          onClick={() => setSubTab('register')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            subTab === 'register' ? 'bg-indigo-600 text-white' : 'glass-card text-slate-400 hover:text-white'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Voters</span>
        </button>

        <button
          onClick={() => setSubTab('elections')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            subTab === 'elections' ? 'bg-indigo-600 text-white' : 'glass-card text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Manage Elections</span>
        </button>

        <button
          onClick={() => setSubTab('audits')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            subTab === 'audits' ? 'bg-indigo-600 text-white' : 'glass-card text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Voter Audits</span>
        </button>
      </div>

      {/* SUB TAB 1: ELECTION TALLIES */}
      {subTab === 'tallies' && (
        <div className="space-y-6">
          {/* Election Select Option Filter Bar */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Election Tally Filter</h3>
                  {currentSelectedElection && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      currentSelectedElection.active 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {currentSelectedElection.active ? 'ACTIVE' : currentSelectedElection.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {currentSelectedElection 
                    ? `${currentSelectedElection.title} (${currentSelectedElection.electionId})` 
                    : 'Viewing consolidated tallies across all registered elections'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <label htmlFor="election-select" className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                Select Election:
              </label>
              <select
                id="election-select"
                value={selectedElectionId}
                onChange={(e) => setSelectedElectionId(e.target.value)}
                className="glass-input px-3.5 py-2.5 rounded-xl text-xs text-white font-medium bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[260px]"
              >
                <option value="ACTIVE" className="bg-slate-900 text-white">
                  ⭐ Current Active Election {activeElection ? `(${activeElection.electionId})` : ''}
                </option>
                <option value="ALL" className="bg-slate-900 text-white">
                  🌐 All Elections (Consolidated)
                </option>
                <optgroup label="Available Elections" className="bg-slate-900 text-slate-400">
                  {elections.map((elec) => (
                    <option key={elec.electionId} value={elec.electionId} className="bg-slate-900 text-white">
                      {elec.electionId} — {elec.title} {elec.active ? '(Active)' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <span className="text-xs uppercase font-semibold text-slate-400">Total Registered Voters</span>
              <div className="text-3xl font-extrabold text-white font-mono">{totalVotersCount}</div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <span className="text-xs uppercase font-semibold text-slate-400">Votes Cast in Selected Election</span>
              <div className="text-3xl font-extrabold text-white font-mono">{electionVotesCast}</div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <span className="text-xs uppercase font-semibold text-slate-400">Turnout Rate</span>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono">{electionTurnoutFormatted}</div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <span className="text-xs uppercase font-semibold text-slate-400">Leading Candidate</span>
              <div className="text-lg font-bold text-white truncate">
                {electionLeader && electionLeader.voteCount > 0 ? `${electionLeader.partySymbol} ${electionLeader.name}` : 'No votes cast yet'}
              </div>
            </div>
          </div>

          {/* Candidates Leaderboard */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-400" />
                  <span>Candidate Leaderboard</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Tallies for: <strong className="text-indigo-300">{currentSelectedElection ? `${currentSelectedElection.title} (${currentSelectedElection.electionId})` : 'All Elections'}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setCandElectionId(effectiveElectionId !== 'ALL' ? effectiveElectionId : (activeElection?.electionId || elections[0]?.electionId || ''));
                  setShowAddCandidateModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Candidate</span>
              </button>
            </div>

            {electionCandidates.length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
                <Landmark className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Candidates for this Election</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  There are currently no candidates registered for {currentSelectedElection ? currentSelectedElection.title : 'this election'}.
                </p>
                <button
                  onClick={() => {
                    setCandElectionId(effectiveElectionId !== 'ALL' ? effectiveElectionId : (activeElection?.electionId || elections[0]?.electionId || ''));
                    setShowAddCandidateModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Candidate</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {electionCandidates.map((cand) => {
                  const percentage = Math.round((cand.voteCount / (electionVotesCast || 1)) * 100);
                  const isWinner = electionLeader?.candidateId === cand.candidateId && cand.voteCount > 0;

                  return (
                    <div key={cand.id} className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl p-2 bg-slate-950 rounded-xl border border-slate-800">{cand.partySymbol}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-base">{cand.name}</h4>
                              {isWinner && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                  🏆 LEADER
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-indigo-300 font-semibold">{cand.partyName} ({cand.candidateId})</span>
                              {cand.electionId && (
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                  {cand.electionId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-xl font-extrabold text-white font-mono">{cand.voteCount}</span>
                            <span className="text-xs text-slate-400 block font-mono">{electionVotesCast > 0 ? percentage : 0}%</span>
                          </div>
                          <button
                            onClick={() => handleDeleteCandidate(cand.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${electionVotesCast > 0 ? percentage : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB 2: REGISTER VOTERS */}
      {subTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Admin Voter Biometric Registration</h3>
                  <p className="text-xs text-slate-400">Capture Voter ID, Name & 15 camera frames</p>
                </div>
              </div>

              <form onSubmit={handleRegisterVoter} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Voter ID</label>
                    <input
                      type="text"
                      placeholder="e.g. TN123456789"
                      value={regVoterId}
                      onChange={(e) => setRegVoterId(e.target.value.toUpperCase())}
                      disabled={isCapturing}
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-white font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={isCapturing}
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 glass-card px-3 py-1 rounded-full flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-xs text-emerald-300">Live Camera</span>
                  </div>
                </div>

                {isCapturing && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300 font-semibold">
                      <span>Capturing Embeddings...</span>
                      <span className="text-indigo-400">{capturedFramesCount} / {TOTAL_FRAMES}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${(capturedFramesCount / TOTAL_FRAMES) * 100}%` }}></div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCapturing || !regVoterId.trim() || !regName.trim()}
                  className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 flex items-center justify-center gap-2 text-sm"
                >
                  {isCapturing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <span>Capture & Register Voter</span>
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            {regStatus && (
              <div className={`p-4 rounded-2xl border text-xs font-medium ${
                regStatus.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}>
                {regStatus.text}
              </div>
            )}

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
              <h4 className="font-semibold text-white text-sm">Biometric Ledger Spec</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Registers 512-dimensional InsightFace facial baseline vectors to MongoDB.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: MANAGE ELECTIONS */}
      {subTab === 'elections' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Elections Registry & Configuration
            </h3>
            <button
              onClick={openCreateElectionModal}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Election</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {elections.map((elec) => {
              const scheduleStatus = getElectionScheduleStatus(elec);
              return (
                <div
                  key={elec.electionId}
                  className={`glass-card rounded-2xl p-6 border space-y-4 relative ${
                    elec.active ? 'border-emerald-500/40 bg-emerald-950/20 glow-emerald' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-indigo-300 font-bold uppercase">{elec.electionId}</span>
                      <h4 className="text-lg font-bold text-white">{elec.title}</h4>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${
                        elec.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {elec.active ? 'ACTIVE' : 'COMPLETED'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${scheduleStatus.color}`}>
                        {scheduleStatus.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{elec.description || 'No description provided.'}</p>

                  {/* Scheduled Times Display */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs">
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Start Time</span>
                      </span>
                      <p className="text-white font-mono font-semibold text-[11px]">
                        {formatDateTime(elec.startTime)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span>End Time</span>
                      </span>
                      <p className="text-white font-mono font-semibold text-[11px]">
                        {formatDateTime(elec.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-xs">
                    {!elec.active ? (
                      <button
                        onClick={() => handleActivateElection(elec.electionId)}
                        className="text-indigo-400 hover:underline font-semibold"
                      >
                        Set as Active Election
                      </button>
                    ) : (
                      <span className="text-emerald-400 font-semibold">Current Active Election</span>
                    )}
                    <button
                      onClick={() => handleDeleteElection(elec.electionId)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB TAB 4: VOTER AUDITS */}
      {subTab === 'audits' && (
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-bold text-white">Registered Voters Audit Log</h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Voter ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full glass-input pl-9 pr-4 py-2 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Voter ID</th>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Voting Status</th>
                  <th className="p-3.5">Registered At</th>
                  <th className="p-3.5">Voted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredVoters.map((v) => (
                  <tr key={v.voterId} className="hover:bg-slate-900/50">
                    <td className="p-3.5 font-mono text-indigo-300 font-semibold">{v.voterId}</td>
                    <td className="p-3.5 font-semibold text-white">{v.name}</td>
                    <td className="p-3.5">
                      {v.hasVoted ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          VOTED ({v.votedCandidateId})
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                          NOT VOTED
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{v.registeredAt || 'N/A'}</td>
                    <td className="p-3.5 font-mono text-slate-400">{v.votedAt || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Election Modal */}
      {showAddElectionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border border-slate-700 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Election</h3>
            <form onSubmit={handleCreateElection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Election ID</label>
                <input
                  type="text"
                  placeholder="e.g. ELEC-2026-02"
                  value={elecId}
                  onChange={(e) => setElecId(e.target.value.toUpperCase())}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Election Title</label>
                <input
                  type="text"
                  placeholder="e.g. State Gubernatorial Election"
                  value={elecTitle}
                  onChange={(e) => setElecTitle(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  placeholder="Details..."
                  value={elecDesc}
                  onChange={(e) => setElecDesc(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white h-16 resize-none"
                ></textarea>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Start Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={elecStartTime}
                    onChange={(e) => setElecStartTime(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-xl text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>End Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={elecEndTime}
                    onChange={(e) => setElecEndTime(e.target.value)}
                    className="w-full glass-input px-3 py-2 rounded-xl text-xs text-white"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddElectionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingElection}
                  className="px-5 py-2 rounded-xl text-xs text-white bg-indigo-600 hover:bg-indigo-500"
                >
                  {isCreatingElection ? 'Creating...' : 'Save Election'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddCandidateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 border border-slate-700 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Add Candidate to Election</h3>
            <form onSubmit={handleAddCandidate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Assign to Election</label>
                <select
                  value={candElectionId}
                  onChange={(e) => setCandElectionId(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white bg-slate-900 border border-slate-700"
                  required
                >
                  <option value="" disabled className="bg-slate-900 text-slate-400">
                    -- Select Election --
                  </option>
                  {elections.map((elec) => (
                    <option key={elec.electionId} value={elec.electionId} className="bg-slate-900 text-white">
                      {elec.electionId} — {elec.title} {elec.active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Candidate ID</label>
                <input
                  type="text"
                  placeholder="e.g. CAND-04"
                  value={candId}
                  onChange={(e) => setCandId(e.target.value.toUpperCase())}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Candidate Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Party Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Future Vision"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g. 🚀"
                    value={partySymbol}
                    onChange={(e) => setPartySymbol(e.target.value)}
                    className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white text-center"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description / Manifesto</label>
                <textarea
                  placeholder="Bio..."
                  value={candDesc}
                  onChange={(e) => setCandDesc(e.target.value)}
                  className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs text-white h-20 resize-none"
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs border border-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCandidate}
                  className="px-5 py-2 rounded-xl text-xs text-white bg-indigo-600 hover:bg-indigo-500"
                >
                  {isAddingCandidate ? 'Adding...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
