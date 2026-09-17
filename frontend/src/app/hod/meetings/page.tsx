'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Folder, FolderOpen } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface DepartmentMeeting {
  id: string | number;
  initial: string;
  title: string;
  host: string;
  date: string;
  participants: number;
  duration: string;
  status: string;
}

export default function HodDepartmentMeetingsPage() {
  const [meetings, setMeetings] = useState<DepartmentMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLiveMeetings = async () => {
      try {
        const live = await apiRequest<any[]>('/meetings');
        if (live && live.length > 0) {
          const mapped: DepartmentMeeting[] = live.map((m) => ({
            id: m.id,
            initial: m.title.charAt(0).toUpperCase(),
            title: m.title,
            host: m.participants?.[0]?.name || 'Prof. Mehta',
            date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            participants: m.participant_count || (m.participants?.length || 1),
            duration: `${m.duration_minutes || 45}m`,
            status: m.status || 'Analysis Complete',
          }));
          setMeetings(mapped);
        } else {
          setMeetings([]);
        }
      } catch (err) {
        console.warn('HOD department meetings load error:', err);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    };
    loadLiveMeetings();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Department Meetings
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 font-medium">
          All meetings recorded within your department
        </p>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#45644F] mx-auto mb-3"></div>
            <span>Loading department meetings...</span>
          </div>
        ) : meetings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E5DA] text-xs font-semibold text-gray-400">
                  <th className="py-4 px-6 font-medium">Meeting</th>
                  <th className="py-4 px-6 font-medium">Host</th>
                  <th className="py-4 px-6 font-medium">Date</th>
                  <th className="py-4 px-6 font-medium">Participants</th>
                  <th className="py-4 px-6 font-medium">Duration</th>
                  <th className="py-4 px-6 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DA] text-sm">
                {meetings.map((meeting) => (
                  <tr 
                    key={meeting.id}
                    className="hover:bg-[#FAF9F5] transition-colors"
                  >
                    <td className="py-4 px-6">
                      <Link href={`/meetings/${meeting.id}`} className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4E6B56] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                          {meeting.initial}
                        </div>
                        <span className="font-semibold text-[#1C251E] hover:text-[#45644F] transition-colors">
                          {meeting.title}
                        </span>
                      </Link>
                    </td>

                    <td className="py-4 px-6 text-gray-600 font-medium">
                      {meeting.host}
                    </td>

                    <td className="py-4 px-6 text-gray-500 font-medium">
                      {meeting.date}
                    </td>

                    <td className="py-4 px-6 text-gray-600 font-medium">
                      {meeting.participants}
                    </td>

                    <td className="py-4 px-6 text-gray-500 font-medium">
                      {meeting.duration}
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-3 py-1 bg-[#E5F2E8] text-[#2E6930] rounded-full text-xs font-semibold">
                        {meeting.status}
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
            <h3 className="text-base font-bold text-[#1C251E]">No department meetings yet</h3>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              Meetings conducted or uploaded by department faculty will be listed here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
