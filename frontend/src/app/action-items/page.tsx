'use client';

import React, { useState, useEffect } from 'react';
import { Search, CheckSquare } from 'lucide-react';
import { apiRequest } from '@/lib/api';

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

  useEffect(() => {
    loadLiveTasks();
  }, []);

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
    <div className="space-y-6 max-w-5xl">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Action Items
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Track and manage your meeting action items and deadlines.
        </p>
      </div>

      {/* Top 3 Summary Pills */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="px-4 py-1.5 bg-[#F3EFE6] text-[#1C251E] rounded-xl text-xs font-semibold shadow-xs">
          {pendingCount} Pending Tasks
        </span>
        <span className="px-4 py-1.5 bg-[#FCE8E6] text-[#B94038] rounded-xl text-xs font-semibold shadow-xs">
          {highPriorityCount} High Priority
        </span>
        <span className="px-4 py-1.5 bg-[#FEF3C7] text-[#92400E] rounded-xl text-xs font-semibold shadow-xs">
          {upcomingCount} Upcoming Deadlines
        </span>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="bg-[#F3EFE6] p-1 rounded-xl flex items-center space-x-1 border border-[#E8E5DA] w-full sm:w-auto">
          {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-[#1C251E] shadow-sm font-bold'
                  : 'text-[#6B7280] hover:text-[#1C251E]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E8E5DA] rounded-xl text-xs text-[#1C251E] focus:ring-2 focus:ring-[#45644F] outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#45644F] mx-auto mb-3"></div>
          <span>Loading action items...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] p-12 text-center space-y-3 shadow-sm">
          <CheckSquare className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-[#1C251E]">No action items found</h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
            Tasks extracted from your meetings will be displayed here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group 1: 🔴 URGENT */}
          {urgentTasks.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#B94038] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-[#B94038]"></span>
                <span>URGENT</span>
              </div>

              <div className="space-y-2.5">
                {urgentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between space-x-4 hover:border-[#45644F]/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.status === 'Completed'}
                        onChange={() => toggleTask(task.id)}
                        className="w-4 h-4 rounded border-gray-300 text-[#45644F] focus:ring-[#45644F] cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C251E] truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                          {task.assignee} • {task.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="px-3 py-1 bg-[#FCE8E6] text-[#B94038] rounded-full text-[11px] font-bold">
                        High
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${
                        task.status === 'In Progress'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : 'bg-[#F3EFE6] text-[#4B5563]'
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
              <div className="flex items-center space-x-2 text-xs font-bold text-[#B45309] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-[#B45309]"></span>
                <span>UPCOMING</span>
              </div>

              <div className="space-y-2.5">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between space-x-4 hover:border-[#45644F]/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.status === 'Completed'}
                        onChange={() => toggleTask(task.id)}
                        className="w-4 h-4 rounded border-gray-300 text-[#45644F] focus:ring-[#45644F] cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C251E] truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                          {task.assignee} • {task.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                        task.priority === 'Medium'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : 'bg-[#E5EFE5] text-[#2E6838]'
                      }`}>
                        {task.priority}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${
                        task.status === 'In Progress'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : 'bg-[#F3EFE6] text-[#4B5563]'
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
              <div className="flex items-center space-x-2 text-xs font-bold text-[#155724] tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-[#155724]"></span>
                <span>COMPLETED</span>
              </div>

              <div className="space-y-2.5">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between space-x-4 opacity-90"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleTask(task.id)}
                        className="w-4 h-4 rounded border-gray-300 text-[#45644F] focus:ring-[#45644F] cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#4B5563] line-through truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                          {task.assignee} • {task.dueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="px-3 py-1 bg-[#FEF3C7] text-[#92400E] rounded-full text-[11px] font-bold">
                        {task.priority}
                      </span>
                      <span className="px-3 py-1 bg-[#E2EFE2] text-[#155724] rounded-full text-[11px] font-medium">
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
