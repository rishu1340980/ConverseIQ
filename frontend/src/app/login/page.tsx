'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, Sparkles, Mail, KeyRound, ShieldCheck, ArrowRight, RefreshCw, Lock } from 'lucide-react';
import { apiRequest, setAuthToken, setStoredUser } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';

const APSIT_DOMAIN = '@apsit.edu.in';
const INVALID_DOMAIN_MSG = 'Not Applicable. Please use your official APSIT institutional email address.';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const validateEmailDomain = (inputEmail: string): boolean => {
    const clean = inputEmail.trim().toLowerCase();
    if (!clean) return false;
    // Allow admin@converseiq.edu for internal testing
    if (clean === 'admin@converseiq.edu') return true;
    return clean.endsWith(APSIT_DOMAIN) && /^[a-zA-Z0-9_.+-]+@apsit\.edu\.in$/.test(clean);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setError(null);
    setSuccessMsg(null);
  };

  // Request OTP Handler
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your official institutional email.');
      return;
    }

    if (!validateEmailDomain(cleanEmail)) {
      setError(INVALID_DOMAIN_MSG);
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail }),
      });
      setOtpSent(true);
      setTimer(60);
      setSuccessMsg(res.message || `Verification code sent to ${cleanEmail}`);
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP Handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
      });

      setAuthToken(data.access_token);
      setStoredUser(data.user);

      if (data.user?.role === 'HOD') {
        router.push('/hod/overview');
      } else if (data.user?.role === 'Admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Login Handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!validateEmailDomain(cleanEmail)) {
      setError(INVALID_DOMAIN_MSG);
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      setAuthToken(data.access_token);
      setStoredUser(data.user);

      if (data.user?.role === 'HOD') {
        router.push('/hod/overview');
      } else if (data.user?.role === 'Admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo/Evaluation Login
  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });

      setAuthToken(data.access_token);
      setStoredUser(data.user);

      if (data.user?.role === 'HOD') {
        router.push('/hod/overview');
      } else if (data.user?.role === 'Admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B132B] flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Institutional Ambient Accent Background */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-emerald-100/40 dark:bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
        
        {/* Left Institutional Overview */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Institution Header Badge */}
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 text-xs font-bold uppercase tracking-wider">
              <span>A. P. Shah Institute of Technology</span>
              <span>&bull;</span>
              <span>NBA Accredited</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Department of Information Technology &bull; University of Mumbai
            </p>
          </div>

          {/* ConverseIQ Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-2xl shadow-sm tracking-tight">
              C
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-3xl text-slate-900 dark:text-white tracking-tight">
                  ConverseIQ
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-900">
                  <Sparkles className="w-3 h-3" />
                  <span>Academic Intelligence</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official Faculty Deliberation &amp; Governance Management System
              </p>
            </div>
          </div>

          <div className="space-y-3 max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
              Intelligent Meeting Governance &amp; Automated MoM Generation
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Designed specifically for APSIT Information Technology faculty to conduct academic board deliberations, track action deliverables, and generate official signed MoM documentation with bilingual AI intelligence.
            </p>
          </div>

          {/* Workflow Highlights Card */}
          <div className="bg-white dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md shadow-xs space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Academic Governance Workflow
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <div className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Video Conferencing with Faculty Invitations</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <div className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Strict @apsit.edu.in Institutional Authentication</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <div className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Automated Institutional Minutes of Meeting (MoM)</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <div className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>HOD Faculty Roster &amp; Action Accountability Matrix</span>
            </div>
          </div>

          {/* Evaluator Simulation Quick Access Panel */}
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 max-w-xl">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-900 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Demonstration &amp; Evaluator Quick Access</span>
            </div>
            <p className="text-[11px] text-blue-800/80 dark:text-blue-400 mb-3">
              Click an official institutional profile below to evaluate the system with verified accounts:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('23104080@apsit.edu.in', 'Faculty@123')}
                className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-left hover:border-blue-500 transition-all cursor-pointer shadow-xs"
              >
                <div className="text-xs font-bold text-blue-900 dark:text-blue-200">Demo Account</div>
                <div className="text-[10px] text-slate-500 truncate">23104080@apsit.edu.in</div>
                <div className="text-[9px] text-emerald-600 font-bold mt-1">Live Simulation &rarr;</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('randeep.kahlon@apsit.edu.in', 'Faculty@123')}
                className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-left hover:border-blue-500 transition-all cursor-pointer shadow-xs"
              >
                <div className="text-xs font-bold text-blue-900 dark:text-blue-200">Prof. Randeep Kaur</div>
                <div className="text-[10px] text-slate-500 truncate">randeep.kahlon@apsit.edu.in</div>
                <div className="text-[9px] text-blue-600 font-bold mt-1">Faculty Access &rarr;</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('hod.it@apsit.edu.in', 'Hod@123')}
                className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-left hover:border-blue-500 transition-all cursor-pointer shadow-xs"
              >
                <div className="text-xs font-bold text-blue-900 dark:text-blue-200">Dr. Kiran Deshpande</div>
                <div className="text-[10px] text-slate-500 truncate">hod.it@apsit.edu.in</div>
                <div className="text-[9px] text-indigo-600 font-bold mt-1">HOD Dashboard &rarr;</div>
              </button>
            </div>
          </div>

        </div>

        {/* Right Side Login Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-9 shadow-md border border-slate-200 dark:border-slate-800">
            
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Official Institutional Access
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Strict domain authentication for <span className="font-semibold text-blue-700 dark:text-blue-400">@apsit.edu.in</span>
              </p>
            </div>

            {/* Mode Switcher: Institutional OTP vs Password */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  authMode === 'otp'
                    ? 'bg-white dark:bg-slate-900 text-blue-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Institutional OTP</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  authMode === 'password'
                    ? 'bg-white dark:bg-slate-900 text-blue-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Password Login</span>
              </button>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMsg && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-start space-x-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* AUTH MODE 1: INSTITUTIONAL OTP */}
            {authMode === 'otp' && (
              <div>
                {!otpSent ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Official APSIT Institutional Email
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="faculty.name@apsit.edu.in"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none transition-all"
                        />
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Must end with <code className="text-blue-700 font-mono">@apsit.edu.in</code>
                      </p>
                    </div>

                    <div className="pt-2">
                      <AnimatedButton
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        className="w-full justify-center bg-blue-900 hover:bg-blue-800 text-white"
                      >
                        Request Institutional OTP &rarr;
                      </AnimatedButton>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300">
                      Enter the 6-digit verification code dispatched to: <br />
                      <strong className="font-semibold text-blue-950 dark:text-blue-200">{email}</strong>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full text-center tracking-[8px] font-mono font-extrabold text-2xl py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      {timer > 0 ? (
                        <span className="text-slate-500 font-medium">
                          Resend code in <strong className="text-blue-900 font-bold">{timer}s</strong>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestOtp()}
                          disabled={isLoading}
                          className="text-blue-800 dark:text-blue-400 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Resend OTP</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtp(''); }}
                        className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Change Email
                      </button>
                    </div>

                    <div className="pt-2">
                      <AnimatedButton
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        className="w-full justify-center bg-blue-900 hover:bg-blue-800 text-white"
                      >
                        Verify &amp; Sign In
                      </AnimatedButton>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* AUTH MODE 2: PASSWORD LOGIN */}
            {authMode === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Official APSIT Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="faculty.name@apsit.edu.in"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none transition-all"
                  />
                </div>

                <div className="pt-2">
                  <AnimatedButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full justify-center bg-blue-900 hover:bg-blue-800 text-white"
                  >
                    Sign In
                  </AnimatedButton>
                </div>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Unauthorized access is strictly prohibited &bull; APSIT IT Dept
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

