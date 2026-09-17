'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, GraduationCap, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function HodDepartmentSchedulePage() {
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [facultySessions, setFacultySessions] = useState<any[]>([]);
  const [keyDeadlines, setKeyDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const data = await apiRequest('/dashboard/hod');
      if (data && data.schedule) {
        if (data.schedule.meetings) setUpcomingMeetings(data.schedule.meetings);
        if (data.schedule.sessions) setFacultySessions(data.schedule.sessions);
        if (data.schedule.deadlines) setKeyDeadlines(data.schedule.deadlines);
      }
    } catch (err) {
      console.warn('HOD schedule load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const currentDay = currentDate.getDate();

  const DateBadge = ({ dayText }: { dayText?: string | number }) => (
    <div className="w-9 h-10 rounded-md overflow-hidden border border-[#E8E5DA] shadow-xs flex flex-col flex-shrink-0">
      <div className="bg-[#E05252] text-white text-[9px] font-bold text-center py-0.5 leading-none">
        {currentMonth}
      </div>
      <div className="bg-white flex-1 flex items-center justify-center text-xs font-bold text-[#1C251E]">
        {dayText || currentDay}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Department Schedule
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 font-medium">
          Upcoming meetings and academic deadlines for your department
        </p>
      </div>

      <div className="space-y-5">
        
        {/* Card 1: UPCOMING MEETINGS */}
        <div className="bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">
            <span className="text-[#E05252]">🗓</span>
            <span>UPCOMING MEETINGS</span>
          </div>

          {upcomingMeetings.length > 0 ? (
            <div className="divide-y divide-[#E8E5DA]">
              {upcomingMeetings.map((item, idx) => (
                <div
                  key={idx}
                  className="py-4 first:pt-0 last:pb-0 flex items-center space-x-4 hover:bg-[#FAF9F5] px-2 rounded-xl transition-colors"
                >
                  <DateBadge dayText={item.day} />
                  <div>
                    <h3 className="text-base font-bold text-[#1C251E]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {item.dateInfo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280] py-3 text-center">No upcoming meetings scheduled.</p>
          )}
        </div>

        {/* Card 2: FACULTY SESSIONS */}
        <div className="bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">
            <GraduationCap className="w-4 h-4 text-gray-600" />
            <span>FACULTY SESSIONS</span>
          </div>

          {facultySessions.length > 0 ? (
            <div className="divide-y divide-[#E8E5DA]">
              {facultySessions.map((item, idx) => (
                <div
                  key={idx}
                  className="py-4 first:pt-0 last:pb-0 flex items-center space-x-4 hover:bg-[#FAF9F5] px-2 rounded-xl transition-colors"
                >
                  <DateBadge dayText={item.day} />
                  <div>
                    <h3 className="text-base font-bold text-[#1C251E]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {item.dateInfo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280] py-3 text-center">No faculty sessions scheduled.</p>
          )}
        </div>

        {/* Card 3: KEY DEADLINES */}
        <div className="bg-white rounded-2xl border border-[#E8E5DA] p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-5">
            <Clock className="w-4 h-4 text-[#E05252]" />
            <span>KEY DEADLINES</span>
          </div>

          {keyDeadlines.length > 0 ? (
            <div className="divide-y divide-[#E8E5DA]">
              {keyDeadlines.map((item, idx) => (
                <div
                  key={idx}
                  className="py-4 first:pt-0 last:pb-0 flex items-center space-x-4 hover:bg-[#FAF9F5] px-2 rounded-xl transition-colors"
                >
                  <DateBadge dayText={item.day} />
                  <div>
                    <h3 className="text-base font-bold text-[#1C251E]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {item.dateInfo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280] py-3 text-center">No upcoming deadlines.</p>
          )}
        </div>

      </div>
    </div>
  );
}
