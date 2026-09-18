'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  Copy,
  Check,
  Radio,
  Sparkles,
  AlertCircle,
  Clock,
  Mic,
  MicOff,
  Info,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function LiveMeetingPage() {
  const router = useRouter();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendeeNames, setAttendeeNames] = useState('');
  const [roomName] = useState(`ConverseIQ-${Math.random().toString(36).substring(2, 8)}`);
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessingMoM, setIsProcessingMoM] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [titleError, setTitleError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const jitsiDirectLink = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false`;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleStartMeeting = async () => {
    if (!meetingTitle.trim()) {
      setTitleError('Please enter a meeting title before launching.');
      return;
    }
    setTitleError('');
    setMicError('');
    audioChunksRef.current = [];

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = micStream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = mimeType
        ? new MediaRecorder(micStream, { mimeType })
        : new MediaRecorder(micStream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(1000);
      setMicActive(true);
    } catch (err: any) {
      console.warn('Mic permission denied:', err);
      setMicError('Microphone permission was denied. The video call will continue, but audio will not be recorded for MoM generation.');
      setMicActive(false);
    }

    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    setIsLive(true);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleFinishAndIngest = async () => {
    if (isProcessingMoM) return;
    setIsProcessingMoM(true);
    setProcessingStatus('Stopping recording...');

    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));

    const completeIngestion = async (audioBlob?: Blob) => {
      try {
        if (audioBlob && audioBlob.size > 2000) {
          setProcessingStatus('Uploading meeting audio to AI pipeline...');
          const formData = new FormData();
          const fileExt = audioBlob.type.includes('webm') ? 'webm' : 'wav';
          formData.append('file', audioBlob, `live_meeting_${Date.now()}.${fileExt}`);
          formData.append('title', meetingTitle.trim() || 'Live Academic Meeting');
          formData.append('participants', attendeeNames.trim());
          formData.append('duration_minutes', String(durationMinutes));

          setTimeout(() => setProcessingStatus('Transcribing audio with multi-speaker diarization...'), 1500);
          setTimeout(() => setProcessingStatus('Gemini generating formal Minutes of Meeting & Action Items...'), 4000);

          const result = await apiRequest('/meetings/upload-and-analyze', {
            method: 'POST',
            body: formData,
          });

          setProcessingStatus('MoM ready! Redirecting...');
          setTimeout(() => router.push(`/meetings/${result.meeting_id}`), 800);
        } else {
          setProcessingStatus('Saving meeting record (no audio captured)...');
          const parsedParticipants = attendeeNames
            ? attendeeNames.split(',').map(n => n.trim()).filter(Boolean)
            : [];

          const newM = await apiRequest('/meetings', {
            method: 'POST',
            body: JSON.stringify({
              title: meetingTitle.trim() || 'Live Academic Meeting',
              date: new Date().toISOString(),
              duration_minutes: durationMinutes,
              status: 'Completed',
              participants: parsedParticipants.join(', '),
            }),
          });

          router.push(`/meetings/${newM.id}`);
        }
      } catch (err: any) {
        alert(err.message || 'Error processing live meeting recording. Please try again.');
        setIsProcessingMoM(false);
      } finally {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
      }
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        completeIngestion(audioBlob);
      };
      recorder.stop();
    } else {
      completeIngestion();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1C251E]">
            Live Video Conferencing
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Launch a Jitsi Meet room. Your microphone is recorded and auto-analyzed into Minutes of Meeting.
          </p>
        </div>

        {isLive && !isProcessingMoM && (
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-bold rounded-full border ${
              micActive
                ? 'bg-red-100 text-red-700 border-red-200 animate-pulse'
                : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>{micActive ? 'REC' : 'NO MIC'}</span>
              <span className="font-mono text-[11px] bg-white/60 px-1.5 py-0.5 rounded">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>

            <button
              onClick={handleFinishAndIngest}
              disabled={isProcessingMoM}
              className="px-4 py-2 bg-[#45644F] hover:bg-[#385240] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-75"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>End &amp; Generate MoM</span>
            </button>
          </div>
        )}
      </div>

      {/* Processing overlay */}
      {isProcessingMoM && (
        <div className="bg-white rounded-2xl border border-[#C9D8C9] p-8 text-center space-y-4 shadow-md max-w-lg mx-auto">
          <div className="relative w-14 h-14 mx-auto">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-[#E2EBE2] border-t-[#45644F]"></div>
            <Sparkles className="w-5 h-5 text-[#45644F] absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1C251E]">Processing Meeting Recording</h3>
            <p className="text-xs text-[#45644F] font-semibold mt-1 animate-pulse">{processingStatus}</p>
          </div>
          <p className="text-[11px] text-[#6B7280]">
            Gemini is transcribing audio and extracting decisions, action items, and a structured MoM.
          </p>
        </div>
      )}

      {/* Setup form */}
      {!isLive && !isProcessingMoM && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-8 max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#F0F5F1] text-[#45644F] rounded-2xl mx-auto flex items-center justify-center">
              <Video className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1C251E]">Start an Instant Academic Meeting</h2>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              A private Jitsi Meet room opens in this page. Your microphone is recorded and converted into Minutes of Meeting when you end the call.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                Meeting Topic / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => { setMeetingTitle(e.target.value); setTitleError(''); }}
                placeholder="e.g. Curriculum Review, Faculty Sync, Research Discussion"
                className={`w-full px-4 py-2.5 bg-[#F3EFE6] border rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none ${
                  titleError ? 'border-red-400' : 'border-[#E5E0D5]'
                }`}
              />
              {titleError && <p className="text-[11px] text-red-500 mt-1">{titleError}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5 flex items-center justify-between">
                <span>Attendees (Optional)</span>
                <span className="text-[10px] bg-[#DCE7DC] text-[#2F4E36] font-bold px-2 py-0.5 rounded-full">
                  Helps Speaker Mapping
                </span>
              </label>
              <input
                type="text"
                value={attendeeNames}
                onChange={(e) => setAttendeeNames(e.target.value)}
                placeholder="Comma-separated names, e.g. Prof. Sharma, Dr. Mehta"
                className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
              />
              <p className="text-[11px] text-[#6B7280] mt-1">
                Leave blank — Gemini will auto-detect speakers from audio.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                Share with Attendees
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={jitsiDirectLink}
                  className="flex-1 px-3 py-2 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-xs text-[#4B5563] outline-none font-mono truncate"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(jitsiDirectLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] rounded-xl text-xs font-semibold text-[#1C251E] flex items-center space-x-1 cursor-pointer flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-1">
                Anyone with this link can join instantly — no login needed.
              </p>
            </div>

            <div className="flex items-start space-x-2.5 p-3 bg-[#EEF3EE] border border-[#C9D8C9] rounded-xl">
              <Info className="w-4 h-4 text-[#45644F] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#2F4E36] leading-relaxed">
                <strong>How recording works:</strong> Your microphone audio is captured in the browser. When you click &quot;End &amp; Generate MoM&quot;, it is sent to Gemini AI to produce a full transcript, decisions, and action items. Remote participants join via the Jitsi link — ask them to speak clearly.
              </div>
            </div>
          </div>

          <button
            onClick={handleStartMeeting}
            className="w-full py-3 bg-[#45644F] hover:bg-[#385240] text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Video className="w-4 h-4" />
            <span>Launch Video Meeting Room</span>
          </button>
        </div>
      )}

      {/* Live call — Jitsi iframe */}
      {isLive && !isProcessingMoM && (
        <div className="space-y-4">
          {micError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>{micError}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm overflow-hidden h-[620px]">
            <iframe
              src={`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-full border-0"
              title="ConverseIQ Live Video Meeting"
            />
          </div>

          <div className="p-4 bg-[#E2EBE2] border border-[#C9D8C9] rounded-xl text-xs text-[#2F4E36] flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#45644F] flex-shrink-0" />
              <span>
                {micActive
                  ? <>Your microphone is being recorded. Click <strong>&quot;End &amp; Generate MoM&quot;</strong> when done to get structured Minutes of Meeting.</>
                  : <>Microphone not active. Click <strong>&quot;End &amp; Generate MoM&quot;</strong> to save the meeting record.</>
                }
              </span>
            </div>
            <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-[#2F4E36] flex-shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
