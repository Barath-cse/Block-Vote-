import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { ShieldCheck, ShieldAlert, Scan, Camera, AlertCircle, RefreshCw, Award, CheckCircle2, XCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8080/api/v1/voters';
const SIMILARITY_THRESHOLD = 0.45; // 45.00% threshold

export const VerifyVoter: React.FC = () => {
  const [voterId, setVoterId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterId.trim()) {
      setErrorMsg('Please enter a valid Voter ID to perform biometric verification.');
      return;
    }

    if (!webcamRef.current) {
      setErrorMsg('Camera stream unavailable.');
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setErrorMsg('Failed to capture frame from webcam.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);
    setVerificationResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/verify`, {
        voterId: voterId.trim(),
        frame: imageSrc,
      });

      setVerificationResult(response.data);
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Verification failed.';
      const rawErr = err.response?.data?.detail || err.response?.data?.error || err.message;

      if (typeof rawErr === 'string') {
        if (rawErr.includes('{"detail":')) {
          try {
            const jsonPart = rawErr.substring(rawErr.indexOf('{'));
            const parsed = JSON.parse(jsonPart);
            errMsg = parsed.detail || rawErr;
          } catch {
            errMsg = rawErr;
          }
        } else {
          errMsg = rawErr;
        }
      }

      setErrorMsg(errMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Input & Camera Feed Column */}
      <div className="lg:col-span-7 space-y-6">
        <div className="glass-card rounded-2xl p-6 shadow-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Live Biometric Verification (1:1 Match)</h2>
              <p className="text-sm text-slate-400">Verifies live webcam embedding against registered voter baseline</p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Enter Voter ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. TN123456789"
                  value={voterId}
                  onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                  disabled={isVerifying}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono tracking-wider"
                  required
                />
              </div>
            </div>

            {/* Webcam Live Feed */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center group shadow-inner">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                className="w-full h-full object-cover"
              />

              {/* Status Overlay Badge */}
              <div className="absolute top-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border border-slate-700/50">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-medium text-emerald-300">🟢 Face Detected & Camera Ready</span>
              </div>

              {/* Facial Bounding Overlay Graphic */}
              <div className="absolute inset-0 pointer-events-none border-2 border-purple-500/20 rounded-2xl flex items-center justify-center">
                <div className="w-56 h-72 border-2 border-dashed border-purple-400/40 rounded-3xl relative flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-purple-400"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-purple-400"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-purple-400"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-purple-400"></div>
                  {isVerifying && (
                    <div className="absolute inset-x-0 h-1 bg-purple-500/80 blur-[2px] animate-scan"></div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Verification Button */}
            <button
              type="submit"
              disabled={isVerifying || !voterId.trim()}
              className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Calculating Cosine Similarity Vector...</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>Verify Identity Now</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Output Card Column */}
      <div className="lg:col-span-5 space-y-6">
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 glow-rose flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Verification Output Result Card */}
        {verificationResult && (
          <div
            className={`glass-card rounded-2xl p-6 border space-y-6 transition-all duration-300 ${
              verificationResult.matched
                ? 'border-emerald-500/40 glow-emerald'
                : 'border-rose-500/40 glow-rose'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 font-bold text-lg">
                {verificationResult.matched ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                    <span>✅ Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-400">
                    <ShieldAlert className="w-6 h-6" />
                    <span>❌ Rejected</span>
                  </div>
                )}
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full border font-semibold ${
                  verificationResult.matched
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {verificationResult.matched ? 'MATCHED' : 'MISMATCH'}
              </span>
            </div>

            {/* Voter Details */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Verified Candidate</span>
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-bold text-white">{verificationResult.name}</span>
                <span className="text-sm font-mono text-indigo-300 font-semibold">{verificationResult.voterId}</span>
              </div>
            </div>

            {/* Score Radial Card */}
            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 flex flex-col items-center justify-center space-y-3">
              <span className="text-xs text-slate-400 uppercase font-medium tracking-wider">
                Cosine Similarity Score
              </span>

              <div className="text-4xl font-extrabold tracking-tight font-mono">
                <span
                  className={
                    verificationResult.matched
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300'
                      : 'text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-300'
                  }
                >
                  {verificationResult.displayPercentage}
                </span>
              </div>

              {/* Progress bar visual for similarity */}
              <div className="w-full space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      verificationResult.matched
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-rose-600 to-red-500'
                    }`}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, verificationResult.similarityScore * 100)
                      )}%`,
                    }}
                  ></div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                  <span>0.0%</span>
                  <span className="text-purple-400 font-bold">Threshold: 45.0%</span>
                  <span>100.0%</span>
                </div>
              </div>
            </div>

            {/* Decision Rule Detail */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-slate-200 block">System Decision Logic:</span>
              <p className="leading-relaxed text-slate-400">{verificationResult.message}</p>
            </div>
          </div>
        )}

        {/* Informational Guidance Box */}
        {!verificationResult && (
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-400" />
              1:1 Verification Protocol
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the registered Voter ID and face the camera. Spring Boot fetches the baseline L2-normalized vector from MongoDB and compares it with the live 512-d InsightFace vector using Cosine Similarity:
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-300">
              Cosine Sim = (A · B) / (||A|| * ||B||)
            </div>
            <p className="text-xs text-slate-400">
              If similarity $\ge 0.45$, identity is verified as <strong>MATCHED</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
