'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  GraduationCap, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Send,
  Check,
  Video,
  MapPin,
  Users,
  BookOpen,
  Filter,
  Sparkles,
  AlertCircle,
  X,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { apiRequest, getCurrentStoredUser } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';

const ACADEMIC_YEARS = [
  'All Years',
  '1st Year (B.Tech)',
  '2nd Year (B.Tech)',
  '3rd Year (B.Tech)',
  '4th Year (B.Tech)',
  'M.Tech / Research',
];

const DOMAINS = [
  'All Domains',
  'AI & Machine Learning',
  'Cloud & DevOps',
  'Cyber Security',
  'Full Stack Web Development',
  'Data Science & Analytics',
  'Core Systems & IoT',
  'Departmental & Administrative',
];

const DOMAIN_COLORS: { [key: string]: { bg: string; text: string; dot: string } } = {
  'AI & Machine Learning': { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  'Cloud & DevOps': { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
  'Cyber Security': { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  'Full Stack Web Development': { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  'Data Science & Analytics': { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  'Core Systems & IoT': { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  'Departmental & Administrative': { bg: 'bg-stone-50 dark:bg-stone-900/40', text: 'text-stone-700 dark:text-stone-300', dot: 'bg-stone-500' },
};

export default function SchedulePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('All Years');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  
  // Data states
  const [events, setEvents] = useState<any[]>([]);
  const [keyDeadlines, setKeyDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderStatus, setReminderStatus] = useState<{ [id: number]: string }>({});

  // Scheduling Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  
  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formYear, setFormYear] = useState('3rd Year (B.Tech)');
  const [formBatch, setFormBatch] = useState('');
  const [formDomain, setFormDomain] = useState('AI & Machine Learning');
  const [formType, setFormType] = useState('Lecture');
  const [formMode, setFormMode] = useState('Offline');
  const [formVenue, setFormVenue] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formFacultyName, setFormFacultyName] = useState('');
  const [formFacultyEmail, setFormFacultyEmail] = useState('');
  const [formSendEmail, setFormSendEmail] = useState(true);

  useEffect(() => {
    const u = getCurrentStoredUser();
    setCurrentUser(u);
    if (u) {
      setFormFacultyName(u.name || '');
      setFormFacultyEmail(u.email || '');
    }
    loadAllScheduleData();
  }, []);

  const loadAllScheduleData = async () => {
    setLoading(true);
    try {
      // 1. Fetch real schedule events
      const eventsData = await apiRequest('/schedule/events');
      if (Array.isArray(eventsData)) {
        setEvents(eventsData);
      }

      // 2. Fetch faculty dashboard deadlines
      const dashData = await apiRequest('/dashboard/faculty');
      if (dashData && dashData.schedule && dashData.schedule.deadlines) {
        setKeyDeadlines(dashData.schedule.deadlines);
      }
    } catch (err) {
      console.warn('Error loading schedule events:', err);
    } finally {
      setLoading(false);
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
    setSelectedDay(1);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  };

  const openScheduleForDate = (dayNum: number) => {
    setSelectedDay(dayNum);
    const dateObj = new Date(year, month, dayNum, 10, 0);
    // Format to local ISO for datetime-local
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - offset * 60000);
    setFormDate(localDate.toISOString().slice(0, 16));
  };

  // Filter events by academic year and domain
  const filteredEvents = events.filter((ev) => {
    const matchYear = selectedAcademicYear === 'All Years' || ev.academic_year === selectedAcademicYear;
    const matchDomain = selectedDomain === 'All Domains' || ev.domain === selectedDomain;
    return matchYear && matchDomain;
  });

  // Events on the currently selected day
  const selectedDayEvents = filteredEvents.filter((ev) => {
    if (!ev.start_time) return false;
    const evDate = new Date(ev.start_time);
    return (
      evDate.getDate() === selectedDay &&
      evDate.getMonth() === month &&
      evDate.getFullYear() === year
    );
  });

  // Calendar grid construction
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push({ day: 0, empty: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && d === today.getDate();
    const isSelected = d === selectedDay;

    // Check if events exist on day d
    const dayEvs = filteredEvents.filter((ev) => {
      if (!ev.start_time) return false;
      const dt = new Date(ev.start_time);
      return dt.getDate() === d && dt.getMonth() === month && dt.getFullYear() === year;
    });

    calendarDays.push({
      day: d,
      empty: false,
      isToday,
      isSelected,
      eventCount: dayEvs.length,
      events: dayEvs,
    });
  }

  // Handle Event Creation
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError('Session title is required.');
      return;
    }
    if (!formDate) {
      setModalError('Please pick a start date and time.');
      return;
    }
    setModalError('');
    setModalLoading(true);

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        academic_year: formYear,
        target_batch: formBatch.trim() || undefined,
        domain: formDomain,
        event_type: formType,
        delivery_mode: formMode,
        venue_or_link: formVenue.trim() || undefined,
        start_time: new Date(formDate).toISOString(),
        duration_minutes: parseInt(formDuration) || 60,
        faculty_name: formFacultyName.trim() || (currentUser?.name || 'Faculty Member'),
        faculty_email: formFacultyEmail.trim() || (currentUser?.email || 'faculty@converseiq.edu'),
        send_email_invitation: formSendEmail,
      };

      const resp = await apiRequest('/schedule/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setModalSuccess('Academic session scheduled successfully! Email alert dispatched.');
      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess('');
        setFormTitle('');
        setFormDesc('');
        setFormBatch('');
        loadAllScheduleData();
      }, 900);
    } catch (err: any) {
      setModalError(err.message || 'Failed to schedule academic session.');
    } finally {
      setModalLoading(false);
    }
  };

  // Send Email Reminder Trigger
  const handleSendReminder = async (eventId: number, facultyEmail: string) => {
    setReminderStatus((prev) => ({ ...prev, [eventId]: 'sending' }));
    try {
      await apiRequest(`/schedule/events/${eventId}/send-reminder`, { method: 'POST' });
      setReminderStatus((prev) => ({ ...prev, [eventId]: 'sent' }));
      setTimeout(() => {
        setReminderStatus((prev) => ({ ...prev, [eventId]: '' }));
      }, 3000);
      loadAllScheduleData();
    } catch (err: any) {
      alert(`Could not send reminder: ${err.message || 'Error'}`);
      setReminderStatus((prev) => ({ ...prev, [eventId]: 'failed' }));
    }
  };

  // Cancel Event
  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to cancel this scheduled academic event?')) return;
    try {
      await apiRequest(`/schedule/events/${eventId}`, { method: 'DELETE' });
      loadAllScheduleData();
    } catch (err: any) {
      alert(`Error cancelling event: ${err.message || 'Error'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] dark:text-[#E8F0EC] tracking-tight">
            Academic Schedule &amp; Calendar
          </h1>
          <p className="text-sm text-[#667875] dark:text-[#8FA89C] mt-0.5">
            Coordinate multi-year faculty sessions, lab practicals, curriculum reviews &amp; automated reminders
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={goToToday}
            className="px-3.5 py-2 bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] transition-colors cursor-pointer shadow-2xs"
          >
            Today
          </button>
          <AnimatedButton
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              openScheduleForDate(selectedDay);
              setIsModalOpen(true);
            }}
          >
            Schedule Academic Session
          </AnimatedButton>
        </div>
      </div>

      {/* Filter Ribbon: Academic Year & Domain Tabs */}
      <div className="bg-white dark:bg-[#1A2B24] rounded-2xl p-4 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-2xs space-y-3">
        {/* Academic Year Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-[#667875] dark:text-[#8FA89C] flex items-center space-x-1 flex-shrink-0 mr-1">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Target Year:</span>
          </span>
          {ACADEMIC_YEARS.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedAcademicYear(yr)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedAcademicYear === yr
                  ? 'bg-[#173A2C] text-white shadow-xs'
                  : 'bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC] border border-[#DCE7E2] dark:border-[#2D4A3E]'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>

        {/* Domain Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none border-t border-[#DCE7E2]/60 dark:border-[#2D4A3E]/60 pt-2.5">
          <span className="text-xs font-bold text-[#667875] dark:text-[#8FA89C] flex items-center space-x-1 flex-shrink-0 mr-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Domain:</span>
          </span>
          {DOMAINS.map((dom) => (
            <button
              key={dom}
              onClick={() => setSelectedDomain(dom)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedDomain === dom
                  ? 'bg-[#3F795F] text-white shadow-xs'
                  : 'bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC] border border-[#DCE7E2] dark:border-[#2D4A3E]'
              }`}
            >
              {dom}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Interactive Calendar (5 cols) + Right Selected Day Schedule & Action Items (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Interactive Calendar Card */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1A2B24] rounded-3xl p-6 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#173A2C] dark:text-[#E8F0EC]">
                {currentMonthName}
              </h2>
              <p className="text-xs text-[#667875] dark:text-[#8FA89C]">
                Click any date to view sessions or plan a class
              </p>
            </div>
            <div className="flex items-center space-x-1 text-[#667875] dark:text-[#8FA89C]">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:text-[#173A2C] dark:text-[#E8F0EC] rounded-xl hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] transition-colors cursor-pointer border border-transparent hover:border-[#DCE7E2]"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:text-[#173A2C] dark:text-[#E8F0EC] rounded-xl hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] transition-colors cursor-pointer border border-transparent hover:border-[#DCE7E2]"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#667875] dark:text-[#8FA89C]/70">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
            {calendarDays.map((c, idx) => {
              if (c.empty) {
                return <div key={idx} className="h-11"></div>;
              }

              return (
                <div
                  key={idx}
                  onClick={() => openScheduleForDate(c.day)}
                  className={`h-11 rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all border ${
                    c.isSelected
                      ? 'bg-[#173A2C] text-white border-[#173A2C] shadow-sm font-bold scale-105'
                      : c.isToday
                      ? 'bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#367C88] dark:text-[#4DA3B0] border-[#B9DDE3] dark:border-[#2A5A63] font-bold'
                      : 'hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] text-[#173A2C] dark:text-[#E8F0EC] border-transparent'
                  }`}
                >
                  <span className="text-xs">{c.day}</span>
                  
                  {/* Event indicator dots */}
                  {c.eventCount > 0 && (
                    <div className="flex items-center space-x-0.5 mt-0.5">
                      {c.events.slice(0, 3).map((ev: any, evIdx: number) => {
                        const col = DOMAIN_COLORS[ev.domain]?.dot || 'bg-[#78A98F]';
                        return (
                          <span
                            key={evIdx}
                            className={`w-1.5 h-1.5 rounded-full ${c.isSelected ? 'bg-white' : col}`}
                          />
                        );
                      })}
                      {c.eventCount > 3 && (
                        <span className="text-[8px] leading-none opacity-80">+</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-[#DCE7E2] dark:border-[#2D4A3E] flex flex-wrap items-center justify-between text-[11px] text-[#667875] dark:text-[#8FA89C] gap-2">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>AI/ML</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              <span>Cloud/DevOps</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Security</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Web/Systems</span>
            </div>
          </div>
        </div>

        {/* Right Schedule Items for Selected Date */}
        <div className="lg:col-span-7 space-y-5">

          {/* Banner: Active Selected Date Info */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1A2B24] rounded-2xl border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#E4F2F4] dark:bg-[#1A3A3F] border border-[#B9DDE3] dark:border-[#2A5A63] flex items-center justify-center font-bold text-[#367C88] dark:text-[#4DA3B0] text-sm">
                {selectedDay}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#173A2C] dark:text-[#E8F0EC]">
                  Schedule for {currentMonthName.split(' ')[0]} {selectedDay}, {year}
                </h3>
                <p className="text-xs text-[#667875] dark:text-[#8FA89C]">
                  {selectedDayEvents.length} session{selectedDayEvents.length === 1 ? '' : 's'} scheduled for this date
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                openScheduleForDate(selectedDay);
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 bg-[#3F795F] hover:bg-[#173A2C] text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Event</span>
            </button>
          </div>

          {/* Card: Selected Day's Sessions */}
          <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-6 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#3F795F] dark:text-[#78A98F] uppercase tracking-wider">
                <GraduationCap className="w-4 h-4" />
                <span>ACADEMIC SESSIONS ({selectedDayEvents.length})</span>
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#667875] dark:text-[#8FA89C]">Loading academic schedule...</div>
            ) : selectedDayEvents.length > 0 ? (
              <div className="space-y-4">
                {selectedDayEvents.map((ev) => {
                  const dColor = DOMAIN_COLORS[ev.domain] || { bg: 'bg-[#F5FAF8] dark:bg-[#0F1A15]', text: 'text-[#173A2C] dark:text-[#E8F0EC]', dot: 'bg-[#78A98F]' };
                  const isOnline = ev.delivery_mode === 'Online';
                  const isSent = reminderStatus[ev.id] === 'sent' || ev.reminder_sent;

                  return (
                    <div
                      key={ev.id}
                      className="p-5 rounded-2xl border border-[#DCE7E2] dark:border-[#2D4A3E] bg-[#FDFEFE] dark:bg-[#17251F] hover:border-[#78A98F] transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4E9DF] dark:bg-[#243D33] text-[#173A2C] dark:text-[#E8F0EC]">
                              {ev.academic_year}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dColor.bg} ${dColor.text}`}>
                              {ev.domain}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C] border border-[#DCE7E2] dark:border-[#2D4A3E]">
                              {ev.event_type}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-[#173A2C] dark:text-[#E8F0EC] pt-0.5">
                            {ev.title}
                          </h4>
                          {ev.description && (
                            <p className="text-xs text-[#667875] dark:text-[#8FA89C] line-clamp-2">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        {/* Delete/Cancel Button */}
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="text-[#667875] hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Cancel Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Meta Information Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#667875] dark:text-[#8FA89C] pt-2 border-t border-[#DCE7E2]/60 dark:border-[#2D4A3E]/60">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-[#3F795F]" />
                          <span>{ev.date_formatted} ({ev.duration_minutes}m)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-3.5 h-3.5 text-[#367C88]" />
                          <span>Batch: <strong>{ev.target_batch}</strong></span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isOnline ? <Video className="w-3.5 h-3.5 text-blue-500" /> : <MapPin className="w-3.5 h-3.5 text-stone-500" />}
                          <span className="truncate">
                            {ev.venue_or_link}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">Faculty:</span>
                          <span className="text-[#173A2C] dark:text-[#E8F0EC] truncate">{ev.faculty_name}</span>
                        </div>
                      </div>

                      {/* Action Bar: Send Email Reminder & Virtual Room Link */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div className="flex items-center space-x-2">
                          {isOnline && ev.venue_or_link && (
                            <a
                              href={ev.venue_or_link}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#367C88] dark:text-[#4DA3B0] rounded-xl text-xs font-semibold flex items-center space-x-1 hover:opacity-90 transition-opacity"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Join Studio Link</span>
                            </a>
                          )}
                        </div>

                        {/* HOD / Faculty Reminder Dispatch Button */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleSendReminder(ev.id, ev.faculty_email)}
                            disabled={reminderStatus[ev.id] === 'sending'}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                              isSent
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                : 'bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] text-[#173A2C] dark:text-[#E8F0EC]'
                            }`}
                          >
                            {reminderStatus[ev.id] === 'sending' ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5 animate-spin text-[#367C88]" />
                                <span>Sending Email...</span>
                              </>
                            ) : isSent ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Reminder Sent</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5 text-[#3F795F]" />
                                <span>Send Email Reminder</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-[#667875] dark:text-[#8FA89C]">
                  No sessions scheduled on this date for the selected filters.
                </p>
                <button
                  onClick={() => {
                    openScheduleForDate(selectedDay);
                    setIsModalOpen(true);
                  }}
                  className="text-xs font-bold text-[#3F795F] dark:text-[#78A98F] hover:underline cursor-pointer"
                >
                  + Add session on {currentMonthName.split(' ')[0]} {selectedDay}
                </button>
              </div>
            )}
          </div>

          {/* Card: Pending Faculty Deadlines */}
          <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-6 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-rose-500" />
              <span>FACULTY ACTION DEADLINES</span>
            </div>

            {keyDeadlines.length > 0 ? (
              <div className="space-y-3 divide-y divide-[#DCE7E2] dark:divide-[#2D4A3E]/60">
                {keyDeadlines.map((dl: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between pt-2.5 first:pt-0">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC]">{dl.title}</p>
                      <p className="text-[11px] text-[#667875] dark:text-[#8FA89C]">Due: {dl.date_info}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded text-[10px] font-bold border border-rose-200">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667875] dark:text-[#8FA89C] py-2 text-center">
                No immediate deadlines pending.
              </p>
            )}
          </div>

        </div>

      </div>

      {/* Schedule Academic Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-[#1A2B24] rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-2xl space-y-6 my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE7E2] dark:border-[#2D4A3E]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4E9DF] dark:bg-[#243D33] flex items-center justify-center text-[#173A2C] dark:text-[#E8F0EC]">
                  <GraduationCap className="w-5 h-5 text-[#3F795F]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#173A2C] dark:text-[#E8F0EC]">
                    Schedule Academic Session
                  </h3>
                  <p className="text-xs text-[#667875] dark:text-[#8FA89C]">
                    Plan lectures, workshops, and project reviews with email alerts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] rounded-xl text-[#667875] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                  Session Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep Learning & Transformer Architectures Workshop"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder-[#667875] focus:outline-none focus:ring-2 focus:ring-[#78A98F]/40"
                  required
                />
              </div>

              {/* Target Academic Year & Target Batch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Target Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-medium text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  >
                    {ACADEMIC_YEARS.filter((y) => y !== 'All Years').map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Target Batch / Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CSE-3A, IT-Final Year"
                    value={formBatch}
                    onChange={(e) => setFormBatch(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  />
                </div>
              </div>

              {/* Domain & Event Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Domain / Specialization <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-medium text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  >
                    {DOMAINS.filter((d) => d !== 'All Domains').map((dom) => (
                      <option key={dom} value={dom}>{dom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Event Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-medium text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Lab Session">Lab Session</option>
                    <option value="Project Review">Project Review</option>
                    <option value="Department Meeting">Department Meeting</option>
                    <option value="Guest Seminar">Guest Seminar</option>
                  </select>
                </div>
              </div>

              {/* Delivery Mode & Venue/Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Delivery Mode
                  </label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-medium text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  >
                    <option value="Offline">Offline (Classroom / Lab)</option>
                    <option value="Online">Online (ConverseIQ Video Studio)</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    {formMode === 'Online' ? 'Virtual Meeting Link (Auto-Generated if blank)' : 'Venue / Room'}
                  </label>
                  <input
                    type="text"
                    placeholder={formMode === 'Online' ? 'Auto-generated ConverseIQ Studio' : 'e.g. Room 302, Seminar Hall 1'}
                    value={formVenue}
                    onChange={(e) => setFormVenue(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  />
                </div>
              </div>

              {/* Date & Time, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Start Date &amp; Time (IST) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Duration (Minutes)
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-medium text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  >
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes (1 Hour)</option>
                    <option value="90">90 Minutes (1.5 Hours)</option>
                    <option value="120">120 Minutes (2 Hours)</option>
                  </select>
                </div>
              </div>

              {/* Assigned Faculty Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Faculty In-Charge Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Prof. Sharma"
                    value={formFacultyName}
                    onChange={(e) => setFormFacultyName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                    Faculty Email (for reminder dispatch)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. prof.sharma@converseiq.edu"
                    value={formFacultyEmail}
                    onChange={(e) => setFormFacultyEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none"
                  />
                </div>
              </div>

              {/* Description / Agenda */}
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                  Agenda &amp; Objectives
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Practical lab walkthrough, student project evaluations, and final code reviews."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] focus:outline-none resize-none"
                />
              </div>

              {/* Send Email Reminder Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="sendReminderCheck"
                  checked={formSendEmail}
                  onChange={(e) => setFormSendEmail(e.target.checked)}
                  className="w-4 h-4 rounded text-[#3F795F] focus:ring-[#78A98F] cursor-pointer"
                />
                <label htmlFor="sendReminderCheck" className="text-xs text-[#173A2C] dark:text-[#E8F0EC] cursor-pointer">
                  <strong>Dispatch Instant Email Invitation</strong> to faculty with agenda &amp; venue details
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#DCE7E2] dark:border-[#2D4A3E]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#DCE7E2] dark:border-[#2D4A3E] text-xs font-semibold text-[#667875] hover:text-[#173A2C] dark:hover:text-[#E8F0EC] transition-colors"
                >
                  Cancel
                </button>
                <AnimatedButton
                  variant="primary"
                  type="submit"
                  disabled={modalLoading}
                  icon={<CalendarIcon className="w-4 h-4" />}
                >
                  {modalLoading ? 'Scheduling...' : 'Save & Dispatch Schedule'}
                </AnimatedButton>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
