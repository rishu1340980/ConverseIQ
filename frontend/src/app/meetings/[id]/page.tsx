'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  FileDown, 
  CheckCircle, 
  Edit3, 
  Save, 
  Users, 
  Calendar, 
  Clock, 
  Check, 
  Sparkles,
  Bot,
  Plus,
  Trash2,
  Lock,
  FileCheck,
  UploadCloud,
  Languages,
  Search,
  Globe,
  Volume2,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Meeting, MinutesOfMeeting, ActionItem, Participant, Utterance } from '@/types';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mom' | 'transcript' | 'actions' | 'mapping' | 'ai'>('mom');

  // MoM Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [summary, setSummary] = useState('');
  const [decisionsText, setDecisionsText] = useState('');
  const [savingMoM, setSavingMoM] = useState(false);

  // Transcript state
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'All' | 'Hindi' | 'English' | 'Hinglish'>('All');
  const [showTranslations, setShowTranslations] = useState(true);

  // Mapping state
  const [speakerLabel, setSpeakerLabel] = useState('Speaker A');
  const [realName, setRealName] = useState('');
  const [mappingSuccess, setMappingSuccess] = useState('');

  // AI Assistant state
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiRequest(`/meetings/${meetingId}/upload-recording`, {
        method: 'POST',
        body: formData,
      });
      await fetchMeetingDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchMeetingDetail();
  }, [meetingId]);

  const fetchMeetingDetail = async () => {
    try {
      const res = await apiRequest<Meeting>(`/meetings/${meetingId}`);
      setMeeting(res);
      if (res.mom) {
        setSummary(res.mom.summary || '');
        setDecisionsText((res.mom.decisions || []).join('\n'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMoM = async () => {
    setSavingMoM(true);
    try {
      const decisionsList = decisionsText
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);

      await apiRequest(`/mom/${meetingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          summary,
          decisions: decisionsList,
        }),
      });

      setIsEditing(false);
      fetchMeetingDetail();
    } catch (err) {
      alert('Failed to save MoM changes');
    } finally {
      setSavingMoM(false);
    }
  };

  const handleFinalizeMoM = async () => {
    if (!confirm('Are you sure you want to officially finalize this MoM?')) return;
    try {
      await apiRequest(`/mom/${meetingId}/finalize`, { method: 'POST' });
      fetchMeetingDetail();
    } catch (err) {
      alert('Failed to finalize MoM');
    }
  };

  const handleToggleAction = async (itemId: number) => {
    try {
      await apiRequest(`/action-items/${itemId}/toggle`, { method: 'PATCH' });
      fetchMeetingDetail();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSpeakerMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim()) return;

    try {
      await apiRequest(`/meetings/${meetingId}/map-attendees`, {
        method: 'POST',
        body: JSON.stringify({
          speaker_label: speakerLabel,
          real_name: realName,
        }),
      });

      setMappingSuccess(`Mapped ${speakerLabel} to ${realName}!`);
      setRealName('');
      setTimeout(() => setMappingSuccess(''), 3000);
      fetchMeetingDetail();
    } catch (err) {
      alert('Failed to update mapping');
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);

    try {
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          query: aiQuery,
          meeting_id: Number(meetingId),
        }),
      });
      setAiAnswer(res.answer);
    } catch (err) {
      setAiAnswer('Error querying assistant.');
    } finally {
      setAiLoading(false);
    }
  };

  const downloadExport = (format: 'pdf' | 'docx') => {
    const token = localStorage.getItem('converseiq_token');
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const url = `${baseUrl}/export/${meetingId}/${format}`;
    // Trigger download with auth token in fetch or popup
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const fileUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = `MoM_Meeting_${meetingId}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(() => alert(`Failed to export ${format.toUpperCase()}`));
  };

  // Helper to fallback parse raw transcript into utterances if needed
  const parseRawTranscriptToUtterances = (raw: string): Utterance[] => {
    if (!raw) return [];
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map((line, idx) => {
      const match = line.match(/^(?:\[(.*?)\]\s*)?([^:]+):\s*(.*)$/);
      if (match) {
        const spk = match[2].trim();
        const text = match[3].trim();
        return {
          speaker: spk,
          raw_speaker: `Voice ${idx + 1}`,
          text: text,
          translation: text,
          language: 'English',
          timestamp: match[1] || `00:${(idx * 15).toString().padStart(2, '0')}`,
        };
      }
      return {
        speaker: 'Faculty Member',
        raw_speaker: 'Speaker',
        text: line,
        translation: line,
        language: 'English',
        timestamp: `00:${(idx * 15).toString().padStart(2, '0')}`,
      };
    });
  };

  const rawUtterances: Utterance[] = (meeting?.mom?.utterances && meeting.mom.utterances.length > 0)
    ? meeting.mom.utterances
    : (meeting?.mom?.raw_transcript ? parseRawTranscriptToUtterances(meeting.mom.raw_transcript) : []);

  const filteredUtterances = rawUtterances.filter(u => {
    const matchesSearch = !transcriptSearch || 
      u.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || 
      (u.speaker && u.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())) ||
      (u.translation && u.translation.toLowerCase().includes(transcriptSearch.toLowerCase()));
    const matchesLang = languageFilter === 'All' || u.language === languageFilter;
    return matchesSearch && matchesLang;
  });

  const formatTimestamp = (ts?: string, startMs?: number) => {
    if (ts) return ts;
    if (typeof startMs === 'number') {
      const totalSecs = Math.floor(startMs / 1000);
      const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
      const secs = (totalSecs % 60).toString().padStart(2, '0');
      return `${mins}:${secs}`;
    }
    return '00:00';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#45644F]"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-[#1C251E]">Meeting not found</h2>
        <Link href="/meetings" className="mt-4 inline-block text-sm text-[#45644F] underline">
          Back to Meetings
        </Link>
      </div>
    );
  }

  const isFinalized = meeting.mom?.is_finalized ?? false;

  return (
    <div className="space-y-6 max-w-6xl">
      
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/meetings"
          className="inline-flex items-center text-xs font-semibold text-[#6B7280] hover:text-[#1C251E] space-x-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Meetings</span>
        </Link>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-[#FAF9F5] text-[#1C251E] text-xs font-bold rounded-xl border border-[#E8E5DA] shadow-xs transition-colors cursor-pointer">
            <UploadCloud className="w-3.5 h-3.5 text-[#45644F]" />
            <span>{isUploading ? 'Processing Audio...' : 'Upload Recording'}</span>
            <input
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.mp4"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>

          <button
            onClick={() => downloadExport('pdf')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-[#FAF9F5] text-[#1C251E] text-xs font-bold rounded-xl border border-[#E8E5DA] shadow-xs transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-red-500" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={() => downloadExport('docx')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-[#FAF9F5] text-[#1C251E] text-xs font-bold rounded-xl border border-[#E8E5DA] shadow-xs transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-500" />
            <span>Export Word (.docx)</span>
          </button>
        </div>
      </div>

      {/* Meeting Header Card */}
      {/* Meeting Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#E8E5DA] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  meeting.status === 'Completed'
                    ? 'bg-[#E1EFE1] text-[#2E6838]'
                    : 'bg-[#FEF3C7] text-[#92400E]'
                }`}
              >
                {meeting.status}
              </span>
              {isFinalized && (
                <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#E2EBE2] text-[#2F4E36]">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Officially Finalized</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1C251E] tracking-tight mt-2">
              {meeting.title}
            </h1>
          </div>

          {!isFinalized && (
            <button
              onClick={handleFinalizeMoM}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#45644F] hover:bg-[#385240] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors self-start sm:self-auto"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Finalize MoM</span>
            </button>
          )}
        </div>

        {/* Metadata Details */}
        <div className="mt-4 pt-4 border-t border-[#E8E5DA]/60 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-[#6B7280]">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>
              <strong className="text-[#1C251E]">Date:</strong> {new Date(meeting.date).toLocaleDateString([], { dateStyle: 'long' })}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>
              <strong className="text-[#1C251E]">Duration:</strong> {meeting.duration_minutes} mins
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span>
              <strong className="text-[#1C251E]">Attendees:</strong> {meeting.participants?.length || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Pill style matching Figma) */}
      <div className="bg-[#F3EFE6] p-1 rounded-xl flex items-center space-x-1 border border-[#E8E5DA] max-w-3xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('mom')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
            activeTab === 'mom'
              ? 'bg-white text-[#1C251E] shadow-sm font-bold'
              : 'text-[#6B7280] hover:text-[#1C251E]'
          }`}
        >
          Minutes of Meeting (MoM)
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center space-x-1.5 ${
            activeTab === 'transcript'
              ? 'bg-white text-[#1C251E] shadow-sm font-bold'
              : 'text-[#6B7280] hover:text-[#1C251E]'
          }`}
        >
          <Languages className="w-3.5 h-3.5 text-[#45644F]" />
          <span>Bilingual Transcript ({rawUtterances.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
            activeTab === 'actions'
              ? 'bg-white text-[#1C251E] shadow-sm font-bold'
              : 'text-[#6B7280] hover:text-[#1C251E]'
          }`}
        >
          Action Items ({meeting.action_items?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('mapping')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
            activeTab === 'mapping'
              ? 'bg-white text-[#1C251E] shadow-sm font-bold'
              : 'text-[#6B7280] hover:text-[#1C251E]'
          }`}
        >
          Speaker Mapping
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
            activeTab === 'ai'
              ? 'bg-white text-[#1C251E] shadow-sm font-bold'
              : 'text-[#6B7280] hover:text-[#1C251E]'
          }`}
        >
          AI Meeting Q&amp;A
        </button>
      </div>

      {/* Tab 1: Minutes of Meeting */}
      {activeTab === 'mom' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E8E5DA]">
            <div>
              <h3 className="font-bold text-[#1C251E] text-lg">Structured Minutes of Meeting</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">Formal institutional record distilled by Gemini 3.6 Flash</p>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#FAF9F5] hover:bg-[#F3EFE6] text-[#1C251E] text-xs font-semibold rounded-lg border border-[#E8E5DA] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit MoM</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 border border-[#E8E5DA] hover:bg-gray-50 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMoM}
                  disabled={savingMoM}
                  className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-[#45644F] hover:bg-[#385240] text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMoM ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Executive Summary */}
          <div>
            <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
              Executive Summary
            </h4>
            {isEditing ? (
              <textarea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full p-3 border border-[#E8E5DA] rounded-xl text-sm focus:ring-2 focus:ring-[#45644F] outline-none"
              />
            ) : (
              <p className="text-sm text-[#1C251E] leading-relaxed bg-[#FAF9F5] p-4 rounded-xl border border-[#E8E5DA]">
                {summary || 'No summary recorded yet. Upload a recording to extract MoM.'}
              </p>
            )}
          </div>

          {/* Key Decisions Agreed (Highlighted Section) */}
          <div className="bg-[#FAF9F5] border border-[#E8E5DA] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E2EBE2] flex items-center justify-center text-[#2F4E36]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1C251E] uppercase tracking-wide">
                    Formal Decisions &amp; Resolutions
                  </h4>
                  <p className="text-[11px] text-[#6B7280]">
                    Official resolutions voted or unanimously agreed upon during this session
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E1EFE1] text-[#2E6838] border border-[#2E6838]/20">
                {meeting.mom?.decisions?.length || 0} Ratified
              </span>
            </div>

            {isEditing ? (
              <div>
                <p className="text-[11px] text-[#6B7280] mb-1">Enter each formal decision on a new line:</p>
                <textarea
                  rows={4}
                  value={decisionsText}
                  onChange={(e) => setDecisionsText(e.target.value)}
                  className="w-full p-3 border border-[#E8E5DA] rounded-xl text-sm focus:ring-2 focus:ring-[#45644F] outline-none"
                />
              </div>
            ) : (
              <div className="space-y-2.5">
                {meeting.mom?.decisions && meeting.mom.decisions.length > 0 ? (
                  meeting.mom.decisions.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-start space-x-3 p-3.5 bg-white rounded-xl border border-[#E8E5DA] shadow-xs hover:border-[#45644F]/40 transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#45644F] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1C251E] leading-snug">
                          {d}
                        </p>
                        <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#2E6838] mt-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Institutional Consensus</span>
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-[#6B7280] bg-white rounded-xl border border-dashed border-[#E8E5DA]">
                    No formal decisions recorded yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Discussion Topics */}
          {meeting.mom?.topics_discussed && meeting.mom.topics_discussed.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">
                Key Agenda Topics &amp; Discussion Points
              </h4>
              <div className="space-y-3">
                {meeting.mom.topics_discussed.map((topic: any, idx: number) => (
                  <div key={idx} className="p-4 bg-[#FAF9F5] rounded-xl border border-[#E8E5DA]">
                    <h5 className="font-bold text-sm text-[#1C251E]">
                      {topic.topic || 'Discussion Topic'}
                    </h5>
                    <ul className="mt-2 list-disc list-inside text-xs text-[#6B7280] space-y-1">
                      {topic.points?.map((pt: string, pIdx: number) => (
                        <li key={pIdx} className="leading-relaxed">{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Bilingual Transcript & Diarization */}
      {activeTab === 'transcript' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-6 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E8E5DA] gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#E2EBE2] flex items-center justify-center text-[#2F4E36]">
                  <Languages className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[#1C251E] text-lg">Bilingual Transcript &amp; Automatic Faculty Diarization</h3>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                Audio is transcribed verbatim in Hindi &amp; English with voices automatically attributed to faculty members without manual host mapping.
              </p>
            </div>

            {/* Translation toggle */}
            <button
              onClick={() => setShowTranslations(!showTranslations)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all self-start sm:self-auto ${
                showTranslations 
                  ? 'bg-[#E2EBE2] text-[#2F4E36] border-[#45644F]/30' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 inline mr-1" />
              {showTranslations ? 'English Translations On' : 'Translations Off'}
            </button>
          </div>

          {/* Search & Language Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F5] p-3 rounded-xl border border-[#E8E5DA]">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search spoken dialogue or faculty name..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E8E5DA] rounded-lg focus:ring-2 focus:ring-[#45644F] outline-none"
              />
            </div>

            {/* Language Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {(['All', 'Hindi', 'English', 'Hinglish'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguageFilter(lang)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    languageFilter === lang
                      ? 'bg-[#45644F] text-white shadow-xs'
                      : 'bg-white text-[#6B7280] border border-[#E8E5DA] hover:text-[#1C251E]'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Audio recording badge if available */}
          {meeting.audio_file_path && (
            <div className="p-3 bg-[#F3EFE6] rounded-xl border border-[#E8E5DA] flex items-center justify-between text-xs text-[#1C251E]">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-[#45644F]" />
                <span className="font-semibold">Meeting Audio Ingested &amp; Verified</span>
              </div>
              <span className="text-[11px] text-[#6B7280]">
                Multimodal Gemini 3.6 Flash Engine
              </span>
            </div>
          )}

          {/* Utterances List */}
          <div className="space-y-4">
            {filteredUtterances.length > 0 ? (
              filteredUtterances.map((u, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E5DA] hover:border-[#45644F]/40 transition-colors space-y-2.5"
                >
                  {/* Header: Faculty Avatar, Name, Diarization Badge, Language Badge, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#45644F] text-white flex items-center justify-center text-xs font-bold">
                        {u.speaker ? u.speaker.charAt(0) : 'F'}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-[#1C251E]">{u.speaker}</span>
                        <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#E1EFE1] text-[#2E6838] border border-[#2E6838]/20">
                          Auto-Identified Faculty
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Language Badge */}
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase border ${
                        u.language === 'Hindi'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : u.language === 'Hinglish'
                          ? 'bg-teal-100 text-teal-900 border-teal-300'
                          : 'bg-blue-100 text-blue-900 border-blue-300'
                      }`}>
                        {u.language || 'English'}
                      </span>
                      <span className="text-xs text-[#6B7280] font-mono">
                        {formatTimestamp(u.timestamp, u.start)}
                      </span>
                    </div>
                  </div>

                  {/* Original Spoken Text */}
                  <p className="text-sm text-[#1C251E] leading-relaxed pl-9">
                    {u.text}
                  </p>

                  {/* English Translation Callout (if Hindi/Hinglish) */}
                  {showTranslations && u.translation && u.translation !== u.text && (
                    <div className="ml-9 p-3 bg-white rounded-lg border border-[#E8E5DA] text-xs text-[#4A5568] flex items-start space-x-2">
                      <Globe className="w-3.5 h-3.5 text-[#45644F] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#1C251E] font-semibold mr-1">English Translation:</strong>
                        <span>{u.translation}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-[#6B7280] bg-[#FAF9F5] rounded-xl border border-dashed border-[#E8E5DA]">
                <Languages className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-[#1C251E]">No matching utterances found</p>
                <p className="text-xs text-[#6B7280] mt-1">Upload a recording to generate a bilingual diarized transcript.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Action Items */}
      {activeTab === 'actions' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E8E5DA] gap-2 mb-4">
            <div>
              <h3 className="font-bold text-[#1C251E] text-lg">Faculty Action Tracker</h3>
              <p className="text-xs text-[#6B7280]">
                Deliverables automatically assigned to faculty members with priorities and deadlines.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E1EFE1] text-[#2E6838] self-start sm:self-auto">
              {meeting.action_items?.filter(a => a.status === 'Completed').length || 0} / {meeting.action_items?.length || 0} Completed
            </span>
          </div>

          <div className="divide-y divide-[#E8E5DA]/60">
            {meeting.action_items && meeting.action_items.length > 0 ? (
              meeting.action_items.map((item) => (
                <div key={item.id} className="py-4 flex items-start space-x-3.5 hover:bg-[#FAF9F5] px-2 rounded-xl transition-colors">
                  <button
                    onClick={() => handleToggleAction(item.id)}
                    className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      item.status === 'Completed'
                        ? 'bg-[#45644F] border-[#45644F] text-white'
                        : 'border-gray-300 hover:border-[#45644F] bg-white'
                    }`}
                  >
                    {item.status === 'Completed' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${item.status === 'Completed' ? 'line-through text-gray-400' : 'text-[#1C251E]'}`}>
                      {item.task}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
                      {/* Faculty Owner Pill with Avatar */}
                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-[#E8E5DA] rounded-lg shadow-2xs font-semibold text-[#1C251E]">
                        <div className="w-4 h-4 rounded-full bg-[#45644F]/10 text-[#45644F] text-[10px] font-bold flex items-center justify-center">
                          {item.owner_name.charAt(0)}
                        </div>
                        <span>{item.owner_name}</span>
                      </div>

                      {item.due_date && (
                        <span className="inline-flex items-center space-x-1 text-xs text-[#6B7280]">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Due: <strong>{new Date(item.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase shrink-0 ${
                      item.priority === 'High'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : item.priority === 'Medium'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {item.priority}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">No action items assigned for this meeting.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Speaker Name Mapping */}
      {activeTab === 'mapping' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-6 space-y-6">
          <div>
            <div className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-[#45644F]" />
              <h3 className="font-bold text-[#1C251E] text-lg">Speaker Diarization Mapping</h3>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              Zero-Manual Diarization is active: Gemini automatically identifies speakers by name. You can use this section if you wish to override or remap any speaker tag.
            </p>
          </div>

          {mappingSuccess && (
            <div className="p-3 bg-[#E1EFE1] text-[#2E6838] border border-[#2E6838]/20 rounded-xl text-xs font-semibold">
              {mappingSuccess}
            </div>
          )}

          <form onSubmit={handleUpdateSpeakerMapping} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1C251E] uppercase mb-1">Speaker Tag</label>
              <select
                value={speakerLabel}
                onChange={(e) => setSpeakerLabel(e.target.value)}
                className="w-full px-3 py-2 border border-[#E8E5DA] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#45644F]"
              >
                <option value="Speaker A">Speaker A</option>
                <option value="Speaker B">Speaker B</option>
                <option value="Speaker C">Speaker C</option>
                <option value="Speaker D">Speaker D</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C251E] uppercase mb-1">Target Faculty Name</label>
              <input
                type="text"
                required
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="e.g., Dr. Ananya Sharma"
                className="w-full px-3 py-2 border border-[#E8E5DA] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#45644F]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#45644F] hover:bg-[#385240] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
              >
                Apply Mapping
              </button>
            </div>
          </form>

          {/* Current Attendees */}
          <div className="pt-4 border-t border-[#E8E5DA]">
            <h4 className="text-xs font-bold text-[#1C251E] uppercase mb-3">Meeting Attendees &amp; Diarization Tags</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {meeting.participants?.map((p, i) => (
                <div key={i} className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E8E5DA] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-[#45644F]/10 text-[#45644F] text-xs font-bold flex items-center justify-center">
                      {p.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm text-[#1C251E]">{p.name}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#E2EBE2] text-[#2F4E36] text-xs font-bold rounded">
                    {p.speaker_label || 'Auto-Diarized'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: AI Meeting Q&A */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-[#45644F]" />
            <h3 className="font-bold text-[#1C251E] text-lg">AI Meeting Assistant</h3>
          </div>
          <p className="text-xs text-[#6B7280]">
            Ask questions about decisions, discussion topics, or assigned action items from this meeting.
          </p>

          <form onSubmit={handleAskAI} className="flex gap-2">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="e.g., 'What decisions were agreed upon regarding the examination timetable?'"
              className="flex-1 px-4 py-2 text-sm border border-[#E8E5DA] rounded-xl focus:ring-2 focus:ring-[#45644F] outline-none"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="px-5 py-2 bg-[#45644F] hover:bg-[#385240] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition-colors"
            >
              {aiLoading ? 'Analyzing...' : 'Ask'}
            </button>
          </form>

          {aiAnswer && (
            <div className="mt-4 p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E5DA] text-sm text-[#1C251E] whitespace-pre-line">
              <div className="font-semibold text-[#2F4E36] mb-1 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-[#45644F]" />
                <span>AI Assistant Response:</span>
              </div>
              {aiAnswer}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
