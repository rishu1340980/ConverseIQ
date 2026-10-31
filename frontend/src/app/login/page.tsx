'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, Sparkles, Mail, KeyRound, ShieldCheck, ArrowRight, RefreshCw, Lock } from 'lucide-react';
import { apiRequest, setAuthToken, setStoredUser, removeAuthToken } from '@/lib/api';
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

  // Clear stale tokens when arriving on login page
  useEffect(() => {
    removeAuthToken();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#F5FAF8] dark:bg-[#0F1A15] flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Decorative ambient background accents */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#B9DDE3]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-[#D4E9DF] dark:bg-[#243D33]/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
        
        {/* Left Institutional Overview */}
        <div className="lg:col-span-7 space-y-8 animate-fade-in">
          
          {/* Institution Header Badge */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#367C88] dark:text-[#4DA3B0] border border-[#B9DDE3] dark:border-[#2A5A63]/60 text-xs font-bold uppercase tracking-wider">
              <span>A. P. Shah Institute of Technology</span>
              <span>&bull;</span>
              <span>NBA Accredited</span>
            </div>
            <p className="text-xs font-semibold text-[#667875] dark:text-[#8FA89C]">
              Department of Information Technology &bull; University of Mumbai
            </p>
          </div>

          {/* ConverseIQ Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#3F795F] text-white flex items-center justify-center font-black text-2xl shadow-sm tracking-tight">
              C
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-3xl text-[#173A2C] dark:text-[#E8F0EC] tracking-tight">
                  ConverseIQ
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#D4E9DF] dark:bg-[#243D33] text-[#173A2C] dark:text-[#E8F0EC] text-xs font-bold border border-[#BDDEC0] dark:border-[#2D4A3E]">
                  <Sparkles className="w-3 h-3 text-[#3F795F] dark:text-[#78A98F]" />
                  <span>Academic Intelligence</span>
                </span>
              </div>
              <p className="text-xs text-[#667875] dark:text-[#8FA89C] mt-0.5 font-medium">
                Official Faculty Deliberation &amp; Governance Management System
              </p>
            </div>
          </div>

          <div className="space-y-3.5 max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#173A2C] dark:text-[#E8F0EC] tracking-tight leading-snug">
              Intelligent Meeting Governance &amp; Automated MoM Generation
            </h1>
            <p className="text-sm sm:text-base text-[#667875] dark:text-[#8FA89C] leading-relaxed font-medium">
              Designed specifically for APSIT Information Technology faculty to conduct academic board deliberations, track action deliverables, and generate official signed MoM documentation with bilingual AI intelligence.
            </p>
          </div>

          {/* Workflow Highlights Card */}
          <div className="bg-white dark:bg-[#1A2B24]/90 backdrop-blur-md border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-2xl p-5 max-w-md shadow-xs space-y-3">
            <div className="text-xs font-bold text-[#667875] dark:text-[#8FA89C] uppercase tracking-wider">
              Academic Governance Workflow
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Video Conferencing with Faculty Invitations</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Strict @apsit.edu.in Institutional Authentication</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Automated Institutional Minutes of Meeting (MoM)</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>HOD Faculty Roster &amp; Action Accountability Matrix</span>
            </div>
          </div>

        </div>

        {/* Right Side Login Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-8 sm:p-9 shadow-sm border border-[#DCE7E2] dark:border-[#2D4A3E]">
            
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#173A2C] dark:text-[#E8F0EC] tracking-tight">
                Official Institutional Access
              </h2>
              <p className="text-xs text-[#667875] dark:text-[#8FA89C] mt-1 font-medium">
                Strict domain authentication for <span className="font-semibold text-[#3F795F] dark:text-[#78A98F]">@apsit.edu.in</span>
              </p>
            </div>

            {/* Mode Switcher: Institutional OTP vs Password */}
            <div className="flex p-1 bg-[#EDF5F2] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  authMode === 'otp'
                    ? 'bg-white dark:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] shadow-xs'
                    : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
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
                    ? 'bg-white dark:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] shadow-xs'
                    : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Password Login</span>
              </button>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMsg && (
              <div className="mb-5 p-3 rounded-xl bg-[#D4E9DF] dark:bg-[#243D33] border border-[#BDDEC0] dark:border-[#2D4A3E] text-xs text-[#173A2C] dark:text-[#E8F0EC] font-semibold flex items-start space-x-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#3F795F]" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* AUTH MODE 1: INSTITUTIONAL OTP */}
            {authMode === 'otp' && (
              <div>
                {!otpSent ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                        Official APSIT Institutional Email
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="faculty.name@apsit.edu.in"
                          className="w-full pl-9 pr-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder:text-[#667875]/60 focus:bg-white dark:focus:bg-[#1A2B24] focus:ring-2 focus:ring-[#78A98F] outline-none transition-all"
                        />
                        <Mail className="w-4 h-4 text-[#667875] absolute left-3 top-3.5" />
                      </div>
                      <p className="text-[11px] text-[#667875] dark:text-[#8FA89C] mt-1 font-medium">
                        Must end with <code className="text-[#3F795F] dark:text-[#78A98F] font-mono">@apsit.edu.in</code>
                      </p>
                    </div>

                    <div className="pt-2">
                      <AnimatedButton
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        className="w-full justify-center bg-[#78A98F] hover:bg-[#5A9175] text-white font-bold"
                      >
                        Request Institutional OTP &rarr;
                      </AnimatedButton>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-3 bg-[#E4F2F4] dark:bg-[#1A3A3F] rounded-xl border border-[#B9DDE3] dark:border-[#2A5A63] text-xs text-[#132F34] dark:text-[#B9DDE3]">
                      Enter the 6-digit verification code dispatched to: <br />
                      <strong className="font-bold text-[#173A2C] dark:text-[#E8F0EC]">{email}</strong>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
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
                        className="w-full text-center tracking-[8px] font-mono font-extrabold text-2xl py-2 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-[#173A2C] dark:text-[#E8F0EC] focus:bg-white dark:focus:bg-[#1A2B24] focus:ring-2 focus:ring-[#78A98F] outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      {timer > 0 ? (
                        <span className="text-[#667875] dark:text-[#8FA89C] font-medium">
                          Resend code in <strong className="text-[#173A2C] dark:text-[#E8F0EC] font-bold">{timer}s</strong>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestOtp()}
                          disabled={isLoading}
                          className="text-[#3F795F] dark:text-[#78A98F] font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Resend OTP</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtp(''); }}
                        className="text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC] font-medium cursor-pointer"
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
                        className="w-full justify-center bg-[#78A98F] hover:bg-[#5A9175] text-white font-bold"
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
                  <label className="block text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Official APSIT Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="faculty.name@apsit.edu.in"
                    className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder:text-[#667875]/60 focus:bg-white dark:focus:bg-[#1A2B24] focus:ring-2 focus:ring-[#78A98F] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder:text-[#667875]/60 focus:bg-white dark:focus:bg-[#1A2B24] focus:ring-2 focus:ring-[#78A98F] outline-none transition-all"
                  />
                </div>

                <div className="pt-2">
                  <AnimatedButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full justify-center bg-[#78A98F] hover:bg-[#5A9175] text-white font-bold"
                  >
                    Sign In
                  </AnimatedButton>
                </div>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-[#DCE7E2] dark:border-[#2D4A3E] text-center">
              <p className="text-[11px] text-[#667875] dark:text-[#8FA89C]">
                Unauthorized access is strictly prohibited &bull; APSIT IT Dept
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

