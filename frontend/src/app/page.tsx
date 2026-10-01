'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getCurrentStoredUser } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      const user = getCurrentStoredUser();
      if (user?.role === 'HOD') {
        router.replace('/hod/overview');
      } else if (user?.role === 'Admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#DCE7E2] dark:border-[#2D4A3E] border-t-[#3F795F]"></div>
    </div>
  );
}
