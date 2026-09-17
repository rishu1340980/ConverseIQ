'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LayoutGrid, 
  List, 
  Search, 
  ChevronDown, 
  Users, 
  Clock, 
  CheckCircle2, 
  ListTodo,
  FileText,
  Plus
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface MoMCard {
  id: number | string;
  badge: string;
  badgeBg: string;
  title: string;
  department: string;
  date: string;
  summary: string;
  tags: string[];
  attendees: number;
  duration: string;
  decisionsCount: number;
  actionsCount: number;
}

export default function MoMSummariesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [momList, setMomList] = useState<MoMCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveMoMs();
  }, []);

  const fetchLiveMoMs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any[]>('/meetings');
      if (res && res.length > 0) {
        const mapped: MoMCard[] = res.map((m, idx) => ({
          id: m.id,
          badge: m.title.charAt(0).toUpperCase(),
          badgeBg: ['bg-[#45644F]', 'bg-[#385240]', 'bg-[#4A6B53]', 'bg-[#557A60]'][idx % 4],
          title: m.title,
          department: m.department_name || 'Computer Science',
          date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          summary: m.mom?.summary || 'Meeting summary and discussion details will appear here once analysis is complete.',
          tags: m.tags || ['Academics', 'Faculty'],
          attendees: m.participant_count || 1,
          duration: `${m.duration_minutes || 45}m`,
          decisionsCount: m.mom?.decisions?.length || 0,
          actionsCount: m.action_items_count || 0,
        }));
        setMomList(mapped);
      } else {
        setMomList([]);
      }
    } catch (err) {
      console.warn('MoM fetch error:', err);
      setMomList([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = momList.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.department.toLowerCase().includes(search.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const totalDecisions = momList.reduce((acc, m) => acc + m.decisionsCount, 0);
  const totalActions = momList.reduce((acc, m) => acc + m.actionsCount, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      
      {/* Header Row & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
            MoM &amp; Summaries
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Minutes of meeting and AI-generated summaries from all analyzed sessions.
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="bg-[#F3EFE6] p-1 rounded-xl flex items-center space-x-1 border border-[#E8E5DA] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-[#1C251E] shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            title="Table View"
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'table'
                ? 'bg-white text-[#1C251E] shadow-sm'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top 3 Stat Counter Pills */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white rounded-xl px-4 py-2 border border-[#E8E5DA] shadow-sm text-sm">
          <span className="font-bold text-[#1C251E]">{momList.length}</span>{' '}
          <span className="text-[#6B7280]">Total MoMs</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-2 border border-[#E8E5DA] shadow-sm text-sm">
          <span className="font-bold text-[#1C251E]">{totalDecisions}</span>{' '}
          <span className="text-[#6B7280]">Total Decisions</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-2 border border-[#E8E5DA] shadow-sm text-sm">
          <span className="font-bold text-[#1C251E]">{totalActions}</span>{' '}
          <span className="text-[#6B7280]">Total Action Items</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by meeting, department, or topic..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E8E5DA] rounded-xl text-sm text-[#1C251E] focus:ring-2 focus:ring-[#45644F] outline-none shadow-sm transition-all"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#45644F] mx-auto mb-3"></div>
          <span>Loading Minutes of Meeting...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] p-12 text-center space-y-3 shadow-sm">
          <FileText className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-[#1C251E]">No Minutes of Meeting generated yet</h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Once meetings are processed, structured executive summaries, formal resolutions, and action items will appear here.
          </p>
          <Link
            href="/meetings"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#45644F] text-white text-xs font-semibold rounded-xl hover:bg-[#385240] transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Go to Meetings</span>
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 border border-[#E8E5DA] shadow-sm space-y-4 hover:border-[#45644F] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl ${item.badgeBg} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}>
                      {item.badge}
                    </div>
                    <div>
                      <Link
                        href={`/meetings/${item.id}`}
                        className="text-sm font-bold text-[#1C251E] hover:text-[#45644F] transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {item.date} • {item.department}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-gray-700" />
                </div>

                <p className="text-xs text-[#4B5563] leading-relaxed mt-3.5 line-clamp-3">
                  {item.summary}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-3.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 bg-[#EAEFEA] text-[#2F4E36] rounded-full text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8E5DA]/60 flex items-center space-x-4 text-[11px] text-[#6B7280] font-medium">
                <span className="flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span>{item.attendees}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>{item.duration}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{item.decisionsCount} decisions</span>
                </span>
                <span className="flex items-center space-x-1">
                  <ListTodo className="w-3.5 h-3.5 text-amber-600" />
                  <span>{item.actionsCount} actions</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E5DA] text-[12px] font-semibold text-[#6B7280]">
                  <th className="py-4 px-6">Meeting</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-4 text-center">Decisions</th>
                  <th className="py-4 px-4 text-center">Actions</th>
                  <th className="py-4 px-6 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DA]/60 text-sm">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#FAF9F5] transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <Link
                        href={`/meetings/${item.id}`}
                        className="flex items-center space-x-3"
                      >
                        <div className={`w-8 h-8 rounded-xl ${item.badgeBg} text-white flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                          {item.badge}
                        </div>
                        <span className="font-bold text-[#1C251E] group-hover:text-[#45644F] transition-colors">
                          {item.title}
                        </span>
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-[#4B5563]">
                      {item.department}
                    </td>
                    <td className="py-4 px-6 text-[#4B5563]">
                      {item.date}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EAEFEA] text-[#2F4E36] font-bold text-xs">
                        {item.decisionsCount}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EAEFEA] text-[#2F4E36] font-bold text-xs">
                        {item.actionsCount}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/meetings/${item.id}`}
                        className="px-3 py-1.5 bg-white border border-[#E8E5DA] hover:bg-[#FAF9F5] text-xs font-semibold rounded-lg text-[#1C251E] transition-colors inline-block"
                      >
                        View MoM
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
