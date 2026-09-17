'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface ActionItem {
  id: string | number;
  task: string;
  assignedTo: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
}

export default function HodActionTrackerPage() {
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLiveItems = async () => {
      try {
        const live = await apiRequest<any[]>('/action-items');
        if (live && live.length > 0) {
          const mapped: ActionItem[] = live.map((it) => ({
            id: it.id,
            task: it.task,
            assignedTo: it.owner_name || 'Assigned Faculty',
            deadline: it.due_date ? new Date(it.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Upcoming',
            priority: (it.priority as any) || 'Medium',
            status: it.status === 'Completed' ? 'Completed' : (it.status || 'Pending'),
          }));
          setActionItems(mapped);
        } else {
          setActionItems([]);
        }
      } catch (err) {
        console.warn('HOD action tracker load error:', err);
        setActionItems([]);
      } finally {
        setLoading(false);
      }
    };
    loadLiveItems();
  }, []);

  const filteredItems = activeTab === 'All' 
    ? actionItems 
    : actionItems.filter(item => item.status === activeTab);

  const getPriorityBadgeClass = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'High':
        return 'bg-[#FEECEB] text-[#DC2626]';
      case 'Medium':
        return 'bg-[#FFF3E8] text-[#EA580C]';
      case 'Low':
        return 'bg-[#F0F4F1] text-[#4B7258]';
    }
  };

  const getStatusBadgeClass = (status: ActionItem['status']) => {
    switch (status) {
      case 'Completed':
        return 'bg-[#E5F2E8] text-[#2E6930]';
      case 'In Progress':
        return 'bg-[#FEF3C7] text-[#D97706]';
      case 'Pending':
        return 'bg-[#F5F3EF] text-[#78716C]';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Department Action Tracker
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 font-medium">
          All action items assigned across department members
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1.5 bg-[#F3EFE6] p-1 rounded-xl w-fit text-xs font-semibold">
        {(['All', 'Pending', 'In Progress', 'Completed'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-white text-[#1C251E] shadow-sm font-bold'
                : 'text-gray-500 hover:text-[#1C251E]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#45644F] mx-auto mb-3"></div>
            <span>Loading department action items...</span>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E5DA] text-xs font-semibold text-gray-400">
                  <th className="py-4 px-6 font-medium">Task</th>
                  <th className="py-4 px-6 font-medium">Assigned To</th>
                  <th className="py-4 px-6 font-medium">Deadline</th>
                  <th className="py-4 px-6 font-medium">Priority</th>
                  <th className="py-4 px-6 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DA] text-sm">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-[#FAF9F5] transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-[#1C251E]">
                      {item.task}
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-medium">
                      {item.assignedTo}
                    </td>
                    <td className="py-4 px-6 text-gray-500 font-medium">
                      {item.deadline}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <CheckSquare className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-[#1C251E]">No action items found</h3>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              Department action items will be automatically listed here once meetings are analyzed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
