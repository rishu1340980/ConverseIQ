'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#F5FAF8] text-[#173A2C]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-[#F5FAF8] text-[#173A2C]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8 transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}
