'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserCheck } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface FacultyMember {
  initial: string;
  name: string;
  role: string;
  lastActive: string;
  status: 'Active' | 'Inactive';
  meetings: number;
  completionRate: number;
  actionsDone: number;
  actionsTotal: number;
}

export default function HodFacultyPerformancePage() {
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFacultyData();
  }, []);

  const loadFacultyData = async () => {
    try {
      const data = await apiRequest<any[]>('/users?role=Faculty');
      if (data && data.length > 0) {
        const mapped: FacultyMember[] = data.map((u) => ({
          initial: u.name.charAt(0).toUpperCase(),
          name: u.name,
          role: u.designation || 'Faculty',
          lastActive: u.last_active || 'Active',
          status: u.is_active ? 'Active' : 'Inactive',
          meetings: u.meeting_count || 0,
          completionRate: u.completion_rate || 0,
          actionsDone: u.actions_done || 0,
          actionsTotal: u.actions_total || 0,
        }));
        setFacultyList(mapped);
      } else {
        setFacultyList([]);
      }
    } catch (err) {
      console.warn('Faculty data load error:', err);
      setFacultyList([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Faculty Performance
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 font-medium">
          Department Faculty Members ({facultyList.length})
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#45644F] mx-auto mb-3"></div>
          <span>Loading faculty directory...</span>
        </div>
      ) : facultyList.length > 0 ? (
        <div className="space-y-3.5">
          {facultyList.map((faculty, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-[#E8E5DA] p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#D0CBBF] transition-all"
            >
              {/* Left Side: Avatar + Details */}
              <div className="flex items-center space-x-4">
                <div className="w-11 h-11 rounded-full bg-[#4E6B56] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                  {faculty.initial}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-[#1C251E]">
                      {faculty.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        faculty.status === 'Active'
                          ? 'bg-[#E5F2E8] text-[#2E6930]'
                          : 'bg-[#F3F4F6] text-gray-500'
                      }`}
                    >
                      {faculty.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    {faculty.role} • Status: {faculty.lastActive}
                  </p>
                </div>
              </div>

              {/* Right Side: Meetings + Actions Progress */}
              <div className="flex items-center space-x-8 sm:space-x-12 self-end md:self-center">
                {/* Meetings Count */}
                <div className="text-center min-w-[60px]">
                  <p className="text-lg font-bold text-[#1C251E] leading-tight">
                    {faculty.meetings}
                  </p>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Meetings
                  </p>
                </div>

                {/* Actions Progress Bar */}
                <div className="w-32 sm:w-40 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-medium">Actions</span>
                    <span className="font-bold text-[#1C251E]">{faculty.completionRate}%</span>
                  </div>
                  <div className="w-full bg-[#EFECE6] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#45644F] h-full rounded-full transition-all duration-500"
                      style={{ width: `${faculty.completionRate}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium text-right">
                    {faculty.actionsDone}/{faculty.actionsTotal} completed
                  </p>
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] p-12 text-center space-y-3 shadow-sm">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-[#1C251E]">No faculty members registered</h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Faculty registered under your department will be displayed here with their meeting activity and task completion statistics.
          </p>
        </div>
      )}
    </div>
  );
}
