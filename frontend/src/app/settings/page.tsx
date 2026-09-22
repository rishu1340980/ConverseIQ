'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Trash2, 
  Calendar, 
  Video, 
  Briefcase, 
  Mic, 
  MessageSquare,
  Check,
  AlertCircle,
  KeyRound,
  Shield,
  Bell,
  Sliders,
  User as UserIcon,
  CheckCircle2,
  Lock,
  Globe,
  Share2
} from 'lucide-react';
import { apiRequest, getCurrentStoredUser, setStoredUser } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';
import SegmentedControl from '@/components/ui/SegmentedControl';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'integrations'>('profile');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Profile Form State
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    department: '',
    designation: '',
    phone: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notifications State (persisted to localStorage)
  const [notifications, setNotifications] = useState({
    dailyDigest: true,
    actionReminders: true,
    uploadAlerts: true,
    aiNudges: false,
    weeklyReport: true,
    deadlineAlerts: true,
  });

  // Privacy State (persisted to localStorage)
  const [privacy, setPrivacy] = useState({
    shareTranscripts: true,
    publicProfile: false,
    usageAnalytics: true,
  });

  // Integrations State (persisted to localStorage)
  const [integrations, setIntegrations] = useState({
    googleCalendar: true,
    googleMeet: false,
    teams: false,
    zoom: false,
    slack: true,
  });

  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Load real user and local preferences
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const u = await apiRequest('/auth/me');
        if (u) {
          setCurrentUser(u);
          setStoredUser(u);
          setProfile({
            fullName: u.name || '',
            email: u.email || '',
            department: u.department_name || 'Computer Science',
            designation: u.designation || 'Faculty Member',
            phone: u.phone || '',
          });
        }
      } catch (err) {
        // Fallback to stored user in localStorage
        const stored = getCurrentStoredUser();
        if (stored) {
          setCurrentUser(stored);
          setProfile({
            fullName: stored.name || '',
            email: stored.email || '',
            department: stored.department_name || 'Computer Science',
            designation: stored.designation || 'Faculty Member',
            phone: stored.phone || '',
          });
        }
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();

    // Load persisted preferences
    if (typeof window !== 'undefined') {
      const savedNotifs = localStorage.getItem('converseiq_notifications_settings');
      if (savedNotifs) {
        try { setNotifications(JSON.parse(savedNotifs)); } catch (e) {}
      }
      const savedPrivacy = localStorage.getItem('converseiq_privacy_settings');
      if (savedPrivacy) {
        try { setPrivacy(JSON.parse(savedPrivacy)); } catch (e) {}
      }
      const savedIntegrations = localStorage.getItem('converseiq_integrations_settings');
      if (savedIntegrations) {
        try { setIntegrations(JSON.parse(savedIntegrations)); } catch (e) {}
      }
    }
  }, []);

  // Update Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    setProfileError('');
    setProfileLoading(true);

    try {
      const updated = await apiRequest('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: profile.fullName.trim(),
          designation: profile.designation.trim(),
          phone: profile.phone.trim(),
        }),
      });

      setCurrentUser(updated);
      setStoredUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    setPasswordError('');
    setPasswordLoading(true);

    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Toggle helpers that persist to localStorage
  const updateNotification = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('converseiq_notifications_settings', JSON.stringify(updated));
    }
  };

  const updatePrivacy = (key: keyof typeof privacy) => {
    const updated = { ...privacy, [key]: !privacy[key] };
    setPrivacy(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('converseiq_privacy_settings', JSON.stringify(updated));
    }
  };

  const updateIntegration = (key: keyof typeof integrations) => {
    const updated = { ...integrations, [key]: !integrations[key] };
    setIntegrations(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('converseiq_integrations_settings', JSON.stringify(updated));
    }
  };

  // Export Data Download
  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const data = await apiRequest('/auth/export-data');
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `converseiq_export_${currentUser?.name?.toLowerCase().replace(/\s+/g, '_') || 'user'}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const displayName = profile.fullName || currentUser?.name || 'Academic User';
  const displayInitial = displayName.charAt(0).toUpperCase() || 'U';
  const displayRole = currentUser?.role === 'HOD' ? 'Head of Department' : (currentUser?.role || 'Faculty Member');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
          Settings &amp; Preferences
        </h1>
        <p className="text-sm text-[#667875] mt-1 font-medium">
          Manage your institutional profile, security credentials, and platform preferences.
        </p>
      </div>

      {/* Top 4-Tab Switcher */}
      <div>
        <SegmentedControl
          options={[
            { id: 'profile', label: 'Profile', icon: <UserIcon className="w-3.5 h-3.5" /> },
            { id: 'notifications', label: 'Notifications', icon: <Bell className="w-3.5 h-3.5" /> },
            { id: 'privacy', label: 'Privacy', icon: <Shield className="w-3.5 h-3.5" /> },
            { id: 'integrations', label: 'Integrations', icon: <Sliders className="w-3.5 h-3.5" /> },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as any)}
        />
      </div>

      {/* TAB 1: Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          
          {/* Profile Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#DCE7E2] shadow-sm space-y-6">
            
            {/* User Avatar Info */}
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-full bg-[#3F795F] text-white font-bold text-xl flex items-center justify-center shadow-sm">
                {displayInitial}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#173A2C]">
                  {displayName}
                </h3>
                <p className="text-xs text-[#667875] mt-0.5 font-medium">
                  {displayRole} • {profile.department}
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 bg-[#D4E9DF] text-[#173A2C] rounded-md text-[10px] font-bold">
                  Verified Institutional Account
                </span>
              </div>
            </div>

            {/* Profile Inputs */}
            <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Email Address (Institutional ID)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full px-4 py-2.5 bg-[#F5FAF8]/60 border border-[#DCE7E2] rounded-xl text-sm text-[#667875] cursor-not-allowed outline-none"
                    title="Institutional email address is managed by administrator."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Academic Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile.department}
                    className="w-full px-4 py-2.5 bg-[#F5FAF8]/60 border border-[#DCE7E2] rounded-xl text-sm text-[#667875] cursor-not-allowed outline-none"
                    title="Department is assigned by institution."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Academic Designation
                  </label>
                  <input
                    type="text"
                    value={profile.designation}
                    onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                    placeholder="e.g. Assistant Professor"
                    className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                />
              </div>

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-3 bg-[#D4E9DF]/60 border border-[#78A98F]/40 rounded-xl text-xs text-[#173A2C] font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#3F795F]" />
                  <span>Profile updated successfully in database!</span>
                </div>
              )}

              <div className="pt-2">
                <AnimatedButton
                  type="submit"
                  variant="primary"
                  isLoading={profileLoading}
                  isSuccess={profileSuccess}
                >
                  Save Profile Changes
                </AnimatedButton>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#DCE7E2] shadow-sm space-y-5">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-[#3F795F]" />
              <h3 className="text-sm font-bold text-[#173A2C]">
                Security &amp; Change Password
              </h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-4 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all"
                  />
                </div>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-[#D4E9DF]/60 border border-[#78A98F]/40 rounded-xl text-xs text-[#173A2C] font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#3F795F]" />
                  <span>Password updated successfully!</span>
                </div>
              )}

              <div className="pt-2">
                <AnimatedButton
                  type="submit"
                  variant="primary"
                  isLoading={passwordLoading}
                  isSuccess={passwordSuccess}
                >
                  Update Password
                </AnimatedButton>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* TAB 2: Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#DCE7E2] shadow-sm space-y-6">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-[#3F795F]" />
            <h3 className="text-sm font-bold text-[#173A2C]">
              Notification Preferences
            </h3>
          </div>

          <div className="space-y-4 divide-y divide-[#DCE7E2]/60">
            
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Daily Email Digest</p>
                <p className="text-xs text-[#667875]">Receive a daily summary of meetings, decisions, and tasks</p>
              </div>
              <button
                type="button"
                onClick={() => updateNotification('dailyDigest')}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${notifications.dailyDigest ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.dailyDigest ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Action Item Reminders</p>
                <p className="text-xs text-[#667875]">Get notified before action item deadlines</p>
              </div>
              <button
                type="button"
                onClick={() => updateNotification('actionReminders')}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${notifications.actionReminders ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.actionReminders ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Meeting Upload Alerts</p>
                <p className="text-xs text-[#667875]">Notify when AI analysis and MoM of a meeting is ready</p>
              </div>
              <button
                type="button"
                onClick={() => updateNotification('uploadAlerts')}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${notifications.uploadAlerts ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.uploadAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#173A2C]">AI Insight Nudges</p>
                <p className="text-xs text-[#667875]">Suggestions and proactive follow-ups from the AI assistant</p>
              </div>
              <button
                type="button"
                onClick={() => updateNotification('aiNudges')}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${notifications.aiNudges ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.aiNudges ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Weekly Progress Report</p>
                <p className="text-xs text-[#667875]">Summary of completed and pending items across your department</p>
              </div>
              <button
                type="button"
                onClick={() => updateNotification('weeklyReport')}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${notifications.weeklyReport ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.weeklyReport ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Deadline Alerts</p>
                <p className="text-xs text-[#667875]">Alert 24 hours before key academic deliverables</p>
              </div>
              <button
                type="button"
                onClick={() => updateNotification('deadlineAlerts')}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${notifications.deadlineAlerts ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.deadlineAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: Privacy */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#DCE7E2] shadow-sm space-y-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#3F795F]" />
              <h3 className="text-sm font-bold text-[#173A2C]">
                Privacy &amp; Data Access Controls
              </h3>
            </div>

            <div className="space-y-4 divide-y divide-[#DCE7E2]/60">
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-bold text-[#173A2C]">Share Transcripts with Department HOD</p>
                  <p className="text-xs text-[#667875]">Allow department HOD to review full transcripts and MoM summaries</p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePrivacy('shareTranscripts')}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${privacy.shareTranscripts ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${privacy.shareTranscripts ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-bold text-[#173A2C]">Institutional Faculty Directory Profile</p>
                  <p className="text-xs text-[#667875]">Show profile information in the institution faculty directory</p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePrivacy('publicProfile')}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${privacy.publicProfile ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${privacy.publicProfile ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-bold text-[#173A2C]">Academic Intelligence Analytics</p>
                  <p className="text-xs text-[#667875]">Improve transcription accuracy with anonymized institutional vocabulary</p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePrivacy('usageAnalytics')}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${privacy.usageAnalytics ? 'bg-[#3F795F]' : 'bg-[#DCE7E2]'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${privacy.usageAnalytics ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#DCE7E2] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#173A2C]">
              Data Management &amp; Export
            </h3>
            <p className="text-xs text-[#667875] leading-relaxed">
              Export all your recorded meetings, MoM summaries, action items, and transcripts as a structured JSON file.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <AnimatedButton
                type="button"
                onClick={handleExportData}
                variant="outline"
                isLoading={exportLoading}
                icon={<Download className="w-4 h-4 text-[#3F795F]" />}
              >
                Export My Meeting Data (JSON)
              </AnimatedButton>

              {exportSuccess && (
                <span className="text-xs font-bold text-[#173A2C] bg-[#D4E9DF] border border-[#78A98F]/40 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 animate-scale-in">
                  <Check className="w-3.5 h-3.5 text-[#3F795F]" />
                  <span>Download completed!</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Integrations */}
      {activeTab === 'integrations' && (
        <div className="space-y-3">
          
          {/* Google Calendar */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                17
              </div>
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Google Calendar</p>
                <p className="text-xs text-[#667875]">Sync meeting schedules and deadlines to your Google Calendar.</p>
                <p className="text-[11px] text-[#3F795F] font-semibold mt-0.5">
                  {integrations.googleCalendar ? `Connected: ${profile.email || 'institutional account'}` : 'Not connected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateIntegration('googleCalendar')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                integrations.googleCalendar
                  ? 'border border-rose-200 hover:bg-rose-50 text-rose-600'
                  : 'bg-[#3F795F] text-white hover:bg-[#2F5E4A]'
              }`}
            >
              {integrations.googleCalendar ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          {/* Google Meet */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-[#E4F2F4] text-[#367C88] flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Google Meet</p>
                <p className="text-xs text-[#667875]">Auto-import recordings from Google Meet sessions.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateIntegration('googleMeet')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                integrations.googleMeet
                  ? 'bg-[#D4E9DF] text-[#173A2C] font-bold border border-[#78A98F]/40'
                  : 'bg-white hover:bg-[#F5FAF8] border border-[#DCE7E2] text-[#173A2C]'
              }`}
            >
              {integrations.googleMeet ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Microsoft Teams */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-[#E4F2F4] text-[#367C88] flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Microsoft Teams</p>
                <p className="text-xs text-[#667875]">Connect Teams meetings for automatic transcript import.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateIntegration('teams')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                integrations.teams
                  ? 'bg-[#D4E9DF] text-[#173A2C] font-bold border border-[#78A98F]/40'
                  : 'bg-white hover:bg-[#F5FAF8] border border-[#DCE7E2] text-[#173A2C]'
              }`}
            >
              {integrations.teams ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Zoom */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-[#E4F2F4] text-[#367C88] flex items-center justify-center flex-shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Zoom</p>
                <p className="text-xs text-[#667875]">Pull recordings directly from Zoom cloud storage.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateIntegration('zoom')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                integrations.zoom
                  ? 'bg-[#D4E9DF] text-[#173A2C] font-bold border border-[#78A98F]/40'
                  : 'bg-white hover:bg-[#F5FAF8] border border-[#DCE7E2] text-[#173A2C]'
              }`}
            >
              {integrations.zoom ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Slack */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-[#E4F2F4] text-[#367C88] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#173A2C]">Slack</p>
                <p className="text-xs text-[#667875]">Send meeting summaries and action item reminders to Slack channels.</p>
                <p className="text-[11px] text-[#3F795F] font-semibold mt-0.5">
                  {integrations.slack ? 'Connected: #faculty-announcements' : 'Not connected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateIntegration('slack')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                integrations.slack
                  ? 'border border-rose-200 hover:bg-rose-50 text-rose-600'
                  : 'bg-[#3F795F] text-white hover:bg-[#2F5E4A]'
              }`}
            >
              {integrations.slack ? 'Disconnect' : 'Connect'}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
