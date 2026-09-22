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
  Eye,
  Check
} from 'lucide-react';
import { apiRequest, getCurrentStoredUser } from '@/lib/api';
import { AdminDashboardData, User, AuditLog } from '@/types';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatCard from '@/components/ui/StatCard';
import AnimatedButton from '@/components/ui/AnimatedButton';

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  const [savingSettings, setSavingSettings] = useState(false);

  // Audit filter state
  const [auditSeverity, setAuditSeverity] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  useEffect(() => {
    const user = getCurrentStoredUser();
    setCurrentUser(user);
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [dRes, uRes, deptRes, aRes, logsRes, sRes] = await Promise.all([
        apiRequest<AdminDashboardData>('/dashboard/admin').catch(() => null),
        apiRequest<any[]>('/users').catch(() => []),
        apiRequest<any[]>('/departments').catch(() => []),
        apiRequest<any>('/analytics').catch(() => null),
        apiRequest<AuditLog[]>('/audit').catch(() => []),
        apiRequest<any>('/admin/settings').catch(() => null),
      ]);

      if (dRes) setDashboard(dRes);
      setUsers(uRes);
      setDepartments(deptRes);
      if (aRes) setAnalytics(aRes);
      setAuditLogs(logsRes);

      if (sRes) {
        if (sRes.institution_name) setInstName(sRes.institution_name);
        if (sRes.ai_model) setAiModel(sRes.ai_model);
        if (sRes.retention_days !== undefined) setRetentionDays(sRes.retention_days);
        if (sRes.enable_email_alerts !== undefined) setEnableEmailAlerts(sRes.enable_email_alerts);
        if (sRes.enable_auto_transcription !== undefined) setEnableAutoTranscription(sRes.enable_auto_transcription);
        if (sRes.enable_2fa !== undefined) setEnable2FA(sRes.enable_2fa);
      }
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
      const [updatedUsers, updatedLogs] = await Promise.all([
        apiRequest<any[]>('/users').catch(() => []),
        apiRequest<AuditLog[]>('/audit').catch(() => []),
      ]);
      setUsers(updatedUsers);
      setAuditLogs(updatedLogs);
    } catch (err) {
      alert('Failed to update user account status');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          institution_name: instName,
          ai_model: aiModel,
          retention_days: retentionDays,
          enable_email_alerts: enableEmailAlerts,
          enable_auto_transcription: enableAutoTranscription,
          enable_2fa: enable2FA,
        }),
      });
      setSettingsSaved(true);
      const updatedLogs = await apiRequest<AuditLog[]>('/audit').catch(() => []);
      setAuditLogs(updatedLogs);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update system settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditSeverity && log.severity !== auditSeverity) return false;
    if (auditSearch) {
      const q = auditSearch.toLowerCase();
      return log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    }
    return true;
  });

  const adminNavTabs = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-3.5 h-3.5" />, count: users.length },
    { id: 'departments', label: 'Departments', icon: <Building2 className="w-3.5 h-3.5" />, count: departments.length },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'audit', label: 'Audit Log', icon: <FileText className="w-3.5 h-3.5" />, count: auditLogs.length },
    { id: 'settings', label: 'Settings', icon: <Sliders className="w-3.5 h-3.5" /> },
  ];

  if (currentUser && currentUser.role !== 'Admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-[#173A2C] mb-2">Access Restricted</h2>
        <p className="text-[#667875] max-w-md text-sm mb-6">
          The Administration Suite is strictly restricted to Institutional Administrators. Your account does not have administrative oversight privileges.
        </p>
        <Link
          href={currentUser.role === 'HOD' ? '/hod/overview' : '/dashboard'}
          className="btn-interactive px-5 py-2.5 bg-[#173A2C] hover:bg-[#2A5643] text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D4E9DF] text-[#173A2C] uppercase tracking-wider">
              Administration Suite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173A2C] tracking-tight mt-1">
            Institutional Governance &amp; Oversight
          </h1>
          <p className="text-sm text-[#667875] mt-1 font-medium">
            System configuration, faculty compliance, user management, and security telemetry.
          </p>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="overflow-x-auto pb-1">
        <SegmentedControl
          options={adminNavTabs}
          activeId={activeTab}
          onChange={(id: any) => setActiveTab(id)}
          size="md"
        />
      </div>

      {/* Tab 1: Institution Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* 5 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Faculty"
              value={dashboard?.total_faculty ?? 0}
              icon={<Users className="w-5 h-5" />}
              variant="sage"
            />
            <StatCard
              label="Meetings Analyzed"
              value={dashboard?.total_meetings ?? 0}
              icon={<Activity className="w-5 h-5" />}
              variant="softblue"
            />
            <StatCard
              label="Actions Tracked"
              value={dashboard?.action_items_tracked ?? 0}
              icon={<FileText className="w-5 h-5" />}
              variant="amber"
            />
            <StatCard
              label="Active Depts"
              value={dashboard?.active_departments ?? 0}
              icon={<Building2 className="w-5 h-5" />}
              variant="light"
            />
            <StatCard
              label="Completion Rate"
              value={`${dashboard?.completion_percentage ?? 0}%`}
              icon={<ShieldCheck className="w-5 h-5" />}
              variant="sage"
            />
          </div>

          {/* Department Activity & Live Alerts Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm p-6 card-interactive">
              <h3 className="font-bold text-[#173A2C] text-base mb-4 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#78A98F]" />
                <span>Department Activity Breakdown</span>
              </h3>
              <div className="divide-y divide-[#DCE7E2]/70">
                {dashboard?.department_activity && dashboard.department_activity.length > 0 ? (
                  dashboard.department_activity.map((dept, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <span className="font-bold text-sm text-[#173A2C]">{dept.department_name}</span>
                      <div className="text-xs text-[#667875] space-x-3 font-semibold">
                        <span>{dept.faculty_count} Faculty</span>
                        <span>•</span>
                        <span>{dept.meeting_count} Meetings</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#667875] py-4 text-center">No department activity logged yet.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm p-6 card-interactive">
              <h3 className="font-bold text-[#173A2C] text-base mb-4 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-[#367C88]" />
                <span>Live System Alerts Feed</span>
              </h3>
              <div className="space-y-3">
                {dashboard?.system_alerts && dashboard.system_alerts.length > 0 ? (
                  dashboard.system_alerts.map((alert) => (
                    <div key={alert.id} className="p-3 bg-[#E4F2F4] border border-[#B9DDE3] rounded-xl text-xs">
                      <div className="flex items-center justify-between font-bold text-[#132F34]">
                        <span>{alert.action}</span>
                        <span className="text-[10px] font-normal text-[#28606A]">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[#1D454C] mt-1">{alert.details}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#667875] py-4 text-center">No active security alerts.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: User Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm overflow-hidden animate-fade-in card-interactive">
          <div className="p-5 border-b border-[#DCE7E2] flex items-center justify-between bg-[#F5FAF8]">
            <h3 className="font-bold text-[#173A2C]">Institution Faculty &amp; HOD Accounts</h3>
            <span className="text-xs font-bold text-[#3F795F] bg-[#D4E9DF] px-2.5 py-1 rounded-full">
              {users.length} Total Users
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#DCE7E2] text-left text-sm">
              <thead className="bg-[#F5FAF8] text-xs font-bold text-[#667875] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">User Name</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Meetings</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7E2]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F5FAF8] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#173A2C]">{u.name}</div>
                      <div className="text-xs text-[#667875]">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-[#E4F2F4] text-[#132F34]">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#667875] font-medium">{u.department_name || '—'}</td>
                    <td className="px-6 py-4 text-[#173A2C] font-bold">{u.meeting_count ?? 0}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${u.is_active ? 'bg-[#D4E9DF] text-[#173A2C]' : 'bg-rose-50 text-rose-700'}`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                        className={`btn-interactive text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                          u.is_active
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'bg-[#D4E9DF] text-[#173A2C] hover:bg-[#BDDEC0]'
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
        <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm overflow-hidden animate-fade-in card-interactive">
          <div className="p-5 border-b border-[#DCE7E2] bg-[#F5FAF8]">
            <h3 className="font-bold text-[#173A2C]">Academic Departments Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#DCE7E2] text-left text-sm">
              <thead className="bg-[#F5FAF8] text-xs font-bold text-[#667875] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Department Name</th>
                  <th className="px-6 py-4">Faculty Count</th>
                  <th className="px-6 py-4">Meetings</th>
                  <th className="px-6 py-4">Pending Actions</th>
                  <th className="px-6 py-4">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7E2]/60">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F5FAF8] transition-colors">
                    <td className="px-6 py-4 font-bold text-[#173A2C]">{d.name}</td>
                    <td className="px-6 py-4 text-[#667875] font-semibold">{d.faculty_count}</td>
                    <td className="px-6 py-4 text-[#667875] font-semibold">{d.meeting_count}</td>
                    <td className="px-6 py-4 text-[#667875] font-semibold">{d.pending_actions}</td>
                    <td className="px-6 py-4 font-black text-[#3F795F]">{d.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Analytics */}
      {activeTab === 'analytics' && (
        !analytics ? (
          <div className="bg-white p-12 rounded-2xl border border-[#DCE7E2] text-center text-[#667875] text-sm animate-fade-in">
            Loading real-time institutional analytics...
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatCard
                label="Avg Meeting Duration"
                value={`${analytics.stats?.avg_meeting_duration_mins ?? 0}m`}
                icon={<Activity className="w-5 h-5" />}
                variant="sage"
              />
              <StatCard
                label="Actions Per Meeting"
                value={analytics.stats?.actions_per_meeting ?? 0}
                icon={<FileText className="w-5 h-5" />}
                variant="softblue"
              />
              <StatCard
                label="Action Completion Rate"
                value={`${analytics.stats?.action_completion_rate ?? 0}%`}
                icon={<ShieldCheck className="w-5 h-5" />}
                variant="light"
              />
              <StatCard
                label="AI Queries This Month"
                value={analytics.stats?.ai_queries_this_month ?? 0}
                icon={<BarChart3 className="w-5 h-5" />}
                variant="softblue"
              />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#DCE7E2] shadow-sm card-interactive">
              <h4 className="font-bold text-[#173A2C] mb-4">6-Month Meeting &amp; Action Item Trends</h4>
              {analytics.meetings_vs_actions_trend && analytics.meetings_vs_actions_trend.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center text-xs">
                  {analytics.meetings_vs_actions_trend.map((t: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-[#F5FAF8] rounded-xl border border-[#DCE7E2]/60 hover:border-[#78A98F]/40 transition-colors">
                      <span className="font-bold text-[#667875] block mb-2">{t.month}</span>
                      <div className="text-[#3F795F] font-extrabold text-sm">{t.meetings} Mtgs</div>
                      <div className="text-[#367C88] font-bold mt-1">{t.actions} Actions</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#667875] py-4">No historical activity logged yet.</p>
              )}
            </div>
          </div>
        )
      )}

      {/* Tab 5: Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm overflow-hidden p-6 space-y-4 animate-fade-in card-interactive">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <h3 className="font-bold text-[#173A2C] text-base">Security &amp; Operational Audit Log</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={auditSeverity}
                onChange={(e) => setAuditSeverity(e.target.value)}
                className="px-3 py-1.5 border border-[#DCE7E2] rounded-xl text-xs font-semibold bg-[#F5FAF8] text-[#173A2C] focus:outline-none focus:ring-1 focus:ring-[#78A98F]"
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
                className="px-3 py-1.5 border border-[#DCE7E2] rounded-xl text-xs flex-1 sm:w-56 bg-[#F5FAF8] text-[#173A2C] focus:outline-none focus:ring-1 focus:ring-[#78A98F]"
              />
            </div>
          </div>

          <div className="divide-y divide-[#DCE7E2]/60 text-xs">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between hover:bg-[#F5FAF8] px-2 rounded-xl transition-colors">
                  <div>
                    <div className="font-bold text-[#173A2C] flex items-center space-x-2">
                      <span>{log.action}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                        log.severity === 'Alert' ? 'bg-rose-100 text-rose-800' :
                        log.severity === 'Warn' ? 'bg-amber-100 text-amber-800' :
                        log.severity === 'OK' ? 'bg-[#D4E9DF] text-[#173A2C]' : 'bg-[#E4F2F4] text-[#132F34]'
                      }`}>
                        {log.severity}
                      </span>
                    </div>
                    <p className="text-[#667875] mt-0.5">{log.details}</p>
                  </div>
                  <span className="text-[#667875]/70 whitespace-nowrap ml-4 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[#667875] py-6 text-center">No logs matching criteria.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: System Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm p-6 space-y-6 max-w-2xl animate-fade-in card-interactive">
          <div>
            <h3 className="font-bold text-[#173A2C] text-lg">Institutional Configuration &amp; Feature Toggles</h3>
            <p className="text-xs text-[#667875] mt-0.5">Parameters apply across all academic departments.</p>
          </div>

          {settingsSaved && (
            <div className="p-3 bg-[#D4E9DF] text-[#173A2C] rounded-xl text-xs font-bold flex items-center space-x-2 animate-slide-up">
              <CheckCircle2 className="w-4 h-4 text-[#3F795F]" />
              <span>System settings updated and persisted successfully!</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#173A2C] uppercase mb-1">Institution Name</label>
              <input
                type="text"
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#DCE7E2] rounded-xl text-sm bg-[#F5FAF8] text-[#173A2C] focus:outline-none focus:ring-1 focus:ring-[#78A98F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#173A2C] uppercase mb-1">AI MoM Extraction Model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#DCE7E2] rounded-xl text-sm bg-[#F5FAF8] text-[#173A2C] focus:outline-none focus:ring-1 focus:ring-[#78A98F]"
              >
                <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct (OpenRouter)</option>
                <option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#173A2C] uppercase mb-1">Data Retention Period (Days)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-[#DCE7E2] rounded-xl text-sm bg-[#F5FAF8] text-[#173A2C] focus:outline-none focus:ring-1 focus:ring-[#78A98F]"
              />
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-center space-x-3 text-sm font-medium text-[#173A2C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableEmailAlerts}
                  onChange={(e) => setEnableEmailAlerts(e.target.checked)}
                  className="rounded border-[#DCE7E2] text-[#78A98F] focus:ring-[#78A98F] w-4 h-4"
                />
                <span>Enable Automated Email Notifications</span>
              </label>

              <label className="flex items-center space-x-3 text-sm font-medium text-[#173A2C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutoTranscription}
                  onChange={(e) => setEnableAutoTranscription(e.target.checked)}
                  className="rounded border-[#DCE7E2] text-[#78A98F] focus:ring-[#78A98F] w-4 h-4"
                />
                <span>Enable Automated Audio Diarization &amp; Transcription</span>
              </label>

              <label className="flex items-center space-x-3 text-sm font-medium text-[#173A2C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={enable2FA}
                  onChange={(e) => setEnable2FA(e.target.checked)}
                  className="rounded border-[#DCE7E2] text-[#78A98F] focus:ring-[#78A98F] w-4 h-4"
                />
                <span>Enforce Two-Factor Authentication (2FA) for Faculty Accounts</span>
              </label>
            </div>
          </div>

          <AnimatedButton
            type="submit"
            variant="primary"
            isLoading={savingSettings}
            icon={<Check className="w-4 h-4" />}
          >
            Save Configuration
          </AnimatedButton>
        </form>
      )}

    </div>
  );
}
