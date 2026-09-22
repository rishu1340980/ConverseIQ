'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import SegmentedControl from '@/components/ui/SegmentedControl';

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
        return 'bg-rose-50 text-rose-600 border border-rose-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Low':
        return 'bg-[#D4E9DF] text-[#173A2C] border border-[#78A98F]/40';
    }
  };

  const getStatusBadgeClass = (status: ActionItem['status']) => {
    switch (status) {
      case 'Completed':
        return 'bg-[#D4E9DF] text-[#173A2C] font-bold border border-[#78A98F]/40';
      case 'In Progress':
        return 'bg-[#E4F2F4] text-[#367C88] font-bold border border-[#B9DDE3]/60';
      case 'Pending':
        return 'bg-[#F5FAF8] text-[#667875] border border-[#DCE7E2] font-semibold';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
          Department Action Tracker
        </h1>
        <p className="text-sm text-[#667875] mt-1 font-medium">
          All action items assigned across department members
        </p>
      </div>

      {/* Filter Tabs via SegmentedControl */}
      <div>
        <SegmentedControl
          options={[
            { id: 'All', label: 'All', count: actionItems.length },
            { id: 'Pending', label: 'Pending', count: actionItems.filter(i => i.status === 'Pending').length },
            { id: 'In Progress', label: 'In Progress', count: actionItems.filter(i => i.status === 'In Progress').length },
            { id: 'Completed', label: 'Completed', count: actionItems.filter(i => i.status === 'Completed').length },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
        />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-xs overflow-hidden card-interactive">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#667875]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#DCE7E2] border-t-[#3F795F] mx-auto mb-3"></div>
            <span>Loading department action items...</span>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCE7E2] bg-[#F5FAF8]/60 text-xs font-semibold text-[#667875]">
                  <th className="py-3.5 px-6 font-semibold">Task</th>
                  <th className="py-3.5 px-6 font-semibold">Assigned To</th>
                  <th className="py-3.5 px-6 font-semibold">Deadline</th>
                  <th className="py-3.5 px-6 font-semibold">Priority</th>
                  <th className="py-3.5 px-6 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7E2] text-sm">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-[#F5FAF8] transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-[#173A2C]">
                      {item.task}
                    </td>
                    <td className="py-4 px-6 text-[#667875] font-medium">
                      {item.assignedTo}
                    </td>
                    <td className="py-4 px-6 text-[#667875] font-medium">
                      {item.deadline}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusBadgeClass(item.status)}`}>
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
            <h3 className="text-base font-bold text-[#173A2C]">No action items found</h3>
            <p className="text-xs text-[#667875] max-w-sm mx-auto">
              Department action items will be automatically listed here once meetings are analyzed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
