'use client';

import React, { useState } from 'react';
import { 
  Download, 
  Trash2, 
  Calendar, 
  Video, 
  Briefcase, 
  Mic, 
  MessageSquare,
  Check
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'integrations'>('profile');

  // Profile Form State
  const [profile, setProfile] = useState({
    fullName: 'Rishabh Sharma',
    email: 'rishabh@greenfield.edu',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    phone: '+91 98765 43210',
  });

  // Notifications State
  const [notifications, setNotifications] = useState({
    dailyDigest: true,
    actionReminders: true,
    uploadAlerts: true,
    aiNudges: false,
    weeklyReport: true,
    deadlineAlerts: true,
  });

  // Privacy State
  const [privacy, setPrivacy] = useState({
    shareTranscripts: false,
    publicProfile: false,
    usageAnalytics: true,
  });

  // Integrations State
  const [integrations, setIntegrations] = useState({
    googleCalendar: true,
    googleMeet: false,
    teams: false,
    zoom: false,
    slack: true,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Manage your account preferences and configurations.
        </p>
      </div>

      {/* Top 4-Tab Switcher */}
      <div className="bg-[#F3EFE6] p-1 rounded-xl flex items-center space-x-1 border border-[#E8E5DA] max-w-2xl overflow-x-auto">
        {(['profile', 'notifications', 'privacy', 'integrations'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-[100px] py-2 px-4 rounded-lg text-xs font-semibold capitalize transition-all ${
              activeTab === tab
                ? 'bg-white text-[#1C251E] shadow-sm font-bold'
                : 'text-[#6B7280] hover:text-[#1C251E]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 1: Profile (Image 9) */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          
          {/* Profile Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E5DA] shadow-sm space-y-6">
            
            {/* User Avatar Info */}
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-full bg-[#45644F] text-white font-bold text-xl flex items-center justify-center shadow-sm">
                R
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1C251E]">
                  Rishabh Sharma
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Faculty • Computer Science
                </p>
                <button
                  type="button"
                  onClick={() => alert('Photo upload dialog')}
                  className="text-xs text-[#6B7280] hover:text-[#1C251E] underline mt-0.5"
                >
                  Change photo
                </button>
              </div>
            </div>

            {/* Profile Inputs */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={profile.designation}
                  onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B5563] mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
                />
              </div>

              {savedSuccess && (
                <p className="text-xs text-[#2E6838] font-bold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Profile updated successfully</span>
                </p>
              )}
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E5DA] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C251E]">
              Change Password
            </h3>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Current Password
              </label>
              <input
                type="password"
                defaultValue="••••••••"
                className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                New Password
              </label>
              <input
                type="password"
                defaultValue="••••••••"
                className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white outline-none"
              />
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Notifications (Image 10) */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E5DA] shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-[#1C251E]">
            Notification Preferences
          </h3>

          <div className="space-y-4 divide-y divide-[#E8E5DA]/60">
            
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Daily Email Digest</p>
                <p className="text-xs text-[#6B7280]">Receive a daily summary of meetings and tasks</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications({ ...notifications, dailyDigest: !notifications.dailyDigest })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${notifications.dailyDigest ? 'bg-[#45644F]' : 'bg-gray-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.dailyDigest ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Action Item Reminders</p>
                <p className="text-xs text-[#6B7280]">Get notified before action item deadlines</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications({ ...notifications, actionReminders: !notifications.actionReminders })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${notifications.actionReminders ? 'bg-[#45644F]' : 'bg-gray-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.actionReminders ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Meeting Upload Alerts</p>
                <p className="text-xs text-[#6B7280]">Notify when AI analysis of a meeting is ready</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications({ ...notifications, uploadAlerts: !notifications.uploadAlerts })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${notifications.uploadAlerts ? 'bg-[#45644F]' : 'bg-gray-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.uploadAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#1C251E]">AI Insight Nudges</p>
                <p className="text-xs text-[#6B7280]">Occasional suggestions from the AI assistant</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications({ ...notifications, aiNudges: !notifications.aiNudges })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${notifications.aiNudges ? 'bg-[#45644F]' : 'bg-gray-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.aiNudges ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Weekly Progress Report</p>
                <p className="text-xs text-[#6B7280]">Summary of completed and pending items</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications({ ...notifications, weeklyReport: !notifications.weeklyReport })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${notifications.weeklyReport ? 'bg-[#45644F]' : 'bg-gray-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.weeklyReport ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Deadline Alerts</p>
                <p className="text-xs text-[#6B7280]">Alert 24 hours before upcoming deadlines</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifications({ ...notifications, deadlineAlerts: !notifications.deadlineAlerts })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${notifications.deadlineAlerts ? 'bg-[#45644F]' : 'bg-gray-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifications.deadlineAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: Privacy (Image 11) */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E5DA] shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-[#1C251E]">
              Privacy Controls
            </h3>

            <div className="space-y-4 divide-y divide-[#E8E5DA]/60">
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-bold text-[#1C251E]">Share Transcripts with Department</p>
                  <p className="text-xs text-[#6B7280]">Allow HOD to view your meeting transcripts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacy({ ...privacy, shareTranscripts: !privacy.shareTranscripts })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${privacy.shareTranscripts ? 'bg-[#45644F]' : 'bg-gray-300'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${privacy.shareTranscripts ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-bold text-[#1C251E]">Public Faculty Profile</p>
                  <p className="text-xs text-[#6B7280]">Show your profile on the institution directory</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacy({ ...privacy, publicProfile: !privacy.publicProfile })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${privacy.publicProfile ? 'bg-[#45644F]' : 'bg-gray-300'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${privacy.publicProfile ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-bold text-[#1C251E]">Usage Analytics</p>
                  <p className="text-xs text-[#6B7280]">Help improve ConverseIQ with anonymized usage data</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacy({ ...privacy, usageAnalytics: !privacy.usageAnalytics })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${privacy.usageAnalytics ? 'bg-[#45644F]' : 'bg-gray-300'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${privacy.usageAnalytics ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E8E5DA] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1C251E]">
              Data Management
            </h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              You can request a full export of your data or permanently delete your account and all associated recordings, transcripts, and meeting data.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => alert('Data export initiated. A download link will be sent to your email.')}
                className="px-4 py-2 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] text-[#1C251E] rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export My Data</span>
              </button>

              <button
                type="button"
                onClick={() => alert('Please contact institution admin to delete your faculty account.')}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Integrations (Image 12) */}
      {activeTab === 'integrations' && (
        <div className="space-y-3">
          
          {/* Google Calendar */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                17
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Google Calendar</p>
                <p className="text-xs text-[#6B7280]">Sync meeting schedules and deadlines to your Google Calendar.</p>
                <p className="text-[11px] text-[#45644F] font-semibold mt-0.5">Connected: rishabh@gmail.com</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrations({ ...integrations, googleCalendar: !integrations.googleCalendar })}
              className="px-3.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-semibold transition-colors"
            >
              Disconnect
            </button>
          </div>

          {/* Google Meet */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Google Meet</p>
                <p className="text-xs text-[#6B7280]">Auto-import recordings from Google Meet sessions.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrations({ ...integrations, googleMeet: !integrations.googleMeet })}
              className="px-4 py-1.5 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] text-[#1C251E] rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              {integrations.googleMeet ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Microsoft Teams */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Microsoft Teams</p>
                <p className="text-xs text-[#6B7280]">Connect Teams meetings for automatic transcript import.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrations({ ...integrations, teams: !integrations.teams })}
              className="px-4 py-1.5 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] text-[#1C251E] rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              {integrations.teams ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Zoom */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Zoom</p>
                <p className="text-xs text-[#6B7280]">Pull recordings directly from Zoom cloud storage.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrations({ ...integrations, zoom: !integrations.zoom })}
              className="px-4 py-1.5 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] text-[#1C251E] rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              {integrations.zoom ? 'Connected' : 'Connect'}
            </button>
          </div>

          {/* Slack */}
          <div className="bg-white rounded-2xl p-5 border border-[#E8E5DA] shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C251E]">Slack</p>
                <p className="text-xs text-[#6B7280]">Send meeting summaries and action item reminders to Slack channels.</p>
                <p className="text-[11px] text-[#45644F] font-semibold mt-0.5">Connected: #faculty-cs</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIntegrations({ ...integrations, slack: !integrations.slack })}
              className="px-3.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-semibold transition-colors"
            >
              Disconnect
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
