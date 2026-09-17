'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Video, 
  Hourglass, 
  Calendar, 
  Target, 
  ArrowRight, 
  Plus,
  CheckSquare
} from 'lucide-react';
import { apiRequest, getCurrentStoredUser } from '@/lib/api';
import AddMeetingModal from '@/components/AddMeetingModal';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  useEffect(() => {
    const u = getCurrentStoredUser();
    if (u) setUser(u);

    const loadDashboard = async () => {
      try {
        const data = await apiRequest('/dashboard/faculty');
        if (data) {
          setDashboardData(data);
          if (data.priority_action_items) {
            setActionItems(data.priority_action_items.map((it: any) => ({
              id: it.id,
              title: it.task,
              date: it.due_date ? new Date(it.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Upcoming',
              priority: it.priority || 'Medium',
              completed: it.status === 'Completed',
            })));
          }
          if (data.recent_meetings) {
            setRecentMeetings(data.recent_meetings);
          }
          if (data.upcoming_events) {
            setUpcomingEvents(data.upcoming_events);
          }
        }
      } catch (err) {
        console.warn('Dashboard fetch failed or returned empty:', err);
      }
    };
    loadDashboard();
  }, []);

  const toggleAction = async (id: number | string) => {
    setActionItems(prev =>
      prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item)
    );
    try {
      await apiRequest(`/action-items/${id}/toggle`, { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to toggle on backend:', err);
    }
  };

  const displayName = user?.name || user?.full_name || 'Faculty';

  return (
    <div className="space-y-8 max-w-6xl">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
            Good Morning, {displayName} 👋
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Here's what's happening with your meetings and tasks.
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

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Total Meetings */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex flex-col justify-between space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5F2E5] text-[#2E6838] flex items-center justify-center">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-bold text-[#1C251E] tracking-tight block">
              {dashboardData?.metrics?.total_meetings ?? 0}
            </span>
            <span className="text-xs text-[#6B7280] font-medium">
              Total Meetings
            </span>
          </div>
        </div>

        {/* Card 2: Pending Action Items */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex flex-col justify-between space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#FBF0D9] text-[#9A6B1F] flex items-center justify-center">
            <Hourglass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-bold text-[#1C251E] tracking-tight block">
              {String(dashboardData?.metrics?.pending_action_items ?? 0).padStart(2, '0')}
            </span>
            <span className="text-xs text-[#6B7280] font-medium">
              Pending Action Items
            </span>
          </div>
        </div>

        {/* Card 3: Upcoming Deadlines */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex flex-col justify-between space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#FCE6E4] text-[#B53D35] flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-bold text-[#1C251E] tracking-tight block">
              {String(dashboardData?.metrics?.upcoming_deadlines_count ?? 0).padStart(2, '0')}
            </span>
            <span className="text-xs text-[#6B7280] font-medium">
              Upcoming Deadlines
            </span>
          </div>
        </div>

        {/* Card 4: Upcoming Sessions */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex flex-col justify-between space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#E3F0EC] text-[#2A7263] flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-bold text-[#1C251E] tracking-tight block">
              {String(dashboardData?.metrics?.upcoming_sessions_count ?? 0).padStart(2, '0')}
            </span>
            <span className="text-xs text-[#6B7280] font-medium">
              Upcoming Sessions
            </span>
          </div>
        </div>

      </div>

      {/* Recent Meetings Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#E8E5DA] shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#1C251E] tracking-tight">
            Recent Meetings
          </h2>
          <Link
            href="/meetings"
            className="text-xs font-semibold text-[#6B7280] hover:text-[#1C251E] flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentMeetings.length > 0 ? (
          <div className="divide-y divide-[#E8E5DA]/60">
            {recentMeetings.map((m: any) => (
              <div key={m.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#45644F] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {m.title?.charAt(0)?.toUpperCase() || 'M'}
                  </div>
                  <div>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="text-sm font-bold text-[#1C251E] hover:text-[#45644F] transition-colors block"
                    >
                      {m.title}
                    </Link>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {m.participant_count || 1} Participants
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-[#E1EFE1] text-[#2E6838] rounded-full text-xs font-semibold">
                  {m.status || 'Analysis Complete'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-[#6B7280]">
            <Video className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700">No meetings analyzed yet</p>
            <p className="text-gray-400 mt-0.5">Start a live meeting or upload an audio recording to get started.</p>
          </div>
        )}

        <div className="pt-2">
          <Link
            href="/meetings"
            className="inline-block px-4 py-2 bg-[#EAE7DC] hover:bg-[#DDD8CA] text-[#1C251E] text-xs font-semibold rounded-xl transition-colors"
          >
            View All Meetings
          </Link>
        </div>
      </div>

      {/* Bottom 2-Column Split: Upcoming This Week & Priority Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Upcoming This Week */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E5DA] shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#1C251E] tracking-tight">
            Upcoming This Week
          </h3>

          {upcomingEvents.length > 0 ? (
            <div className="space-y-3.5">
              {upcomingEvents.map((evt: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-[#FAF9F5] transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-[#1C251E]">
                      {evt.title}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {evt.date_info}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-[#E5EFE5] text-[#3D6846] rounded-full text-xs font-medium">
                    {evt.type || 'Event'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#6B7280]">
              <Calendar className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="font-semibold text-gray-700">No upcoming events scheduled</p>
              <p className="text-gray-400 mt-0.5">Scheduled meetings and deadlines will show up here.</p>
            </div>
          )}
        </div>

        {/* Right Column: Priority Action Items */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E5DA] shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#1C251E] tracking-tight">
            Priority Action Items
          </h3>

          {actionItems.length > 0 ? (
            <div className="space-y-3.5">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#FAF9F5] transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleAction(item.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#45644F] focus:ring-[#45644F] cursor-pointer"
                    />
                    <span className={`text-sm font-medium ${item.completed ? 'line-through text-gray-400' : 'text-[#1C251E]'}`}>
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-[#6B7280]">{item.date}</span>
                    <span className={`font-bold ${item.priority === 'High' ? 'text-[#B94038]' : 'text-[#B45309]'}`}>
                      {item.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#6B7280]">
              <CheckSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="font-semibold text-gray-700">No pending action items</p>
              <p className="text-gray-400 mt-0.5">Tasks extracted from meetings will appear here.</p>
            </div>
          )}
        </div>

      </div>

      {/* Add Meeting Modal */}
      <AddMeetingModal
        isOpen={isAddMeetingOpen}
        onClose={() => setIsAddMeetingOpen(false)}
      />

    </div>
  );
}
