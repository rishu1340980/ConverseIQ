'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Folder, 
  Hourglass, 
  TrendingUp, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { apiRequest, getCurrentStoredUser } from '@/lib/api';

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
  const departmentName = user?.department_name || 'Computer Science Department';

  const kpiData = [
    {
      label: 'Faculty Members',
      value: stats?.total_faculty ?? 0,
      icon: Users,
      iconBg: 'bg-[#E8F4F8]',
      iconColor: 'text-[#2B7897]',
    },
    {
      label: 'Meetings This Month',
      value: stats?.meetings_this_month ?? 0,
      icon: Folder,
      iconBg: 'bg-[#FDF6E2]',
      iconColor: 'text-[#B88B22]',
    },
    {
      label: 'Pending Action Items',
      value: stats?.pending_actions ?? 0,
      icon: Hourglass,
      iconBg: 'bg-[#FEF2E8]',
      iconColor: 'text-[#D97706]',
    },
    {
      label: 'Completion Rate',
      value: `${stats?.completion_rate ?? 0}%`,
      icon: TrendingUp,
      iconBg: 'bg-[#FEECEB]',
      iconColor: 'text-[#DC2626]',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Good Morning, {displayName} 👋
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 font-medium">
          {departmentName}
        </p>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiData.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-3xl font-extrabold text-[#1C251E] tracking-tight">
                  {kpi.value}
                </p>
                <p className="text-xs text-[#6B7280] font-medium mt-1">
                  {kpi.label}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Section: Faculty Action Completion + Meetings per Week */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Faculty Action Completion */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-[#1C251E]">
                Faculty Action Completion
              </h2>
              <Link 
                href="/hod/faculty"
                className="text-xs font-semibold text-[#45644F] hover:underline flex items-center space-x-1"
              >
                <span>View Details</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {facultyCompletions.length > 0 ? (
              <div className="space-y-4">
                {facultyCompletions.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1C251E]">{item.name}</span>
                      <span className="font-bold text-[#1C251E]">{item.rate}%</span>
                    </div>
                    <div className="w-full bg-[#EFECE6] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#45644F] h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-8 text-center">
                No faculty task completions recorded yet.
              </p>
            )}
          </div>
        </div>

        {/* Right Card: Meetings per Week */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1C251E] mb-6">
              Department Meetings Trend
            </h2>

            {weeklyMeetings.length > 0 ? (
              <div className="h-44 flex items-end justify-between px-6 pb-2 pt-4">
                {weeklyMeetings.map((bar, idx) => (
                  <div key={idx} className="flex flex-col items-center space-y-2 group">
                    <span className="text-xs font-bold text-[#1C251E]">
                      {bar.count}
                    </span>
                    <div className="w-12 sm:w-14 bg-[#EFECE6] rounded-t-lg flex items-end h-28 overflow-hidden">
                      <div 
                        className="w-full bg-[#45644F] rounded-t-lg transition-all duration-500 group-hover:bg-[#385240]"
                        style={{ height: bar.height || `${Math.min(100, bar.count * 20)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      {bar.week}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-12 text-center">
                No weekly meetings trend data available yet.
              </p>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#E8E5DA] grid grid-cols-2 text-center divide-x divide-[#E8E5DA]">
            <div>
              <p className="text-base font-bold text-[#1C251E]">{stats?.avg_duration || '0m'}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Avg Duration</p>
            </div>
            <div>
              <p className="text-base font-bold text-[#1C251E]">{stats?.avg_participants || 0}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Avg Participants</p>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section: Urgent Department Actions */}
      <div className="bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#1C251E]">
            Urgent Department Actions
          </h2>
          <Link
            href="/hod/action-tracker"
            className="text-xs font-semibold text-[#45644F] hover:underline flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {urgentActions.length > 0 ? (
          <div className="divide-y divide-[#E8E5DA]">
            {urgentActions.map((action, idx) => (
              <div
                key={idx}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F5] px-2 rounded-xl transition-colors"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1C251E]">
                    {action.task}
                  </p>
                  <p className="text-xs text-gray-500">
                    Assigned to: <span className="font-medium text-gray-700">{action.assignedTo}</span> • {action.deadline}
                  </p>
                </div>

                <span className="inline-flex items-center px-3 py-1 bg-[#FEECEB] text-[#DC2626] rounded-full text-xs font-semibold self-start sm:self-center">
                  {action.priority}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-6 text-center">
            No urgent department action items pending at this time.
          </p>
        )}
      </div>
    </div>
  );
}
