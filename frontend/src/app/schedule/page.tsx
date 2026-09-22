'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  GraduationCap, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AddMeetingModal from '@/components/AddMeetingModal';

import AnimatedButton from '@/components/ui/AnimatedButton';

export default function SchedulePage() {
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [facultySessions, setFacultySessions] = useState<any[]>([]);
  const [keyDeadlines, setKeyDeadlines] = useState<any[]>([]);
  const [reminders, setReminders] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    try {
      const data = await apiRequest('/dashboard/faculty');
      if (data && data.schedule) {
        if (data.schedule.meetings) setUpcomingMeetings(data.schedule.meetings);
        if (data.schedule.sessions) setFacultySessions(data.schedule.sessions);
        if (data.schedule.deadlines) setKeyDeadlines(data.schedule.deadlines);
      }
    } catch (err) {
      console.warn('Schedule data load error:', err);
    }
  };

  const toggleReminder = (key: string) => {
    setReminders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentDate = new Date();
  const currentMonthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const currentDay = currentDate.getDate();

  // Dynamic calendar days for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push({ day: '', empty: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      day: String(d),
      selected: d === currentDay,
      active: false
    });
  }

  const DateBadge = ({ dateText }: { dateText?: string }) => {
    return (
      <div className="w-9 h-10 rounded-lg overflow-hidden border border-[#DCE7E2] shadow-2xs flex flex-col flex-shrink-0">
        <div className="bg-[#367C88] text-white text-[9px] font-bold text-center py-0.5 leading-none uppercase">
          {currentDate.toLocaleString('en-US', { month: 'short' })}
        </div>
        <div className="bg-white flex-1 flex items-center justify-center text-xs font-bold text-[#173A2C]">
          {dateText ? dateText.slice(-2) : currentDay}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
            Schedule &amp; Reminders
          </h1>
          <p className="text-sm text-[#667875] mt-0.5">
            {currentMonthName}
          </p>
        </div>

        <AnimatedButton
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddMeetingOpen(true)}
        >
          Schedule New Meeting
        </AnimatedButton>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Mini Calendar */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#DCE7E2] shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#173A2C]">
              {currentMonthName}
            </h2>
            <div className="flex items-center space-x-1 text-[#667875]">
              <button className="p-1.5 hover:text-[#173A2C] rounded-lg hover:bg-[#F5FAF8] transition-colors cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:text-[#173A2C] rounded-lg hover:bg-[#F5FAF8] transition-colors cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#667875]/70">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-medium text-[#173A2C]">
            {calendarDays.map((c, idx) => (
              <div key={idx} className="flex items-center justify-center h-8">
                {c.empty ? (
                  <span></span>
                ) : c.selected ? (
                  <span className="w-7 h-7 rounded-full bg-[#3F795F] text-white flex items-center justify-center font-bold shadow-xs">
                    {c.day}
                  </span>
                ) : (
                  <span className="hover:bg-[#F5FAF8] rounded-full w-7 h-7 flex items-center justify-center cursor-pointer transition-colors">
                    {c.day}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Stacked Cards */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Card 1: Upcoming Meetings */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#367C88] tracking-wider uppercase">
              <CalendarIcon className="w-3.5 h-3.5 text-[#367C88]" />
              <span>UPCOMING MEETINGS</span>
            </div>

            {upcomingMeetings.length > 0 ? (
              <div className="space-y-3 divide-y divide-[#DCE7E2]/60">
                {upcomingMeetings.map((m: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between pt-2 first:pt-0">
                    <div className="flex items-center space-x-3">
                      <DateBadge dateText={m.date} />
                      <div>
                        <p className="text-sm font-bold text-[#173A2C]">{m.title}</p>
                        <p className="text-xs text-[#667875] mt-0.5">{m.date_info}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-[#667875]">Remind</span>
                      <button
                        type="button"
                        onClick={() => toggleReminder(`meet-${idx}`)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          reminders[`meet-${idx}`] ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                          reminders[`meet-${idx}`] ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-3 text-center">No upcoming meetings scheduled.</p>
            )}
          </div>

          {/* Card 2: Upcoming Sessions */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#3F795F] tracking-wider uppercase">
              <GraduationCap className="w-3.5 h-3.5 text-[#3F795F]" />
              <span>FACULTY SESSIONS</span>
            </div>

            {facultySessions.length > 0 ? (
              <div className="space-y-3 divide-y divide-[#DCE7E2]/60">
                {facultySessions.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between pt-2 first:pt-0">
                    <div className="flex items-center space-x-3">
                      <DateBadge dateText={s.date} />
                      <div>
                        <p className="text-sm font-bold text-[#173A2C]">{s.title}</p>
                        <p className="text-xs text-[#667875] mt-0.5">{s.date_info}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-3 text-center">No faculty sessions scheduled.</p>
            )}
          </div>

          {/* Card 3: Important Deadlines */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-rose-700 tracking-wider uppercase">
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              <span>KEY DEADLINES</span>
            </div>

            {keyDeadlines.length > 0 ? (
              <div className="space-y-3 divide-y divide-[#DCE7E2]/60">
                {keyDeadlines.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between pt-2 first:pt-0">
                    <div className="flex items-center space-x-3">
                      <DateBadge dateText={d.due_date} />
                      <div>
                        <p className="text-sm font-bold text-[#173A2C]">{d.title}</p>
                        <p className="text-xs text-[#667875] mt-0.5">{d.date_info}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-3 text-center">No immediate deadlines pending.</p>
            )}
          </div>

        </div>

      </div>

      <AddMeetingModal
        isOpen={isAddMeetingOpen}
        onClose={() => setIsAddMeetingOpen(false)}
      />

    </div>
  );
}
