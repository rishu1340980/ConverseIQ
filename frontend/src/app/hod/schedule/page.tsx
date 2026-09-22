'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  GraduationCap, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  X,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';

export default function HodDepartmentSchedulePage() {
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [facultySessions, setFacultySessions] = useState<any[]>([]);
  const [keyDeadlines, setKeyDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scheduling Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedDuration, setSchedDuration] = useState('45');
  const [schedAttendees, setSchedAttendees] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedError, setSchedError] = useState('');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  const loadSchedule = async () => {
    setLoading(true);
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

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim() || !schedDate) {
      setSchedError('Meeting title and date/time are required.');
      return;
    }
    setSchedError('');
    setSchedLoading(true);

    try {
      await apiRequest('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: schedTitle.trim(),
          date: new Date(schedDate).toISOString(),
          duration_minutes: parseInt(schedDuration) || 45,
          status: 'Scheduled',
          participants: schedAttendees.trim(),
        }),
      });

      // Reset & Reload
      setSchedTitle('');
      setSchedDate('');
      setSchedDuration('45');
      setSchedAttendees('');
      setIsScheduleModalOpen(false);
      await loadSchedule();
    } catch (err: any) {
      setSchedError(err.message || 'Failed to schedule meeting. Please try again.');
    } finally {
      setSchedLoading(false);
    }
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const currentMonthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push({ day: '', empty: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && d === today.getDate();
    // Check if there are scheduled meetings or deadlines on this day
    const hasMeeting = upcomingMeetings.some(m => m.day === d);
    const hasDeadline = keyDeadlines.some(dl => dl.day === d);

    calendarDays.push({
      day: String(d),
      isToday,
      hasMeeting,
      hasDeadline,
    });
  }

  const DateBadge = ({ dayText, monthText }: { dayText?: string | number; monthText?: string }) => (
    <div className="w-9 h-10 rounded-md overflow-hidden border border-[#DCE7E2] shadow-xs flex flex-col flex-shrink-0">
      <div className="bg-[#367C88] text-white text-[9px] font-bold text-center py-0.5 leading-none">
        {monthText || currentDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
      </div>
      <div className="bg-white flex-1 flex items-center justify-center text-xs font-bold text-[#173A2C]">
        {dayText || today.getDate()}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
            Department Schedule
          </h1>
          <p className="text-sm text-[#667875] mt-1 font-medium">
            Plan, schedule, and track departmental meetings and faculty academic deadlines
          </p>
        </div>

        <AnimatedButton
          type="button"
          onClick={() => {
            setIsScheduleModalOpen(true);
            setSchedError('');
          }}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
        >
          Schedule Department Meeting
        </AnimatedButton>
      </div>

      {/* Main Grid: Left Calendar (5 cols), Right Schedule Items (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Department Calendar */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#DCE7E2] shadow-xs space-y-5 card-interactive">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#173A2C]">
              {currentMonthName}
            </h2>
            <div className="flex items-center space-x-1 text-[#667875]">
              <button 
                onClick={prevMonth}
                className="p-1 hover:text-[#173A2C] rounded-md hover:bg-[#F5FAF8] transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={nextMonth}
                className="p-1 hover:text-[#173A2C] rounded-md hover:bg-[#F5FAF8] transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#667875]">
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
              <div key={idx} className="flex flex-col items-center justify-center h-9 relative">
                {c.empty ? (
                  <span></span>
                ) : c.isToday ? (
                  <span className="w-7 h-7 rounded-full bg-[#3F795F] text-white flex items-center justify-center font-bold shadow-xs">
                    {c.day}
                  </span>
                ) : (
                  <span className="hover:bg-[#F5FAF8] rounded-full w-7 h-7 flex items-center justify-center cursor-pointer transition-colors">
                    {c.day}
                  </span>
                )}
                {/* Dots for events */}
                <div className="flex space-x-0.5 mt-0.5 absolute bottom-0">
                  {c.hasMeeting && <span className="w-1.5 h-1.5 rounded-full bg-[#3F795F]"></span>}
                  {c.hasDeadline && <span className="w-1.5 h-1.5 rounded-full bg-[#367C88]"></span>}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#DCE7E2] flex items-center justify-between text-[11px] text-[#667875]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3F795F]"></span>
              <span>Scheduled Meeting</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#367C88]"></span>
              <span>Action Deadline</span>
            </div>
          </div>
        </div>

        {/* Right: Stacked Schedule Cards */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Card 1: UPCOMING MEETINGS */}
          <div className="bg-white rounded-2xl border border-[#DCE7E2] p-6 shadow-xs card-interactive">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#667875] uppercase tracking-wider mb-5">
              <CalendarIcon className="w-4 h-4 text-[#3F795F]" />
              <span>UPCOMING DEPARTMENT MEETINGS ({upcomingMeetings.length})</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#667875]">Loading schedule...</div>
            ) : upcomingMeetings.length > 0 ? (
              <div className="divide-y divide-[#DCE7E2]">
                {upcomingMeetings.map((item, idx) => (
                  <div
                    key={idx}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between hover:bg-[#F5FAF8] px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <DateBadge dayText={item.day} />
                      <div>
                        <h3 className="text-base font-bold text-[#173A2C]">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#667875] font-medium mt-0.5">
                          {item.dateInfo}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 bg-[#D4E9DF] text-[#173A2C] rounded-full text-xs font-bold border border-[#78A98F]/40">
                      {item.status || 'Scheduled'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-4 text-center">
                No upcoming department meetings scheduled. Click &quot;Schedule Department Meeting&quot; above to create one.
              </p>
            )}
          </div>

          {/* Card 2: KEY DEADLINES */}
          <div className="bg-white rounded-2xl border border-[#DCE7E2] p-6 shadow-xs card-interactive">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#667875] uppercase tracking-wider mb-5">
              <Clock className="w-4 h-4 text-[#367C88]" />
              <span>FACULTY ACTION DEADLINES ({keyDeadlines.length})</span>
            </div>

            {keyDeadlines.length > 0 ? (
              <div className="divide-y divide-[#DCE7E2]">
                {keyDeadlines.map((item, idx) => (
                  <div
                    key={idx}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between hover:bg-[#F5FAF8] px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <DateBadge dayText={item.day} />
                      <div>
                        <h3 className="text-base font-bold text-[#173A2C]">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#667875] font-medium mt-0.5">
                          Assigned: <span className="font-semibold text-[#173A2C]">{item.owner || 'Faculty'}</span> • Due: {item.dateInfo}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-4 text-center">
                No upcoming faculty action item deadlines pending.
              </p>
            )}
          </div>

          {/* Card 3: FACULTY SESSIONS */}
          <div className="bg-white rounded-2xl border border-[#DCE7E2] p-6 shadow-xs card-interactive">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#667875] uppercase tracking-wider mb-4">
              <GraduationCap className="w-4 h-4 text-[#3F795F]" />
              <span>FACULTY SESSIONS</span>
            </div>

            {facultySessions.length > 0 ? (
              <div className="divide-y divide-[#DCE7E2]">
                {facultySessions.map((item, idx) => (
                  <div
                    key={idx}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center space-x-4 hover:bg-[#F5FAF8] px-2 rounded-xl transition-colors"
                  >
                    <DateBadge dayText={item.day} />
                    <div>
                      <h3 className="text-sm font-bold text-[#173A2C]">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#667875] font-medium mt-0.5">
                        {item.dateInfo}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] py-2 text-center">
                No separate faculty academic sessions scheduled.
              </p>
            )}
          </div>

        </div>

      </div>

      {/* Schedule Meeting Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-xl w-full max-w-lg p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-[#3F795F]" />
                <h2 className="text-lg font-bold text-[#173A2C]">
                  Schedule Department Meeting
                </h2>
              </div>
              <button 
                onClick={() => setIsScheduleModalOpen(false)} 
                className="text-gray-400 hover:text-[#173A2C] p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                  Meeting Title / Topic <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="e.g. End Semester Curriculum Review"
                  className="w-full px-3.5 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Date &amp; Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Estimated Duration
                  </label>
                  <select
                    value={schedDuration}
                    onChange={(e) => setSchedDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                  >
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="90">1.5 Hours</option>
                    <option value="120">2 Hours</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                  Invited Faculty / Attendees (Optional)
                </label>
                <input
                  type="text"
                  value={schedAttendees}
                  onChange={(e) => setSchedAttendees(e.target.value)}
                  placeholder="Comma-separated names, e.g. Prof. Sharma, Dr. Verma"
                  className="w-full px-3.5 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                />
              </div>

              {schedError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {schedError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <AnimatedButton
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </AnimatedButton>
                <AnimatedButton
                  type="submit"
                  variant="primary"
                  isLoading={schedLoading}
                  className="flex-1"
                >
                  Schedule Meeting
                </AnimatedButton>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
