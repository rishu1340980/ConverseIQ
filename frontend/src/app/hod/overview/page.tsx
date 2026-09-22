'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Folder, 
  Hourglass, 
  TrendingUp, 
  ArrowRight,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { apiRequest, getCurrentStoredUser } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { BarChartVisualizer } from '@/components/ui/ChartCard';

export default function HodDepartmentOverviewPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [facultyCompletions, setFacultyCompletions] = useState<any[]>([]);
  const [weeklyMeetings, setWeeklyMeetings] = useState<any[]>([]);
  const [urgentActions, setUrgentActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getCurrentStoredUser();
    if (u) setUser(u);

    const loadHodOverview = async () => {
      try {
        const data = await apiRequest('/dashboard/hod');
        if (data) {
          setStats(data.metrics);
          if (data.faculty_performance) setFacultyCompletions(data.faculty_performance);
          if (data.weekly_meetings) setWeeklyMeetings(data.weekly_meetings);
          if (data.urgent_actions) setUrgentActions(data.urgent_actions);
        }
      } catch (err) {
        console.warn('HOD dashboard data load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHodOverview();
  }, []);

  const displayName = user?.name || 'Prof. Mehta';
  const departmentName = user?.department_name || 'Computer Science & Engineering';

  // Format weekly meetings for BarChartVisualizer
  const chartItems = weeklyMeetings.map((b: any) => ({
    label: b.week || 'Wk',
    value: b.count ?? 0,
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D4E9DF] text-[#173A2C] uppercase tracking-wider">
              Department Governance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173A2C] tracking-tight mt-1">
            Good Morning, {displayName} 👋
          </h1>
          <p className="text-sm text-[#667875] mt-1 font-medium">
            Executive oversight &amp; academic productivity for <span className="font-bold text-[#173A2C]">{departmentName}</span>.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            href="/hod/schedule"
            className="btn-interactive inline-flex items-center space-x-2 px-4 py-2.5 bg-white border border-[#DCE7E2] hover:bg-[#F5FAF8] text-[#173A2C] text-sm font-bold rounded-xl shadow-xs"
          >
            <Calendar className="w-4 h-4 text-[#78A98F]" />
            <span>Schedule Meeting</span>
          </Link>
          <Link
            href="/hod/faculty"
            className="btn-interactive inline-flex items-center space-x-2 px-4 py-2.5 bg-[#78A98F] hover:bg-[#5A9175] text-white text-sm font-bold rounded-xl shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Faculty Roster</span>
          </Link>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          label="Faculty Members"
          value={stats?.total_faculty ?? 0}
          icon={<Users className="w-5 h-5" />}
          variant="sage"
          subtitle="Department roster"
        />
        <StatCard
          label="Meetings This Month"
          value={stats?.meetings_this_month ?? 0}
          icon={<Folder className="w-5 h-5" />}
          variant="softblue"
          subtitle="Transcribed sessions"
        />
        <StatCard
          label="Pending Action Items"
          value={stats?.pending_actions ?? 0}
          icon={<Hourglass className="w-5 h-5" />}
          variant="amber"
          subtitle="Awaiting sign-off"
        />
        <StatCard
          label="Completion Rate"
          value={`${stats?.completion_rate ?? 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          variant="light"
          subtitle="Department efficiency"
        />
      </div>

      {/* Middle Section: Faculty Action Completion + Weekly Meetings Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Faculty Action Completion */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#DCE7E2] p-6 shadow-sm card-interactive flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-[#173A2C]">
                  Faculty Action Completion
                </h2>
                <p className="text-xs text-[#667875] mt-0.5">Individual task resolution efficiency</p>
              </div>
              <Link 
                href="/hod/faculty"
                className="text-xs font-bold text-[#3F795F] hover:text-[#173A2C] flex items-center space-x-1"
              >
                <span>View Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {facultyCompletions.length > 0 ? (
              <div className="space-y-4 pt-1">
                {facultyCompletions.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#173A2C]">{item.name}</span>
                      <span className="text-[#3F795F] font-bold">{item.rate}%</span>
                    </div>
                    <div className="w-full bg-[#EDF5F2] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#78A98F] h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(0, item.rate))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-8 text-center">
                No faculty task completions recorded yet.
              </p>
            )}
          </div>
        </div>

        {/* Right: Department Meetings Trend Visualizer */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#DCE7E2] p-6 shadow-sm card-interactive flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-[#173A2C]">
                  Department Meetings Trend
                </h2>
                <p className="text-xs text-[#667875] mt-0.5">Weekly meeting cadence and duration</p>
              </div>
              <span className="text-xs font-bold text-[#367C88] bg-[#E4F2F4] px-2.5 py-1 rounded-full">
                Weekly Cadence
              </span>
            </div>

            {chartItems.length > 0 ? (
              <BarChartVisualizer
                items={chartItems}
                height={140}
                barColor="#3F795F"
                secondaryColor="#B9DDE3"
              />
            ) : (
              <p className="text-xs text-[#667875] py-12 text-center">
                No weekly meetings trend data available yet.
              </p>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#DCE7E2] grid grid-cols-2 text-center divide-x divide-[#DCE7E2]">
            <div>
              <p className="text-base font-black text-[#173A2C]">{stats?.avg_duration || '0m'}</p>
              <p className="text-xs text-[#667875] font-semibold mt-0.5">Avg Duration</p>
            </div>
            <div>
              <p className="text-base font-black text-[#173A2C]">{stats?.avg_participants || 0}</p>
              <p className="text-xs text-[#667875] font-semibold mt-0.5">Avg Attendees</p>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section: Urgent Department Actions */}
      <div className="bg-white rounded-2xl border border-[#DCE7E2] p-6 shadow-sm card-interactive">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#173A2C]">
              Urgent Department Actions
            </h2>
            <p className="text-xs text-[#667875] mt-0.5">High-priority tasks requiring HOD oversight</p>
          </div>
          <Link
            href="/hod/action-tracker"
            className="text-xs font-bold text-[#3F795F] hover:text-[#173A2C] flex items-center space-x-1 transition-colors"
          >
            <span>View All Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {urgentActions.length > 0 ? (
          <div className="divide-y divide-[#DCE7E2]/70">
            {urgentActions.map((action, idx) => (
              <div
                key={idx}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F5FAF8] px-2 rounded-xl transition-colors"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#173A2C]">
                    {action.task}
                  </p>
                  <p className="text-xs text-[#667875]">
                    Assigned to: <span className="font-semibold text-[#173A2C]">{action.assignedTo}</span> • {action.deadline}
                  </p>
                </div>

                <span className="inline-flex items-center px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold self-start sm:self-center">
                  {action.priority}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#667875] py-6 text-center">
            No urgent department action items pending at this time.
          </p>
        )}
      </div>
    </div>
  );
}
