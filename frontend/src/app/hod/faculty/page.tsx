'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, X, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';

interface FacultyMember {
  id: number;
  initial: string;
  name: string;
  designation: string;
  is_active: boolean;
  meeting_count: number;
  completion_rate: number;
  actions_done: number;
  actions_total: number;
}

export default function HodFacultyPerformancePage() {
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Faculty form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDesignation, setNewDesignation] = useState('Assistant Professor');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    loadFacultyData();
  }, []);

  const loadFacultyData = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/users?role=Faculty');
      if (data && data.length > 0) {
        const mapped: FacultyMember[] = data.map((u) => ({
          id: u.id,
          initial: u.name.charAt(0).toUpperCase(),
          name: u.name,
          designation: u.designation || 'Faculty',
          is_active: u.is_active,
          meeting_count: u.meeting_count || 0,
          completion_rate: u.completion_rate || 0,
          actions_done: u.actions_done || 0,
          actions_total: u.actions_total || 0,
        }));
        setFacultyList(mapped);
      } else {
        setFacultyList([]);
      }
    } catch (err) {
      console.warn('Faculty data load error:', err);
      setFacultyList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaculty = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setAddError('Name, email, and password are required.');
      return;
    }
    setAddError('');
    setAddLoading(true);
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          designation: newDesignation || 'Assistant Professor',
          phone: newPhone.trim(),
        }),
      });
      // Reset and reload
      setNewName(''); setNewEmail(''); setNewPassword('');
      setNewDesignation('Assistant Professor'); setNewPhone('');
      setShowAddModal(false);
      await loadFacultyData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create faculty. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = async (faculty: FacultyMember) => {
    try {
      await apiRequest(`/users/${faculty.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !faculty.is_active }),
      });
      await loadFacultyData();
    } catch (err) {
      console.warn('Toggle faculty status failed:', err);
    }
  };

  const handleDeleteFaculty = async (faculty: FacultyMember) => {
    if (!confirm(`Are you sure you want to remove ${faculty.name} from the department roster?`)) return;
    try {
      await apiRequest(`/users/${faculty.id}`, { method: 'DELETE' });
      await loadFacultyData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove faculty member.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] tracking-tight">
            Faculty Performance
          </h1>
          <p className="text-sm text-[#667875] mt-1 font-medium">
            {facultyList.length} faculty member{facultyList.length !== 1 ? 's' : ''} in your department
          </p>
        </div>
        {/* Add Faculty — HOD only right */}
        <AnimatedButton
          onClick={() => { setShowAddModal(true); setAddError(''); }}
          variant="primary"
          icon={<UserPlus className="w-4 h-4" />}
        >
          Add Faculty
        </AnimatedButton>
      </div>

      {/* Faculty List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#667875]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#DCE7E2] border-t-[#3F795F] mx-auto mb-3"></div>
          <span>Loading faculty directory...</span>
        </div>
      ) : facultyList.length > 0 ? (
        <div className="space-y-3.5">
          {facultyList.map((faculty) => (
            <div
              key={faculty.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 card-interactive ${
                faculty.is_active ? 'border-[#DCE7E2] hover:border-[#78A98F]/50' : 'border-gray-200 opacity-60'
              }`}
            >
              {/* Left: Avatar + Details */}
              <div className="flex items-center space-x-4">
                <div className="w-11 h-11 rounded-full bg-[#3F795F] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                  {faculty.initial}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#173A2C]">{faculty.name}</p>
                  <p className="text-xs text-[#667875] font-medium mt-0.5">{faculty.designation}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-[#667875]">{faculty.meeting_count} meeting{faculty.meeting_count !== 1 ? 's' : ''}</span>
                    {faculty.actions_total > 0 && (
                      <span className="text-[11px] text-[#367C88] font-medium">{faculty.actions_done}/{faculty.actions_total} actions done</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Action completion rate */}
              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#667875] font-medium">Action Completion</span>
                  <span className="font-bold text-[#173A2C]">
                    {faculty.actions_total > 0 ? `${faculty.completion_rate}%` : '—'}
                  </span>
                </div>
                <div className="w-full bg-[#EDF5F2] h-2 rounded-full overflow-hidden">
                  {faculty.actions_total > 0 && (
                    <div
                      className="bg-[#3F795F] h-full rounded-full transition-all duration-500"
                      style={{ width: `${faculty.completion_rate}%` }}
                    />
                  )}
                </div>
                {faculty.actions_total === 0 && (
                  <p className="text-[11px] text-[#667875] mt-1">No action items recorded yet</p>
                )}
              </div>

              {/* Right: Status + Toggle */}
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  faculty.is_active
                    ? 'bg-[#D4E9DF] text-[#173A2C]'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {faculty.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => handleToggleActive(faculty)}
                  title={faculty.is_active ? 'Deactivate faculty' : 'Activate faculty'}
                  className="text-gray-400 hover:text-[#3F795F] transition-colors cursor-pointer"
                >
                  {faculty.is_active
                    ? <XCircle className="w-4 h-4 text-rose-400 hover:text-rose-600" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-500 hover:text-emerald-700" />
                  }
                </button>
                <button
                  onClick={() => handleDeleteFaculty(faculty)}
                  title="Remove faculty from roster"
                  className="text-gray-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#DCE7E2] py-16 text-center space-y-3 shadow-xs">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-[#173A2C]">No faculty members yet</h3>
          <p className="text-xs text-[#667875] max-w-sm mx-auto">
            Use the &quot;Add Faculty&quot; button above to add faculty members to your department.
          </p>
        </div>
      )}

      {/* Add Faculty Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center px-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#DCE7E2] shadow-xl w-full max-w-md p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#173A2C]">Add Faculty Member</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-[#173A2C] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Priya Nair"
                  className="w-full px-3 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. priya.nair@converseiq.edu"
                  className="w-full px-3 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1">Temporary Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1">Designation</label>
                <select
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                >
                  <option>Assistant Professor</option>
                  <option>Associate Professor</option>
                  <option>Professor</option>
                  <option>Lecturer</option>
                  <option>Senior Lecturer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#173A2C] mb-1">Phone (Optional)</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2.5 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:bg-white focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none"
                />
              </div>

              {addError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{addError}</p>
              )}
            </div>

            <div className="flex gap-3">
              <AnimatedButton
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </AnimatedButton>
              <AnimatedButton
                onClick={handleAddFaculty}
                isLoading={addLoading}
                variant="primary"
                className="flex-1"
              >
                Create Faculty
              </AnimatedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
