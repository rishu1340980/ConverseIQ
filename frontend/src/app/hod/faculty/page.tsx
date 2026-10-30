'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Edit2,
  UserPlus,
  X,
  Filter,
  Building2,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';

interface FacultyDirectoryItem {
  id: number;
  name: string;
  email: string | null;
  designation: string;
  phone: string | null;
  is_email_configured: boolean;
  is_active: boolean;
  department_name: string;
}

const APSIT_DOMAIN = '@apsit.edu.in';
const INVALID_DOMAIN_MSG = 'Not Applicable. Please use your official APSIT institutional email address.';

export default function HodFacultyEmailManagementPage() {
  const [facultyList, setFacultyList] = useState<FacultyDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'configured' | 'unconfigured'>('all');

  // Edit/Configure Email Modal State
  const [editingFaculty, setEditingFaculty] = useState<FacultyDirectoryItem | null>(null);
  const [inputEmail, setInputEmail] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Add Faculty Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDesignation, setAddDesignation] = useState('Assistant Professor');
  const [addPhone, setAddPhone] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    loadFacultyDirectory();
  }, []);

  const loadFacultyDirectory = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<FacultyDirectoryItem[]>('/users/faculty-directory');
      setFacultyList(data || []);
    } catch (err: any) {
      console.error('Failed to load faculty directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (faculty: FacultyDirectoryItem) => {
    setEditingFaculty(faculty);
    setInputEmail(faculty.email || '');
    setModalError(null);
    setModalSuccess(null);
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    setModalError(null);
    setModalSuccess(null);

    const cleanEmail = inputEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setModalError('Please enter an institutional email address.');
      return;
    }

    if (!cleanEmail.endsWith(APSIT_DOMAIN) || !/^[a-zA-Z0-9_.+-]+@apsit\.edu\.in$/.test(cleanEmail)) {
      setModalError(INVALID_DOMAIN_MSG);
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiRequest(`/users/faculty/${editingFaculty.id}/email`, {
        method: 'PUT',
        body: JSON.stringify({ email: cleanEmail }),
      });

      // Update local state instantly
      setFacultyList((prev) =>
        prev.map((item) =>
          item.id === editingFaculty.id
            ? { ...item, email: cleanEmail, is_email_configured: true }
            : item
        )
      );

      setModalSuccess(`Email successfully updated to ${cleanEmail}`);
      setTimeout(() => {
        setEditingFaculty(null);
      }, 1200);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update faculty email.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addName.trim()) {
      setAddError('Faculty name is required.');
      return;
    }

    const cleanEmail = addEmail.trim().toLowerCase();
    if (cleanEmail && (!cleanEmail.endsWith(APSIT_DOMAIN) || !/^[a-zA-Z0-9_.+-]+@apsit\.edu\.in$/.test(cleanEmail))) {
      setAddError(INVALID_DOMAIN_MSG);
      return;
    }

    setAddLoading(true);
    try {
      await apiRequest('/users/faculty', {
        method: 'POST',
        body: JSON.stringify({
          name: addName.trim(),
          email: cleanEmail || null,
          designation: addDesignation,
          phone: addPhone.trim() || null,
        }),
      });

      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddPhone('');
      await loadFacultyDirectory();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add faculty member.');
    } finally {
      setAddLoading(false);
    }
  };

  // Filtered List
  const filteredList = facultyList.filter((faculty) => {
    const matchesSearch =
      faculty.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (faculty.email && faculty.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      faculty.designation.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'configured') return faculty.is_email_configured;
    if (filterTab === 'unconfigured') return !faculty.is_email_configured;
    return true;
  });

  const configuredCount = facultyList.filter((f) => f.is_email_configured).length;
  const unconfiguredCount = facultyList.length - configuredCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Institutional Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 text-xs font-bold mb-1 border border-blue-200 dark:border-blue-900">
            <Building2 className="w-3 h-3" />
            <span>Department of Information Technology</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Faculty Directory &amp; Email Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Exclusive HOD control to verify, configure, and maintain official <code className="text-blue-700 font-semibold">@apsit.edu.in</code> email addresses for departmental meeting invitations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <AnimatedButton
            onClick={() => { setShowAddModal(true); setAddError(null); }}
            variant="primary"
            icon={<UserPlus className="w-4 h-4" />}
            className="bg-blue-900 hover:bg-blue-800 text-white cursor-pointer"
          >
            Add Faculty Member
          </AnimatedButton>
        </div>
      </div>

      {/* Roster Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Department Roster</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {facultyList.length} <span className="text-xs font-medium text-slate-500">Faculty Members</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 p-4 shadow-xs bg-emerald-50/20">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Configured Institutional Emails</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {configuredCount} <span className="text-xs font-medium text-slate-500">Ready for Invitations</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 p-4 shadow-xs bg-amber-50/20">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Unconfigured Emails</span>
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {unconfiguredCount} <span className="text-xs font-medium text-slate-500">Pending HOD Configuration</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search faculty by name..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All ({facultyList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('configured')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterTab === 'configured'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Configured ({configuredCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('unconfigured')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterTab === 'unconfigured'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Unconfigured ({unconfiguredCount})
          </button>
        </div>
      </div>

      {/* Faculty Directory Table */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-900 mx-auto mb-3" />
          <span>Loading official faculty directory...</span>
        </div>
      ) : filteredList.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Institutional Email Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map((faculty) => (
                  <tr key={faculty.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    
                    {/* Faculty Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {faculty.name.replace('Prof. ', '').replace('Dr. ', '').charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{faculty.name}</div>
                          {faculty.phone && (
                            <div className="text-[11px] text-slate-400">{faculty.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Designation */}
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {faculty.designation}
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                        {faculty.department_name || 'Information Technology'}
                      </span>
                    </td>

                    {/* Email Status Badge */}
                    <td className="py-3.5 px-4">
                      {faculty.is_email_configured && faculty.email ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{faculty.email}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[11px]">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>Email Not Configured</span>
                        </span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(faculty)}
                        className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          faculty.is_email_configured
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-blue-900 hover:bg-blue-800 text-white shadow-xs'
                        }`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{faculty.is_email_configured ? 'Edit Email' : 'Configure Email'}</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No faculty members found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No faculty records match your current search query or filter.
          </p>
        </div>
      )}

      {/* EDIT / CONFIGURE EMAIL MODAL */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Configure Institutional Email
                </h3>
                <p className="text-xs text-slate-500">
                  Faculty: <strong className="text-blue-950 dark:text-blue-200">{editingFaculty.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFaculty(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Official Institutional Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    autoFocus
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="firstname.lastname@apsit.edu.in"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Must be a valid official address strictly under <code className="text-blue-700 font-mono">@apsit.edu.in</code>.
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <AnimatedButton
                  type="submit"
                  variant="primary"
                  isLoading={isSaving}
                  className="flex-1 justify-center bg-blue-900 hover:bg-blue-800 text-white cursor-pointer"
                >
                  Save &amp; Verify Email
                </AnimatedButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD FACULTY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Faculty Member to Department
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddFaculty} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Prof. Sneha Dalvi"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Email (Optional - can be configured later)
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="name@apsit.edu.in"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designation
                </label>
                <select
                  value={addDesignation}
                  onChange={(e) => setAddDesignation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
                >
                  <option>Assistant Professor</option>
                  <option>Associate Professor</option>
                  <option>Professor</option>
                  <option>Lecturer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-800 outline-none"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <AnimatedButton
                  type="submit"
                  variant="primary"
                  isLoading={addLoading}
                  className="flex-1 justify-center bg-blue-900 hover:bg-blue-800 text-white cursor-pointer"
                >
                  Add Faculty
                </AnimatedButton>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

