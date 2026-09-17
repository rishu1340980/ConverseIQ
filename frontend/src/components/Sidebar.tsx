'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutGrid, 
  Video, 
  FileText, 
  CheckSquare, 
  Calendar, 
  Sparkles, 
  Settings, 
  Plus,
  Users,
  Folder,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { getCurrentStoredUser, removeAuthToken } from '@/lib/api';
import AddMeetingModal from './AddMeetingModal';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [user, setUser] = useState<{ name?: string; full_name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    const u = getCurrentStoredUser();
    if (u) setUser(u);
  }, []);

  const handleLogout = () => {
    removeAuthToken();
    router.push('/login');
  };

  // If on login page, don't show sidebar
  if (pathname === '/login') return null;

  const isHodMode = pathname.startsWith('/hod');
  const isAdminMode = pathname.startsWith('/admin');
  const isFacultyMode = !isHodMode && !isAdminMode;

  const facultyNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
    { label: 'Meetings', href: '/meetings', icon: Video },
    { label: 'MoM & Summaries', href: '/mom', icon: FileText },
    { label: 'Action Items', href: '/action-items', icon: CheckSquare },
    { label: 'Schedule', href: '/schedule', icon: Calendar },
    { label: 'AI Assistant', href: '/ai-assistant', icon: Sparkles },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const hodNavItems = [
    { label: 'Department Overview', href: '/hod/overview', icon: Sparkles },
    { label: 'Faculty Performance', href: '/hod/faculty', icon: Users },
    { label: 'Department Meetings', href: '/hod/meetings', icon: Folder },
    { label: 'Action Tracker', href: '/hod/action-tracker', icon: CheckSquare },
    { label: 'Schedule', href: '/hod/schedule', icon: Calendar },
  ];

  const adminNavItems = [
    { label: 'Administration Suite', href: '/admin', icon: ShieldCheck },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const currentNavItems = isHodMode ? hodNavItems : isAdminMode ? adminNavItems : facultyNavItems;

  const displayName = user?.name || user?.full_name || 'User';
  const displayRole = isHodMode ? 'Head of Department' : isAdminMode ? 'Administrator' : (user?.role || 'Faculty');
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <aside className="w-64 bg-[#F8F7F2] border-r border-[#E8E5DA] h-screen sticky top-0 flex flex-col justify-between p-5 select-none z-30">
        
        {/* Brand Header */}
        <div>
          <div className="px-2 py-3 mb-2">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#45644F] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                C
              </div>
              <span className="font-bold text-xl text-[#1C251E] tracking-tight">
                ConverseIQ
              </span>
            </div>

            {/* Role / View Switcher */}
            <div className="mt-3 bg-[#EAE5D9] p-1 rounded-xl flex items-center justify-between text-xs font-semibold">
              <Link
                href="/dashboard"
                className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                  isFacultyMode ? 'bg-white text-[#2F4E36] shadow-xs font-bold' : 'text-[#6B7280] hover:text-[#1C251E]'
                }`}
              >
                Faculty
              </Link>
              <Link
                href="/hod/overview"
                className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                  isHodMode ? 'bg-white text-[#2F4E36] shadow-xs font-bold' : 'text-[#6B7280] hover:text-[#1C251E]'
                }`}
              >
                HOD
              </Link>
              <Link
                href="/admin"
                className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                  isAdminMode ? 'bg-white text-[#2F4E36] shadow-xs font-bold' : 'text-[#6B7280] hover:text-[#1C251E]'
                }`}
              >
                Admin
              </Link>
            </div>

            {/* Department Pill Badge (HOD Mode) */}
            {isHodMode && (
              <div className="mt-2.5">
                <span className="inline-block px-2.5 py-1 bg-[#E8F0EA] border border-[#D8E6DC] text-[#3D5A45] rounded-md text-[11px] font-semibold tracking-wide">
                  HOD • Computer Science
                </span>
              </div>
            )}
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5 mt-2">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/hod/overview' && item.href !== '/admin' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#DCE7DC] text-[#2F4E36] font-semibold'
                      : 'text-[#4B5563] hover:text-[#1C251E] hover:bg-[#EAE5D9]/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#2F4E36]' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="space-y-3 pt-4 border-t border-[#E8E5DA]/80">
          
          {/* + New Meeting Button (Faculty View) */}
          {isFacultyMode && (
            <button
              type="button"
              onClick={() => setIsAddMeetingOpen(true)}
              className="w-full py-2.5 px-4 bg-[#45644F] hover:bg-[#385240] text-white text-sm font-medium rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Meeting</span>
            </button>
          )}

          {/* User Profile Bar */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[#EAE5D9]/40 transition-colors">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-9 h-9 rounded-full bg-[#45644F] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {initial}
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-[#1C251E] truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                  {displayRole}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </aside>

      {/* Add Meeting Modal */}
      <AddMeetingModal
        isOpen={isAddMeetingOpen}
        onClose={() => setIsAddMeetingOpen(false)}
      />
    </>
  );
}
