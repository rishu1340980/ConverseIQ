'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Folder, FolderOpen, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface DepartmentMeeting {
  id: string | number;
  initial: string;
  title: string;
  host: string;
  date: string;
  rawDate: Date;
  participants: number;
  duration: string;
  status: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function HodDepartmentMeetingsPage() {
  const now = new Date();
  const [meetings, setMeetings] = useState<DepartmentMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Build year options: current year and 2 years back
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const loadMeetings = useCallback(async (month: number, year: number) => {
    setLoading(true);
    try {
      const live = await apiRequest<any[]>(`/meetings?month=${month}&year=${year}`);
      if (live && live.length > 0) {
        const mapped: DepartmentMeeting[] = live.map((m) => ({
          id: m.id,
          initial: m.title.charAt(0).toUpperCase(),
          title: m.title,
          host: m.created_by_name || m.participants?.[0]?.name || '—',
          date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rawDate: new Date(m.date),
          participants: m.participant_count || 1,
          duration: `${m.duration_minutes || 45}m`,
          status: m.status || 'Analysis Complete',
        }));
        setMeetings(mapped);
      } else {
        setMeetings([]);
      }
    } catch (err) {
      console.warn('HOD meetings load error:', err);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, loadMeetings]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header with Month/Year Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
            Department Meetings
          </h1>
          <p className="text-sm text-[#667875] mt-1 font-medium">
            All meetings recorded by faculty in your department
          </p>
        </div>

        {/* Month + Year pickers */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="appearance-none bg-white border border-[#DCE7E2] rounded-xl px-4 py-2 pr-8 text-sm font-semibold text-[#173A2C] focus:outline-none focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] cursor-pointer shadow-xs"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667875] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white border border-[#DCE7E2] rounded-xl px-4 py-2 pr-8 text-sm font-semibold text-[#173A2C] focus:outline-none focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] cursor-pointer shadow-xs"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667875] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-xs overflow-hidden card-interactive">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#667875]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#DCE7E2] border-t-[#3F795F] mx-auto mb-3"></div>
            <span>Loading department meetings...</span>
          </div>
        ) : meetings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE7E2] bg-[#F5FAF8]/60 text-xs font-semibold text-[#667875]">
                  <th className="py-3.5 px-6 font-semibold">Meeting</th>
                  <th className="py-3.5 px-6 font-semibold">Host</th>
                  <th className="py-3.5 px-6 font-semibold">Date</th>
                  <th className="py-3.5 px-6 font-semibold">Participants</th>
                  <th className="py-3.5 px-6 font-semibold">Duration</th>
                  <th className="py-3.5 px-6 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7E2] text-sm">
                {meetings.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F5FAF8] transition-colors">
                    <td className="py-4 px-6">
                      <Link
                        href={`/meetings/${m.id}`}
                        className="flex items-center space-x-3 group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#3F795F] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                          {m.initial}
                        </div>
                        <span className="font-semibold text-[#173A2C] group-hover:text-[#3F795F] transition-colors">
                          {m.title}
                        </span>
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-[#667875] font-medium">{m.host}</td>
                    <td className="py-4 px-6 text-[#667875] font-medium">{m.date}</td>
                    <td className="py-4 px-6 text-[#667875]">{m.participants}</td>
                    <td className="py-4 px-6 text-[#667875]">{m.duration}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D4E9DF] text-[#173A2C] border border-[#78A98F]/40">
                        {m.status}
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
            <h3 className="text-base font-bold text-[#173A2C]">No meetings found</h3>
            <p className="text-xs text-[#667875] max-w-sm mx-auto">
              No meetings were recorded in your department for {MONTHS[selectedMonth - 1]} {selectedYear}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
