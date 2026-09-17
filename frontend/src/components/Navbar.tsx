'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Video, 
  Calendar, 
  CheckSquare, 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  LogOut, 
  Bot,
  Layers,
  ChevronRight,
  UploadCloud
} from 'lucide-react';
import { getCurrentStoredUser, removeAuthToken } from '@/lib/api';
import { User } from '@/types';
import UploadRecordingModal from '@/components/UploadRecordingModal';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentStoredUser());
  }, [pathname]);

  const handleLogout = () => {
    removeAuthToken();
    router.push('/login');
  };

  if (pathname === '/login') return null;

  const isAdminOrHOD = user?.role === 'Admin' || user?.role === 'HOD';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-9 h-9 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow">
                CQ
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-gray-900">
                  Converse<span className="text-blue-600">IQ</span>
                </span>
                <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                  Academic Intelligence
                </span>
              </div>
            </Link>

            {/* Main Navigation Links */}
            <nav className="hidden md:flex space-x-1">
              <Link
                href="/dashboard"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/dashboard'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/meetings"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/meetings')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Meetings</span>
              </Link>

              <Link
                href="/action-items"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/action-items'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Action Items</span>
              </Link>

              <Link
                href="/schedule"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/schedule'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Schedule</span>
              </Link>

              <Link
                href="/live-meeting"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/live-meeting'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Video className="w-4 h-4 text-indigo-600" />
                <span>Start Meeting</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors shadow-sm"
              >
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Upload Recording</span>
              </button>

              {isAdminOrHOD && (
                <Link
                  href="/admin"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin')
                      ? 'bg-purple-50 text-purple-700 font-semibold'
                      : 'text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Admin Panel</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Right Side: Role Badge & Profile */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                  <div className="flex items-center justify-end space-x-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        user.role === 'Admin'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'HOD'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      <UploadRecordingModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
    </header>
  );
}
