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
  Plus,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';
import Skeleton from '@/components/ui/Skeleton';

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
        const badgeColors = [
          'bg-[#3F795F] text-white',
          'bg-[#367C88] text-white',
          'bg-[#78A98F] text-white',
          'bg-[#4B8B9B] text-white',
        ];
        const mapped: MoMCard[] = res.map((m, idx) => ({
          id: m.id,
          badge: m.title.charAt(0).toUpperCase(),
          badgeBg: badgeColors[idx % badgeColors.length],
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
    <div className="space-y-6 max-w-6xl animate-fade-in">
      
      {/* Header Row & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
            MoM &amp; Summaries
          </h1>
          <p className="text-sm text-[#667875] mt-1">
            Minutes of meeting and AI-generated summaries from all analyzed sessions.
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="bg-[#F5FAF8] p-1 rounded-xl flex items-center space-x-1 border border-[#DCE7E2] self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-[#173A2C] shadow-sm font-bold'
                : 'text-[#667875] hover:text-[#173A2C]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            title="Table View"
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-[#173A2C] shadow-sm font-bold'
                : 'text-[#667875] hover:text-[#173A2C]'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top 3 Stat Counter Pills */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white rounded-xl px-4 py-2 border border-[#DCE7E2] shadow-2xs text-sm">
          <span className="font-bold text-[#173A2C]">{momList.length}</span>{' '}
          <span className="text-[#667875]">Total MoMs</span>
        </div>
        <div className="bg-[#D4E9DF]/50 rounded-xl px-4 py-2 border border-[#78A98F]/30 shadow-2xs text-sm">
          <span className="font-bold text-[#3F795F]">{totalDecisions}</span>{' '}
          <span className="text-[#3F795F]">Total Decisions</span>
        </div>
        <div className="bg-[#E4F2F4]/60 rounded-xl px-4 py-2 border border-[#B9DDE3] shadow-2xs text-sm">
          <span className="font-bold text-[#367C88]">{totalActions}</span>{' '}
          <span className="text-[#367C88]">Total Action Items</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-[#667875] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by meeting, department, or topic..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] placeholder:text-[#667875]/60 focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none shadow-2xs transition-all"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-[#DCE7E2] space-y-4">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE7E2] p-12 text-center space-y-3 shadow-sm">
          <FileText className="w-10 h-10 text-[#667875]/30 mx-auto" />
          <h3 className="text-base font-bold text-[#173A2C]">No Minutes of Meeting generated yet</h3>
          <p className="text-xs text-[#667875] max-w-sm mx-auto">
            Once meetings are processed, structured executive summaries, formal resolutions, and action items will appear here.
          </p>
          <div className="pt-2">
            <Link href="/meetings">
              <AnimatedButton
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Go to Meetings
              </AnimatedButton>
            </Link>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 border border-[#DCE7E2] shadow-sm space-y-4 hover:border-[#78A98F] transition-all flex flex-col justify-between hover:shadow-md card-interactive"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl ${item.badgeBg} flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-2xs`}>
                      {item.badge}
                    </div>
                    <div>
                      <Link
                        href={`/meetings/${item.id}`}
                        className="text-sm font-bold text-[#173A2C] hover:text-[#3F795F] transition-colors line-clamp-1"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs text-[#667875] mt-0.5">
                        {item.date} • {item.department}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/meetings/${item.id}`}
                    className="text-[#667875] hover:text-[#3F795F] p-1 rounded-lg hover:bg-[#F5FAF8] transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <p className="text-xs text-[#667875] leading-relaxed mt-3.5 line-clamp-3 bg-[#F5FAF8] p-3 rounded-xl border border-[#DCE7E2]/50">
                  {item.summary}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-3.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 bg-[#E4F2F4] text-[#367C88] border border-[#B9DDE3] rounded-full text-[11px] font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#DCE7E2] flex items-center justify-between text-[11px] text-[#667875] font-medium">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-[#78A98F]" />
                    <span>{item.attendees}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-[#78A98F]" />
                    <span>{item.duration}</span>
                  </span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center space-x-1 text-[#3F795F] font-semibold bg-[#D4E9DF]/60 px-2 py-0.5 rounded-md border border-[#78A98F]/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{item.decisionsCount} decisions</span>
                  </span>
                  <span className="flex items-center space-x-1 text-[#367C88] font-semibold bg-[#E4F2F4] px-2 py-0.5 rounded-md border border-[#B9DDE3]">
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>{item.actionsCount} actions</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE7E2] text-[12px] font-semibold text-[#667875] bg-[#F5FAF8]/50">
                  <th className="py-4 px-6">Meeting</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-4 text-center">Decisions</th>
                  <th className="py-4 px-4 text-center">Actions</th>
                  <th className="py-4 px-6 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7E2]/60 text-sm">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F5FAF8] transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <Link
                        href={`/meetings/${item.id}`}
                        className="flex items-center space-x-3"
                      >
                        <div className={`w-8 h-8 rounded-xl ${item.badgeBg} flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                          {item.badge}
                        </div>
                        <span className="font-bold text-[#173A2C] group-hover:text-[#3F795F] transition-colors">
                          {item.title}
                        </span>
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-[#667875] text-xs">
                      {item.department}
                    </td>
                    <td className="py-4 px-6 text-[#667875] text-xs">
                      {item.date}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#D4E9DF] text-[#3F795F] font-bold text-xs border border-[#78A98F]/30">
                        {item.decisionsCount}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#E4F2F4] text-[#367C88] font-bold text-xs border border-[#B9DDE3]">
                        {item.actionsCount}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Link
                        href={`/meetings/${item.id}`}
                        className="px-3 py-1.5 bg-white border border-[#DCE7E2] hover:bg-[#F5FAF8] hover:border-[#78A98F] text-xs font-semibold rounded-xl text-[#173A2C] transition-colors inline-block shadow-2xs"
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
