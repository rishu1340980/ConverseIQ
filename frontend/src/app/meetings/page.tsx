'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ChevronDown, 
  Plus, 
  Video,
  FolderOpen
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AddMeetingModal from '@/components/AddMeetingModal';

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
        const liveItems: MeetingItem[] = res.map((m, idx) => ({
          id: m.id,
          badge: m.title.charAt(0).toUpperCase(),
          badgeBg: ['bg-[#45644F]', 'bg-[#385240]', 'bg-[#4A6B53]', 'bg-[#557A60]'][idx % 4],
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
    <div className="space-y-6 max-w-6xl">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
            Meetings
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            All previously analyzed meetings and recordings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddMeetingOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#45644F] hover:bg-[#385240] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Analyze New Meeting</span>
        </button>
      </div>

      {/* Controls: Search & Sort Dropdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8E5DA] rounded-xl text-sm text-[#1C251E] focus:ring-2 focus:ring-[#45644F] focus:border-[#45644F] outline-none transition-all shadow-sm"
          />
        </div>

        <div className="relative w-full sm:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="appearance-none w-full sm:w-44 px-4 py-2.5 bg-white border border-[#E8E5DA] rounded-xl text-sm font-medium text-[#1C251E] focus:ring-2 focus:ring-[#45644F] outline-none shadow-sm cursor-pointer pr-10"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Meetings Table Card */}
      <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#45644F] mx-auto mb-3"></div>
            <span>Loading meetings...</span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E5DA] text-[12px] font-semibold text-[#6B7280]">
                  <th className="py-4 px-6">Meeting Title</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Participants</th>
                  <th className="py-4 px-6">Duration</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DA]/60 text-sm">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#FAF9F5] transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <Link
                        href={`/meetings/${item.id}`}
                        className="flex items-center space-x-3.5"
                      >
                        <div className={`w-9 h-9 rounded-xl ${item.badgeBg} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}>
                          {item.badge}
                        </div>
                        <span className="font-bold text-[#1C251E] group-hover:text-[#45644F] transition-colors">
                          {item.title}
                        </span>
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-[#4B5563]">
                      {item.date}
                    </td>
                    <td className="py-4 px-6 text-[#4B5563]">
                      {item.participants}
                    </td>
                    <td className="py-4 px-6 text-[#4B5563]">
                      {item.duration}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center px-3 py-1 bg-[#E1EFE1] text-[#2E6838] rounded-full text-xs font-semibold">
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
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-[#1C251E]">No meetings found</h3>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              You haven&apos;t recorded or uploaded any meetings yet. Click below to analyze your first academic session.
            </p>
            <button
              onClick={() => setIsAddMeetingOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#45644F] text-white text-xs font-semibold rounded-xl hover:bg-[#385240] transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Analyze New Meeting</span>
            </button>
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
