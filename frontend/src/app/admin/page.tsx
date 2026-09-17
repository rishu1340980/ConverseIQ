'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  Activity, 
  FileText, 
  BarChart3, 
  Sliders, 
  AlertTriangle,
  Search,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Eye
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { AdminDashboardData, User, AuditLog } from '@/types';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'departments' | 'analytics' | 'audit' | 'settings'>('overview');
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Settings State
  const [instName, setInstName] = useState('National Institute of Engineering & Technology');
  const [aiModel, setAiModel] = useState('meta-llama/llama-3.3-70b-instruct');
  const [retentionDays, setRetentionDays] = useState(180);
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(true);
  const [enableAutoTranscription, setEnableAutoTranscription] = useState(true);
  const [enable2FA, setEnable2FA] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Audit filter state
  const [auditSeverity, setAuditSeverity] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [dRes, uRes, deptRes, aRes, logsRes] = await Promise.all([
        apiRequest<AdminDashboardData>('/dashboard/admin').catch(() => null),
        apiRequest<any[]>('/users').catch(() => []),
        apiRequest<any[]>('/departments').catch(() => []),
        apiRequest<any>('/analytics').catch(() => null),
        apiRequest<AuditLog[]>('/audit').catch(() => []),
      ]);

      if (dRes) setDashboard(dRes);
      setUsers(uRes);
      setDepartments(deptRes);
      if (aRes) setAnalytics(aRes);
      setAuditLogs(logsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentActive: boolean) => {
    try {
      await apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentActive }),
      });
      const updatedUsers = await apiRequest<any[]>('/users');
      setUsers(updatedUsers);
    } catch (err) {
      alert('Failed to update user account status');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditSeverity && log.severity !== auditSeverity) return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      return log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header & Back to Faculty View */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 uppercase tracking-wider">
              Administration Suite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
            Institutional Governance & Oversight
          </h1>
        </div>

      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'overview' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Institution Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'users' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'departments' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'analytics' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics & Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'audit' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Log</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'settings' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>System Settings</span>
        </button>
      </div>

      {/* Tab 1: Institution Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Total Faculty</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{dashboard?.total_faculty ?? 4}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Meetings Analyzed</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{dashboard?.total_meetings ?? 1}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Actions Tracked</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{dashboard?.action_items_tracked ?? 3}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Active Depts</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{dashboard?.active_departments ?? 2}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Completion Rate</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">
                {dashboard?.completion_percentage ?? 33.3}%
              </h3>
            </div>
          </div>

          {/* Department Activity & Live Alerts Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <span>Department Activity Breakdown</span>
              </h3>
              <div className="divide-y divide-gray-100">
                {dashboard?.department_activity && dashboard.department_activity.length > 0 ? (
                  dashboard.department_activity.map((dept, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-800">{dept.department_name}</span>
                      <div className="text-xs text-gray-500 space-x-3">
                        <span>{dept.faculty_count} Faculty</span>
                        <span>•</span>
                        <span>{dept.meeting_count} Meetings</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 py-4">No activity logged.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Live System Alerts Feed</span>
              </h3>
              <div className="space-y-3">
                {dashboard?.system_alerts && dashboard.system_alerts.length > 0 ? (
                  dashboard.system_alerts.map((alert) => (
                    <div key={alert.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                      <div className="flex items-center justify-between font-bold text-amber-900">
                        <span>{alert.action}</span>
                        <span className="text-[10px] font-normal text-amber-700">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-amber-800 mt-1">{alert.details}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 py-4">No active security alerts.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: User Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Institution Faculty &amp; HOD Accounts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">User Name</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Meetings</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-gray-100 text-gray-800">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{u.department_name}</td>
                    <td className="px-6 py-4 text-gray-600">{u.meeting_count}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                        className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                          u.is_active
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Departments */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Academic Departments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4">Faculty Count</th>
                  <th className="px-6 py-4">Meetings</th>
                  <th className="px-6 py-4">Pending Actions</th>
                  <th className="px-6 py-4">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td className="px-6 py-4 font-semibold text-gray-900">{d.name}</td>
                    <td className="px-6 py-4 text-gray-600">{d.faculty_count}</td>
                    <td className="px-6 py-4 text-gray-600">{d.meeting_count}</td>
                    <td className="px-6 py-4 text-gray-600">{d.pending_actions}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{d.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Analytics */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Avg Meeting Duration</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{analytics.stats.avg_meeting_duration_mins} mins</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Actions Per Meeting</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{analytics.stats.actions_per_meeting}</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Action Completion Rate</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{analytics.stats.action_completion_rate}%</h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">AI Queries This Month</p>
              <h3 className="text-2xl font-black text-blue-600 mt-1">{analytics.stats.ai_queries_this_month}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <h4 className="font-bold text-gray-900 mb-4">6-Month Meeting &amp; Action Item Trends</h4>
            <div className="grid grid-cols-6 gap-2 text-center text-xs">
              {analytics.meetings_vs_actions_trend?.map((t: any, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                  <span className="font-bold text-gray-500 block mb-2">{t.month}</span>
                  <div className="text-blue-600 font-bold">{t.meetings} Mtgs</div>
                  <div className="text-amber-600 font-medium">{t.actions} Actions</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <h3 className="font-bold text-gray-900 text-base">Security &amp; Operational Audit Log</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={auditSeverity}
                onChange={(e) => setAuditSeverity(e.target.value)}
                className="px-3 py-1.5 border rounded-xl text-xs font-semibold"
              >
                <option value="">All Severities</option>
                <option value="Info">Info</option>
                <option value="OK">OK</option>
                <option value="Warn">Warn</option>
                <option value="Alert">Alert</option>
              </select>

              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search action or details..."
                className="px-3 py-1.5 border rounded-xl text-xs flex-1 sm:w-56"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gray-900 flex items-center space-x-2">
                      <span>{log.action}</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] uppercase font-extrabold ${
                        log.severity === 'Alert' ? 'bg-red-100 text-red-800' :
                        log.severity === 'Warn' ? 'bg-amber-100 text-amber-800' :
                        log.severity === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {log.severity}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-0.5">{log.details}</p>
                  </div>
                  <span className="text-gray-400 whitespace-nowrap ml-4">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 py-6 text-center">No logs matching criteria.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: System Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 max-w-2xl">
          <h3 className="font-bold text-gray-900 text-lg">Institutional Configuration &amp; Feature Toggles</h3>

          {settingsSaved && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>System settings updated successfully!</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Institution Name</label>
              <input
                type="text"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">AI MoM Extraction Model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct (OpenRouter)</option>
                <option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data Retention Period (Days)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableEmailAlerts}
                  onChange={(e) => setEnableEmailAlerts(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Enable Automated Email Notifications</span>
              </label>

              <label className="flex items-center space-x-2 text-sm font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutoTranscription}
                  onChange={(e) => setEnableAutoTranscription(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Enable Automated Audio Diarization &amp; Transcription</span>
              </label>

              <label className="flex items-center space-x-2 text-sm font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enable2FA}
                  onChange={(e) => setEnable2FA(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Enforce Two-Factor Authentication (2FA) for Faculty Accounts</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
          >
            Save Configuration
          </button>
        </form>
      )}

    </div>
  );
}
