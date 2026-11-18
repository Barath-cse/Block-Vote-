import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { ShieldCheck, Camera, Vote, CheckCircle2, Lock, ArrowRight, UserCheck, AlertCircle, RefreshCw, Landmark, User, Calendar, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:8080/api/v1';

interface ActiveElection {
  id: string;
  electionId: string;
  title: string;
  description: string;
  startTime?: string;
  endTime?: string;
  status: string;
  active: boolean;
}

interface Candidate {
  id: string;
  candidateId: string;
  name: string;
  partyName: string;
  partySymbol: string;
  description: string;
  voteCount: number;
}

interface VoterProfile {
  id: string;
  voterId: string;
  name: string;
  embeddingDimension: number;
  registeredAt: string;
  hasVoted?: boolean;
}

export const VoterPortal: React.FC = () => {
  // Steps:
  // 1: User Data Retrieval
  // 2: Facial Biometric Verification
  // 3: Candidate Ballot & Vote Cast
  // 4: Confirmation Receipt
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [voterIdInput, setVoterIdInput] = useState('');
  const [voterProfile, setVoterProfile] = useState<VoterProfile | null>(null);

  // Facial verification state
  const [isVerifyingFace, setIsVerifyingFace] = useState(false);
  const [faceAuthResult, setFaceAuthResult] = useState<any>(null);

  // Ballot state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [votedCandidate, setVotedCandidate] = useState<Candidate | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeElection, setActiveElection] = useState<ActiveElection | null>(null);

  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    fetchCandidates();
    fetchActiveElection();
  }, []);

  const fetchActiveElection = async () => {
    try {
      const res = await axios.get(`${API_BASE}/election/active`);
      setActiveElection(res.data);
    } catch (err) {
      console.error('Failed to fetch active election:', err);
    }
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

  const getScheduleStatus = () => {
    if (!activeElection) return null;
    const now = new Date();
    if (activeElection.startTime && new Date(activeElection.startTime) > now) {
      return {
        label: 'Upcoming (Voting Not Open Yet)',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        canVote: false,
        msg: `Voting starts at ${formatDateTime(activeElection.startTime)}`,
      };
    }
    if (activeElection.endTime && new Date(activeElection.endTime) < now) {
      return {
        label: 'Concluded (Voting Closed)',
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        canVote: false,
        msg: `This election concluded on ${formatDateTime(activeElection.endTime)}`,
      };
    }
    if (activeElection.active) {
      return {
        label: 'Polls Open',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        canVote: true,
        msg: `Closes at ${formatDateTime(activeElection.endTime)}`,
      };
    }
    return {
      label: 'Inactive',
      badge: 'bg-slate-800 text-slate-400 border-slate-700',
      canVote: false,
      msg: 'Election is currently paused or inactive.',
    };
  };

  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/candidates`);
      setCandidates(res.data);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    }
  };

  // Step 1: User Data Retrieval
  const handleRetrieveVoterData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterIdInput.trim()) {
      setErrorMsg('Please enter a valid Voter ID.');
      return;
    }

    const schedule = getScheduleStatus();
    if (schedule && !schedule.canVote) {
      setErrorMsg(`Cannot proceed: ${schedule.msg}`);
      return;
    }

    setErrorMsg(null);
    try {
      const res = await axios.get(`${API_BASE}/voters/${voterIdInput.trim().toUpperCase()}`);

      if (res.data.hasVoted) {
        throw new Error(`Voter ID ${voterIdInput.trim().toUpperCase()} has already cast a vote in this election.`);
      }

      setVoterProfile(res.data);
      setStep(2); // Proceed to Face Verification
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || 'Voter record not found. Please register first.';
      setErrorMsg(msg);
    }
  };

  // Step 2: Facial Biometric Verification
  const handleFaceBiometricAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterProfile) return;
    if (!webcamRef.current) {
      setErrorMsg('Webcam stream is unavailable.');
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setErrorMsg('Failed to capture frame from webcam.');
      return;
    }

    setIsVerifyingFace(true);
    setErrorMsg(null);

    try {
      const verifyRes = await axios.post(`${API_BASE}/voters/verify`, {
        voterId: voterProfile.voterId,
        frame: imageSrc,
      });

      if (!verifyRes.data.matched) {
        throw new Error(`Facial verification failed. Score (${verifyRes.data.displayPercentage}) is below threshold.`);
      }

      setFaceAuthResult(verifyRes.data);
      setStep(3); // Unlock Candidate Ballot
    } catch (err: any) {
      console.error(err);
      let msg = 'Facial verification failed.';
      const raw = err.response?.data?.detail || err.response?.data?.error || err.message;
      if (typeof raw === 'string') {
        if (raw.includes('{"detail":')) {
          try {
            const parsed = JSON.parse(raw.substring(raw.indexOf('{')));
            msg = parsed.detail || raw;
          } catch {
            msg = raw;
          }
        } else {
          msg = raw;
        }
      }
      setErrorMsg(msg);
    } finally {
      setIsVerifyingFace(false);
    }
  };

  // Step 3: Cast Vote
  const handleCastVote = async () => {
    if (!selectedCandidateId || !voterProfile) {
      setErrorMsg('Please select a candidate before casting your vote.');
      return;
    }

    setIsSubmittingVote(true);
    setErrorMsg(null);

    try {
      const res = await axios.post(`${API_BASE}/votes/cast`, {
        voterId: voterProfile.voterId,
        candidateId: selectedCandidateId,
      });

      setVotedCandidate(res.data.candidate);
      setStep(4); // Confirmation Receipt
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || 'Failed to submit vote.';
      setErrorMsg(msg);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setVoterIdInput('');
    setVoterProfile(null);
    setFaceAuthResult(null);
    setSelectedCandidateId(null);
    setVotedCandidate(null);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Stepper Header */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Vote className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Voter Biometric Portal</h2>
            <p className="text-xs text-slate-400">Data Retrieval &rarr; Face Scan &rarr; Vote</p>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden md:flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            1. Retrieval
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            2. Face Scan
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${step >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            3. Vote Ballot
          </div>
        </div>
      </div>

      {/* Active Election Time Window Banner */}
      {activeElection && (
        <div className="glass-card rounded-2xl p-4 border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {activeElection.electionId}
              </span>
              <h3 className="text-sm font-bold text-white">{activeElection.title}</h3>
            </div>
            <p className="text-xs text-slate-400">{activeElection.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400 font-mono text-[11px]">Start:</span>
              <span className="font-semibold font-mono text-[11px]">{formatDateTime(activeElection.startTime)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400 font-mono text-[11px]">End:</span>
              <span className="font-semibold font-mono text-[11px]">{formatDateTime(activeElection.endTime)}</span>
            </div>

            {(() => {
              const schedule = getScheduleStatus();
              return schedule ? (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${schedule.badge}`}>
                  {schedule.label}
                </span>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 glow-rose flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: User Data Retrieval */}
      {step === 1 && (
        <div className="max-w-md mx-auto space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Step 1: Retrieve Voter Profile</h3>
                <p className="text-xs text-slate-400">Enter your registered Voter ID to begin facial verification</p>
              </div>
            </div>

            <form onSubmit={handleRetrieveVoterData} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Voter ID</label>
                <input
                  type="text"
                  placeholder="e.g. TN123456789"
                  value={voterIdInput}
                  onChange={(e) => setVoterIdInput(e.target.value.toUpperCase())}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm"
              >
                <span>Find & Retrieve Voter Data</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: Facial Biometric Scan */}
      {step === 2 && voterProfile && (
        <div className="max-w-lg mx-auto space-y-6">
          <div className="glass-card rounded-2xl p-4 border border-indigo-500/30 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Voter: <strong>{voterProfile.name} ({voterProfile.voterId})</strong></span>
            <span className="text-indigo-400 font-bold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Record Loaded
            </span>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-indigo-400" />
                Step 2: 1:1 Live Face Biometric Verification
              </h3>
              <p className="text-xs text-slate-400">Look directly into camera to match InsightFace 512-d embedding</p>
            </div>

            <form onSubmit={handleFaceBiometricAuth} className="space-y-4">
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

              <button
                type="submit"
                disabled={isVerifyingFace}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/30"
              >
                {isVerifyingFace ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Facial Vectors...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Verify Face & Unlock Ballot</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 3: Candidate Ballot */}
      {step === 3 && voterProfile && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-emerald-500/40 glow-emerald flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Biometrically Authenticated</span>
                <h3 className="text-xl font-bold text-white">{voterProfile.name} ({voterProfile.voterId})</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-indigo-400 font-bold">
                ✓ Face Match Score: {faceAuthResult?.displayPercentage}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" />
              Step 3: Select Candidate & Cast Vote
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {candidates.map((cand) => (
                <div
                  key={cand.candidateId}
                  onClick={() => setSelectedCandidateId(cand.candidateId)}
                  className={`glass-card rounded-2xl p-6 border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 relative ${selectedCandidateId === cand.candidateId
                      ? 'border-indigo-500 bg-indigo-950/30 glow-indigo ring-2 ring-indigo-500'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                >
                  {selectedCandidateId === cand.candidateId && (
                    <div className="absolute top-4 right-4 bg-indigo-500 text-white rounded-full p-1">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-2 bg-slate-900 rounded-xl border border-slate-800">{cand.partySymbol}</span>
                      <div>
                        <h4 className="font-bold text-white text-lg">{cand.name}</h4>
                        <span className="text-xs font-semibold text-indigo-300">{cand.partyName}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{cand.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-500 font-mono">
                    <span>ID: {cand.candidateId}</span>
                    <span className={selectedCandidateId === cand.candidateId ? 'text-indigo-400 font-bold' : ''}>
                      {selectedCandidateId === cand.candidateId ? 'SELECTED' : 'Click to select'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              onClick={handleReset}
              className="px-6 py-3.5 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCastVote}
              disabled={!selectedCandidateId || isSubmittingVote}
              className="px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 text-sm"
            >
              {isSubmittingVote ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Casting Vote...</span>
                </>
              ) : (
                <>
                  <Vote className="w-4 h-4" />
                  <span>Confirm & Submit Vote</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Receipt */}
      {step === 4 && (
        <div className="glass-card rounded-2xl p-8 border border-emerald-500/40 glow-emerald max-w-xl mx-auto space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-white">Vote Cast Successfully!</h3>
            <p className="text-sm text-slate-400">Biometric vote confirmed on MongoDB ledger.</p>
          </div>

          {votedCandidate && voterProfile && (
            <div className="bg-slate-900/90 rounded-xl p-5 border border-slate-800 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs text-slate-400 uppercase font-semibold">Voter ID & Name</span>
                <span className="font-mono text-indigo-300 font-bold">{voterProfile.voterId} ({voterProfile.name})</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs text-slate-400 uppercase font-semibold">Voted Candidate</span>
                <span className="font-bold text-white">{votedCandidate.name} ({votedCandidate.partySymbol})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase font-semibold">Party</span>
                <span className="text-sm text-slate-300 font-semibold">{votedCandidate.partyName}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all text-sm"
          >
            Done & Return to Start
          </button>
        </div>
      )}
    </div>
  );
};

