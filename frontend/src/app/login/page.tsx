'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, Sparkles } from 'lucide-react';
import { apiRequest, setAuthToken, setStoredUser } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';
import SegmentedControl from '@/components/ui/SegmentedControl';

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'Faculty' | 'HOD' | 'Admin'>('Faculty');
  const [email, setEmail] = useState('prof.sharma@converseiq.edu');
  const [password, setPassword] = useState('Faculty@123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = (role: string) => {
    const typedRole = role as 'Faculty' | 'HOD' | 'Admin';
    setSelectedRole(typedRole);
    if (typedRole === 'Faculty') {
      setEmail('prof.sharma@converseiq.edu');
      setPassword('Faculty@123');
    } else if (typedRole === 'HOD') {
      setEmail('hod.cs@converseiq.edu');
      setPassword('Hod@123');
    } else {
      setEmail('admin@converseiq.edu');
      setPassword('Admin@123');
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
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
    <div className="min-h-screen bg-[#F5FAF8] flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Decorative ambient background accents */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#B9DDE3]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-[#D4E9DF]/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
        
        {/* Left Hero Side */}
        <div className="lg:col-span-7 space-y-8 animate-fade-in">
          
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-[#3F795F] text-white flex items-center justify-center font-black text-2xl shadow-sm tracking-tight">
              c
            </div>
            <span className="font-extrabold text-2xl text-[#173A2C] tracking-tight">
              ConverseIQ
            </span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#E4F2F4] text-[#367C88] text-xs font-bold border border-[#B9DDE3]/60">
              <Sparkles className="w-3 h-3 text-[#367C88]" />
              <span>Academic Intelligence</span>
            </span>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-4 max-w-xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#173A2C] tracking-tight leading-[1.15]">
              Turn Conversations into Actionable Intelligence
            </h1>
            <p className="text-base sm:text-lg text-[#667875] leading-relaxed font-medium">
              Transform academic and departmental meetings into structured MoM summaries, verified decisions, action trackers, and multilingual transcripts using AI.
            </p>
          </div>

          {/* Floating Pipeline Progress Card */}
          <div className="bg-white/90 backdrop-blur-md border border-[#DCE7E2] rounded-2xl p-6 max-w-md shadow-sm space-y-3.5 card-interactive">
            
            <div className="flex items-center space-x-3 text-sm font-semibold text-[#173A2C]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="flex items-center space-x-2">
                <span>🎙</span>
                <span>Meeting Recording Uploaded</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 text-sm font-semibold text-[#173A2C]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="flex items-center space-x-2">
                <span>📝</span>
                <span>Bilingual Transcript Generated</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 text-sm font-semibold text-[#173A2C]">
              <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="flex items-center space-x-2">
                <span>🧠</span>
                <span>AI Agenda &amp; Decision Mapping</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-sm font-semibold text-[#173A2C]">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="flex items-center space-x-2">
                  <span>✅</span>
                  <span>Action Items &amp; Deadlines Assigned</span>
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-[#D4E9DF] text-[#173A2C] rounded-full text-[11px] font-bold animate-pulse-soft">
                Ready
              </span>
            </div>

          </div>

        </div>

        {/* Right Side Login Card */}
        <div className="lg:col-span-5 w-full animate-slide-up">
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-[#DCE7E2]">
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#173A2C] tracking-tight">
                Institutional Access
              </h2>
              <p className="text-sm text-[#667875] mt-1 font-medium">
                Select your academic role to proceed with preloaded demo credentials
              </p>
            </div>

            {/* Role Selection via SegmentedControl */}
            <div className="mb-6">
              <SegmentedControl
                className="w-full flex"
                options={[
                  { id: 'Faculty', label: 'Faculty' },
                  { id: 'HOD', label: 'HOD' },
                  { id: 'Admin', label: 'Admin' },
                ]}
                activeId={selectedRole}
                onChange={handleRoleSelect}
              />
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@converseiq.edu"
                  className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                  Security Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <AnimatedButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full justify-center"
                >
                  Sign In as {selectedRole}
                </AnimatedButton>
              </div>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#DCE7E2]"></div>
              </div>
              <span className="relative px-3 bg-white text-xs font-semibold text-[#667875]">or</span>
            </div>

            {/* Institutional SSO / Google Login Button */}
            <button
              type="button"
              onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
              className="w-full py-2.5 px-4 bg-[#F5FAF8] hover:bg-[#E4F2F4] text-[#173A2C] text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 border border-[#DCE7E2] cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Institutional Google ID</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
