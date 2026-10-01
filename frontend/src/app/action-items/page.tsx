'use client';

import React, { useState, useEffect } from 'react';
import { Search, CheckSquare, Check, Calendar, User, Clock, AlertTriangle, FileDown } from 'lucide-react';
import { apiRequest, downloadFile } from '@/lib/api';
import SegmentedControl from '@/components/ui/SegmentedControl';
import AnimatedButton from '@/components/ui/AnimatedButton';
import Skeleton from '@/components/ui/Skeleton';

interface Task {
  id: number | string;
  title: string;
  assignee: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  category: 'urgent' | 'upcoming' | 'completed';
}

export default function ActionItemsPage() {
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadLiveTasks();
  }, []);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await downloadFile('/reports/action-items/pdf', 'ConverseIQ_Action_Items.pdf');
    } catch (err: any) {
      alert(err.message || 'Failed to export Action Items PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const loadLiveTasks = async () => {
    setLoading(true);
    try {
      const liveItems = await apiRequest<any[]>('/action-items');
      if (liveItems && liveItems.length > 0) {
        const mapped: Task[] = liveItems.map((item) => ({
          id: item.id,
          title: item.task,
          assignee: item.owner_name || 'Assigned Faculty',
          dueDate: item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Upcoming',
          priority: (item.priority as any) || 'Medium',
          status: item.status === 'Completed' ? 'Completed' : (item.status || 'Pending'),
          category: item.status === 'Completed' ? 'completed' : item.priority === 'High' ? 'urgent' : 'upcoming',
        }));
        setTasks(mapped);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.warn('Action items fetch error:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (id: number | string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'Completed' ? 'Pending' : 'Completed';
          return {
            ...t,
            status: nextStatus,
            category: nextStatus === 'Completed' ? 'completed' : (t.priority === 'High' ? 'urgent' : 'upcoming'),
          };
        }
        return t;
      })
    );

    try {
      await apiRequest(`/action-items/${id}/toggle`, { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to toggle action item on backend:', err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesTab =
      activeTab === 'All'
        ? true
        : activeTab === 'Pending'
        ? t.status === 'Pending'
        : activeTab === 'In Progress'
        ? t.status === 'In Progress'
        : t.status === 'Completed';

    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.assignee.toLowerCase().includes(search.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const urgentTasks = filteredTasks.filter((t) => t.category === 'urgent' && t.status !== 'Completed');
  const upcomingTasks = filteredTasks.filter((t) => t.category === 'upcoming' && t.status !== 'Completed');
  const completedTasks = filteredTasks.filter((t) => t.status === 'Completed');

  const pendingCount = tasks.filter((t) => t.status !== 'Completed').length;
  const highPriorityCount = tasks.filter((t) => t.priority === 'High' && t.status !== 'Completed').length;
  const upcomingCount = tasks.filter((t) => t.category === 'upcoming' && t.status !== 'Completed').length;

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] dark:text-[#E8F0EC] tracking-tight">
            Action Items
          </h1>
          <p className="text-sm text-[#667875] dark:text-[#8FA89C] mt-1">
            Track deliverables and deadlines distilled from institutional meetings.
          </p>
        </div>
        <AnimatedButton
          variant="outline"
          size="sm"
          icon={<FileDown className="w-4 h-4 text-rose-500" />}
          onClick={handleExportPdf}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting PDF...' : 'Export PDF Report'}
        </AnimatedButton>
      </div>

      {/* Top 3 Summary Pills */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="px-4 py-1.5 bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#367C88] dark:text-[#4DA3B0] border border-[#B9DDE3] dark:border-[#2A5A63] rounded-xl text-xs font-semibold shadow-2xs">
          {pendingCount} Pending Tasks
        </span>
        <span className="px-4 py-1.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold shadow-2xs">
          {highPriorityCount} High Priority
        </span>
        <span className="px-4 py-1.5 bg-[#D4E9DF] dark:bg-[#243D33] text-[#3F795F] dark:text-[#78A98F] border border-[#78A98F]/30 rounded-xl text-xs font-semibold shadow-2xs">
          {upcomingCount} Upcoming Deadlines
        </span>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto">
          <SegmentedControl
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            options={[
              { id: 'All', label: 'All' },
              { id: 'Pending', label: 'Pending' },
              { id: 'In Progress', label: 'In Progress' },
              { id: 'Completed', label: 'Completed' },
            ]}
          />
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#667875] dark:text-[#8FA89C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or faculty..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1A2B24] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#173A2C] dark:text-[#E8F0EC] placeholder:text-[#667875] dark:text-[#8FA89C]/60 focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none shadow-2xs transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1A2B24] rounded-2xl p-5 border border-[#DCE7E2] dark:border-[#2D4A3E] flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-3.5 flex-1">
                <Skeleton className="w-5 h-5 rounded-md" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-[#1A2B24] rounded-2xl border border-[#DCE7E2] dark:border-[#2D4A3E] p-12 text-center space-y-3 shadow-sm">
          <CheckSquare className="w-10 h-10 text-[#667875] dark:text-[#8FA89C]/30 mx-auto" />
          <h3 className="text-base font-bold text-[#173A2C] dark:text-[#E8F0EC]">No action items found</h3>
          <p className="text-xs text-[#667875] dark:text-[#8FA89C] max-w-sm mx-auto">
            Tasks extracted from your institutional sessions will be displayed here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group 1: 🔴 URGENT */}
          {urgentTasks.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-rose-700 tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-rose-50 dark:bg-rose-950/300 animate-ping"></span>
                <span>Urgent Actions ({urgentTasks.length})</span>
              </div>

              <div className="space-y-2.5">
                {urgentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#1A2B24] rounded-2xl p-4 sm:p-5 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm flex items-center justify-between space-x-4 hover:border-[#78A98F] transition-all hover:shadow-md"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                          task.status === 'Completed'
                            ? 'bg-[#3F795F] border-[#3F795F] text-white shadow-xs'
                            : 'border-[#DCE7E2] dark:border-[#2D4A3E] hover:border-[#78A98F] bg-white dark:bg-[#1A2B24]'
                        }`}
                      >
                        {task.status === 'Completed' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#173A2C] dark:text-[#E8F0EC] truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-[#667875] dark:text-[#8FA89C] mt-0.5 truncate">
                          {task.assignee} • {task.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[11px] font-bold">
                        High
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-medium border ${
                        task.status === 'In Progress'
                          ? 'bg-[#FEF3C7] text-[#92400E] border-amber-200'
                          : 'bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C] border-[#DCE7E2] dark:border-[#2D4A3E]'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group 2: 🟡 UPCOMING */}
          {upcomingTasks.length > 0 && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-amber-50 dark:bg-amber-950/300"></span>
                <span>Upcoming Deadlines ({upcomingTasks.length})</span>
              </div>

              <div className="space-y-2.5">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#1A2B24] rounded-2xl p-4 sm:p-5 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm flex items-center justify-between space-x-4 hover:border-[#78A98F] transition-all hover:shadow-md"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                          task.status === 'Completed'
                            ? 'bg-[#3F795F] border-[#3F795F] text-white shadow-xs'
                            : 'border-[#DCE7E2] dark:border-[#2D4A3E] hover:border-[#78A98F] bg-white dark:bg-[#1A2B24]'
                        }`}
                      >
                        {task.status === 'Completed' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#173A2C] dark:text-[#E8F0EC] truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-[#667875] dark:text-[#8FA89C] mt-0.5 truncate">
                          {task.assignee} • {task.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                        task.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-[#D4E9DF] dark:bg-[#243D33] text-[#3F795F] dark:text-[#78A98F] border-[#78A98F]/30'
                      }`}>
                        {task.priority}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-medium border ${
                        task.status === 'In Progress'
                          ? 'bg-[#FEF3C7] text-[#92400E] border-amber-200'
                          : 'bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C] border-[#DCE7E2] dark:border-[#2D4A3E]'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group 3: 🟢 COMPLETED */}
          {completedTasks.length > 0 && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#3F795F] dark:text-[#78A98F] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-[#3F795F]"></span>
                <span>Completed Tasks ({completedTasks.length})</span>
              </div>

              <div className="space-y-2.5">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-[#1A2B24] rounded-2xl p-4 sm:p-5 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-xs flex items-center justify-between space-x-4 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className="w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 bg-[#3F795F] border-[#3F795F] text-white shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#667875] dark:text-[#8FA89C] line-through truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-[#667875] dark:text-[#8FA89C]/70 mt-0.5 truncate">
                          {task.assignee} • {task.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="px-3 py-1 bg-[#D4E9DF] dark:bg-[#243D33] text-[#3F795F] dark:text-[#78A98F] rounded-full text-[11px] font-bold border border-[#78A98F]/30">
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
