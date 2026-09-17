'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle } from 'lucide-react';
import { apiRequest, setAuthToken, setStoredUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'Faculty' | 'HOD' | 'Admin'>('Faculty');
  const [email, setEmail] = useState('prof.sharma@converseiq.edu');
  const [password, setPassword] = useState('Faculty@123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = (role: 'Faculty' | 'HOD' | 'Admin') => {
    setSelectedRole(role);
    if (role === 'Faculty') {
      setEmail('prof.sharma@converseiq.edu');
      setPassword('Faculty@123');
    } else if (role === 'HOD') {
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
    <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center p-6 lg:p-12">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        
        {/* Left Hero Side */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#45644F] text-white flex items-center justify-center font-bold text-xl shadow-sm">
              c
            </div>
            <span className="font-bold text-2xl text-[#1C251E] tracking-tight">
              ConverseIQ
            </span>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-4 max-w-xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1C251E] tracking-tight leading-[1.15]">
              Turn Conversations into Actionable Intelligence
            </h1>
            <p className="text-base sm:text-lg text-[#4B5563] leading-relaxed">
              Transform your meetings into summaries, decisions, action items, and meaningful insights using AI.
            </p>
          </div>

          {/* Floating Pipeline Progress Card */}
          <div className="bg-white/80 backdrop-blur-sm border border-[#E8E5DA] rounded-2xl p-6 max-w-md shadow-sm space-y-3.5">
            
            <div className="flex items-center space-x-3 text-sm font-medium text-[#1C251E]">
              <div className="w-5 h-5 rounded-full bg-[#45644F] text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="flex items-center space-x-1.5">
                <span>🎙</span>
                <span>Recording Uploaded</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 text-sm font-medium text-[#1C251E]">
              <div className="w-5 h-5 rounded-full bg-[#45644F] text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="flex items-center space-x-1.5">
                <span>📝</span>
                <span>Transcript Generated</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 text-sm font-medium text-[#1C251E]">
              <div className="w-5 h-5 rounded-full bg-[#45644F] text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span className="flex items-center space-x-1.5">
                <span>🧠</span>
                <span>AI Analysis</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-sm font-medium text-[#1C251E]">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-[#45644F] text-white flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="flex items-center space-x-1.5">
                  <span>✅</span>
                  <span>Action Items Extracted</span>
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-[#DCE7DC] text-[#2F4E36] rounded-full text-[11px] font-semibold animate-pulse">
                Processing...
              </span>
            </div>

          </div>

        </div>

        {/* Right Side Login Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-[#E8E5DA]">
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1C251E] tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Select your institutional role to continue
              </p>
            </div>

            {/* Role Selection Container */}
            <div className="bg-[#F3EFE6] p-1 rounded-xl grid grid-cols-3 gap-1 mb-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleRoleSelect('Faculty')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  selectedRole === 'Faculty'
                    ? 'bg-white text-[#1C251E] shadow-sm font-bold'
                    : 'text-[#6B7280] hover:text-[#1C251E]'
                }`}
              >
                <span>👤</span>
                <span>Faculty</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('HOD')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  selectedRole === 'HOD'
                    ? 'bg-white text-[#1C251E] shadow-sm font-bold'
                    : 'text-[#6B7280] hover:text-[#1C251E]'
                }`}
              >
                <span>🏛</span>
                <span>HOD</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('Admin')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  selectedRole === 'Admin'
                    ? 'bg-white text-[#1C251E] shadow-sm font-bold'
                    : 'text-[#6B7280] hover:text-[#1C251E]'
                }`}
              >
                <span>🔐</span>
                <span>Admin</span>
              </button>
            </div>


            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rishabh@university.edu"
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] focus:border-[#45644F] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] focus:border-[#45644F] outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#45644F] hover:bg-[#385240] text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E8E5DA]"></div>
              </div>
              <span className="relative px-3 bg-white text-xs text-[#9CA3AF]">or</span>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={() => handleSubmit({ preventDefault: () => {} } as any)}
              className="w-full py-2.5 px-4 bg-[#F3EFE6] hover:bg-[#EAE5D9] text-[#1C251E] text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 border border-[#E5E0D5]"
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
              <span>Continue with Google</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
