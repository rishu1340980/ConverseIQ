'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ChevronDown, 
  Plus, 
  Video,
  FolderOpen,
  Calendar,
  Clock,
  Users
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AddMeetingModal from '@/components/AddMeetingModal';
import AnimatedButton from '@/components/ui/AnimatedButton';
import Skeleton from '@/components/ui/Skeleton';

interface MeetingItem {
  id: number | string;
  badge: string;
  badgeBg: string;
  title: string;
  date: string;
  participants: string;
  duration: string;
  status: string;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);

  useEffect(() => {
    fetchLiveMeetings();
  }, []);

  const fetchLiveMeetings = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any[]>('/meetings');
      if (res && res.length > 0) {
        const badgeColors = [
          'bg-[#3F795F] text-white',
          'bg-[#367C88] text-white',
          'bg-[#78A98F] text-white',
          'bg-[#4B8B9B] text-white',
        ];
        const liveItems: MeetingItem[] = res.map((m, idx) => ({
          id: m.id,
          badge: m.title.charAt(0).toUpperCase(),
          badgeBg: badgeColors[idx % badgeColors.length],
          title: m.title,
          date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          participants: `${m.participant_count || 1} members`,
          duration: `${m.duration_minutes || 45}m`,
          status: m.status || 'Analysis Complete',
        }));
        setMeetings(liveItems);
      } else {
        setMeetings([]);
      }
    } catch (err) {
      console.warn('Meetings fetch error:', err);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = meetings
    .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'newest') return Number(b.id) - Number(a.id);
      return Number(a.id) - Number(b.id);
    });

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
            Meetings
          </h1>
          <p className="text-sm text-[#667875] mt-1">
            All institutional discussions, diarized recordings, and analyzed sessions.
          </p>
        </div>

        <AnimatedButton
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddMeetingOpen(true)}
        >
          Analyze New Meeting
        </AnimatedButton>
      </div>

      {/* Controls: Search & Sort Dropdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-[#667875] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings by title or keywords..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] placeholder:text-[#667875]/60 focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all shadow-xs"
          />
        </div>

        <div className="relative w-full sm:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="appearance-none w-full sm:w-44 px-4 py-2.5 bg-white border border-[#DCE7E2] rounded-xl text-sm font-medium text-[#173A2C] focus:ring-2 focus:ring-[#78A98F] outline-none shadow-xs cursor-pointer pr-10"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          <ChevronDown className="w-4 h-4 text-[#667875] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Meetings Table Card */}
      <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-[#DCE7E2]">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-[#DCE7E2]/50 last:border-0">
                <div className="flex items-center space-x-3.5">
                  <Skeleton className="w-9 h-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE7E2] text-[12px] font-semibold text-[#667875] bg-[#F5FAF8]/50">
                  <th className="py-4 px-6">Meeting Title</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Participants</th>
                  <th className="py-4 px-6">Duration</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7E2]/60 text-sm">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F5FAF8] transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <Link
                        href={`/meetings/${item.id}`}
                        className="flex items-center space-x-3.5"
                      >
                        <div className={`w-9 h-9 rounded-xl ${item.badgeBg} flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                          {item.badge}
                        </div>
                        <span className="font-bold text-[#173A2C] group-hover:text-[#3F795F] transition-colors">
                          {item.title}
                        </span>
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-[#667875] text-xs">
                      {item.date}
                    </td>
                    <td className="py-4 px-6 text-[#667875] text-xs">
                      {item.participants}
                    </td>
                    <td className="py-4 px-6 text-[#667875] text-xs">
                      {item.duration}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center px-3 py-1 bg-[#D4E9DF] text-[#3F795F] rounded-full text-xs font-semibold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <FolderOpen className="w-10 h-10 text-[#667875]/40 mx-auto" />
            <h3 className="text-base font-bold text-[#173A2C]">No meetings found</h3>
            <p className="text-xs text-[#667875] max-w-sm mx-auto">
              You haven&apos;t recorded or uploaded any meetings yet. Click below to analyze your first academic session.
            </p>
            <div className="pt-2">
              <AnimatedButton
                variant="primary"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsAddMeetingOpen(true)}
              >
                Analyze New Meeting
              </AnimatedButton>
            </div>
          </div>
        )}
      </div>

      {/* Add Meeting Modal */}
      <AddMeetingModal
        isOpen={isAddMeetingOpen}
        onClose={() => setIsAddMeetingOpen(false)}
        onSuccess={fetchLiveMeetings}
      />

    </div>
  );
}
