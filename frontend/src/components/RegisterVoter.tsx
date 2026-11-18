import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { UserPlus, Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8080/api/v1/voters';
const TOTAL_FRAMES = 15;

export const RegisterVoter: React.FC = () => {
  const [voterId, setVoterId] = useState('');
  const [name, setName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFramesCount, setCapturedFramesCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [registeredData, setRegisteredData] = useState<any>(null);

  const webcamRef = useRef<Webcam>(null);

  const captureFrames = useCallback(async (): Promise<string[]> => {
    const frames: string[] = [];
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      setCapturedFramesCount(i);
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          frames.push(imageSrc);
        }
      }
      // Small delay between frame captures (150ms)
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return frames;
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterId.trim() || !name.trim()) {
      setStatusMessage({ type: 'error', text: 'Please provide both Voter ID and Full Name.' });
      return;
    }

    setIsCapturing(true);
    setStatusMessage({ type: 'info', text: `Capturing ${TOTAL_FRAMES} high-resolution frames from camera...` });
    setCapturedFramesCount(0);
    setRegisteredData(null);

    try {
      const frames = await captureFrames();

      if (frames.length < 5) {
        throw new Error('Failed to capture sufficient webcam frames. Check camera permissions.');
      }

      setStatusMessage({ type: 'info', text: 'Processing embeddings & computing mean vector baseline...' });

      const response = await axios.post(`${API_BASE_URL}/register`, {
        voterId: voterId.trim(),
        name: name.trim(),
        frames: frames,
      });

      setRegisteredData(response.data);
      setStatusMessage({ type: 'success', text: `Voter ${name} (${voterId}) registered successfully!` });
      setVoterId('');
      setName('');
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Registration failed.';
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
      
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsCapturing(false);
      setCapturedFramesCount(0);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Form & Webcam Column */}
      <div className="lg:col-span-7 space-y-6">
        <div className="glass-card rounded-2xl p-6 shadow-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Voter Biometric Registration</h2>
              <p className="text-sm text-slate-400">Capture 15 frames to generate master baseline 512-d embedding vector</p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Voter ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. TN123456789"
                  value={voterId}
                  onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                  disabled={isCapturing}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isCapturing}
                  className="w-full glass-input px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Webcam Container */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center group shadow-inner">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                className="w-full h-full object-cover"
              />

              {/* Scanning Overlay Reticle */}
              <div className="absolute inset-0 pointer-events-none border-2 border-indigo-500/20 rounded-2xl flex items-center justify-center">
                <div className="w-64 h-64 border border-indigo-400/40 rounded-full flex items-center justify-center relative">
                  <div className="w-48 h-48 border border-dashed border-indigo-400/60 rounded-full animate-pulse-slow"></div>
                  {isCapturing && (
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-scan"></div>
                  )}
                </div>
              </div>

              {/* Status Indicator Pill */}
              <div className="absolute top-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border border-slate-700/50">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-medium text-emerald-300">Live Camera Stream</span>
              </div>
            </div>

            {/* Frame Progress Bar */}
            {isCapturing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Capturing Frame Batches...</span>
                  <span className="text-indigo-400">{capturedFramesCount} / {TOTAL_FRAMES}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-200"
                    style={{ width: `${(capturedFramesCount / TOTAL_FRAMES) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCapturing || !voterId.trim() || !name.trim()}
              className="w-full py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              {isCapturing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Capturing & Extracting Embeddings...</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>Capture & Register Voter</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Result Column */}
      <div className="lg:col-span-5 space-y-6">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200 glow-emerald'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/30 text-rose-200 glow-rose'
                : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200 glow-indigo'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {statusMessage.type === 'info' && <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0 mt-0.5" />}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
        )}

        {/* Registered Voter Info Card */}
        {registeredData && (
          <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 space-y-4 glow-emerald">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-5 h-5" />
                <span>Registration Confirmed</span>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-mono">
                MongoDB Saved
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block uppercase font-medium">Voter Name</span>
                <span className="text-lg font-bold text-white">{registeredData.name}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block uppercase font-medium">Voter ID</span>
                <span className="text-base font-mono text-indigo-300 font-semibold">{registeredData.voterId}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Vector Dimensions</span>
                  <span className="text-sm font-bold text-white font-mono">{registeredData.embeddingDimension || 512} floats</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Registered At</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {new Date(registeredData.registeredAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Architecture Info Box */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            Registration Pipeline Overview
          </h3>
          <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span><strong>Multi-Frame Capture:</strong> 15 camera frames are sent to Spring Boot for robust baseline generation.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span><strong>InsightFace AI Sidecar:</strong> Python FastAPI extracts 512-d embeddings using <code className="text-indigo-300">buffalo_s</code> model.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span><strong>Vector Normalization:</strong> Mean vector <code className="text-indigo-300">M = (1/N) ∑ E_i</code> normalized with L2 norm before saving to MongoDB.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
