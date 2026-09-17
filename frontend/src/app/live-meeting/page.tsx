'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Video, 
  Copy, 
  Check, 
  Radio, 
  Sparkles, 
  Users, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { apiRequest, getAuthToken } from '@/lib/api';

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

  const [recordingSource, setRecordingSource] = useState<'both' | 'mic'>('both');
  const [remoteAudioCaptured, setRemoteAudioCaptured] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const jitsiDirectLink = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false`;
  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/live-meeting?room=${roomName}` 
    : jitsiDirectLink;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (displayStreamRef.current) displayStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  const handleStartMeeting = async () => {
    setMicError('');
    audioChunksRef.current = [];
    setRemoteAudioCaptured(false);

    let finalAudioStream: MediaStream | null = null;

    try {
      // 1. Get host microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;

      if (recordingSource === 'both' && navigator.mediaDevices.getDisplayMedia) {
        try {
          // 2. Optional: Capture tab/system audio to record remote participants
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          displayStreamRef.current = displayStream;

          const tabAudioTracks = displayStream.getAudioTracks();
          if (tabAudioTracks.length > 0) {
            // Mix both microphone and tab audio into a single stream
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const destination = audioCtx.createMediaStreamDestination();

            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(destination);

            const tabSource = audioCtx.createMediaStreamSource(new MediaStream(tabAudioTracks));
            tabSource.connect(destination);

            finalAudioStream = destination.stream;
            setRemoteAudioCaptured(true);
          } else {
            // User didn't check "Share audio" box in display picker, use mic stream
            finalAudioStream = micStream;
          }
        } catch (displayErr) {
          console.log('Tab audio sharing skipped or dismissed, proceeding with microphone only:', displayErr);
          finalAudioStream = micStream;
        }
      } else {
        finalAudioStream = micStream;
      }

      if (finalAudioStream) {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        const recorder = mimeType 
          ? new MediaRecorder(finalAudioStream, { mimeType }) 
          : new MediaRecorder(finalAudioStream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.start(1000); // 1s slice
        setMicActive(true);
      }
    } catch (err: any) {
      console.warn('Microphone permission not granted:', err);
      setMicError('Microphone not detected or permission was denied. Call will continue, but audio will not be recorded.');
      setMicActive(false);
    }

    // Start timer
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    setIsLive(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleFinishAndIngest = async () => {
    if (isProcessingMoM) return;
    setIsProcessingMoM(true);
    setProcessingStatus('Finalizing live meeting audio...');

    if (timerRef.current) clearInterval(timerRef.current);

    const recorder = mediaRecorderRef.current;
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));

    const completeIngestion = async (audioBlob?: Blob) => {
      try {
        if (audioBlob && audioBlob.size > 1000) {
          // Real recorded audio is available! Send directly to AI MoM pipeline
          setProcessingStatus('Uploading recorded meeting audio...');
          const formData = new FormData();
          const fileExt = audioBlob.type.includes('webm') ? 'webm' : 'wav';
          formData.append('file', audioBlob, `live_meeting_${Date.now()}.${fileExt}`);
          formData.append('title', meetingTitle.trim() || 'Live Academic Meeting');
          formData.append('participants', attendeeNames.trim());
          formData.append('duration_minutes', String(durationMinutes));

          setTimeout(() => {
            setProcessingStatus('Transcribing multi-speaker audio with diarization...');
          }, 1500);

          setTimeout(() => {
            setProcessingStatus('Gemini extracting formal Minutes of Meeting & Action Items...');
          }, 3500);

          const result = await apiRequest('/meetings/upload-and-analyze', {
            method: 'POST',
            body: formData,
          });

          setProcessingStatus('MoM Generation Complete! Redirecting to meeting page...');
          setTimeout(() => {
            router.push(`/meetings/${result.meeting_id}`);
          }, 800);
        } else {
          // No audio captured (e.g. mic was denied or ended immediately)
          setProcessingStatus('Saving meeting record...');
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
              participants: parsedParticipants,
            }),
          });

          router.push(`/meetings/${newM.id}`);
        }
      } catch (err: any) {
        alert(err.message || 'Error processing live meeting recording');
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
          type: recorder.mimeType || 'audio/webm' 
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
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1C251E]">
            Live Video Conferencing
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Jitsi Meet room with real-time browser audio recording connected directly to the MoM pipeline.
          </p>
        </div>

        {isLive && (
          <div className="flex items-center space-x-3">
            {/* Live timer badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse border border-red-200">
              <Radio className="w-3.5 h-3.5" />
              <span>
                {micActive 
                  ? (remoteAudioCaptured ? 'REC: MIC + REMOTE' : 'REC: MIC ONLY') 
                  : 'CALL LIVE (NO MIC)'}
              </span>
              <span className="font-mono text-[11px] bg-red-200/80 px-1.5 py-0.5 rounded">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>

            <button
              onClick={handleFinishAndIngest}
              disabled={isProcessingMoM}
              className="px-4 py-2 bg-[#45644F] hover:bg-[#385240] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-75"
            >
              {isProcessingMoM ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>End &amp; Generate MoM</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Processing overlay modal if finalizing */}
      {isProcessingMoM && (
        <div className="bg-white rounded-2xl border border-[#C9D8C9] p-8 text-center space-y-4 shadow-md max-w-lg mx-auto">
          <div className="relative w-14 h-14 mx-auto">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-[#E2EBE2] border-t-[#45644F]"></div>
            <Sparkles className="w-5 h-5 text-[#45644F] absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1C251E]">Ingesting Live Meeting into MoM Pipeline</h3>
            <p className="text-xs text-[#45644F] font-semibold mt-1 animate-pulse">
              {processingStatus}
            </p>
          </div>
          <p className="text-[11px] text-[#6B7280]">
            Audio is being converted and passed to Gemini for multi-speaker diarization and factual MoM distillation.
          </p>
        </div>
      )}

      {!isLive && !isProcessingMoM && (
        <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-8 max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-[#F0F5F1] text-[#45644F] rounded-2xl mx-auto flex items-center justify-center shadow-xs">
            <Video className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#1C251E]">Start an Instant Academic Meeting</h2>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
              Launch a secure Jitsi Meet room. Browser audio will be captured and automatically transformed into Minutes of Meeting once you finish.
            </p>
          </div>

          <div className="text-left space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                Meeting Topic / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="e.g. Curriculum Review, Faculty Sync, or Research Discussion"
                className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5 flex items-center justify-between">
                <span>Invited Attendees (Optional)</span>
                <span className="text-[10px] bg-[#DCE7DC] text-[#2F4E36] font-bold px-2 py-0.5 rounded-full">
                  Speaker Mapping
                </span>
              </label>
              <input
                type="text"
                value={attendeeNames}
                onChange={(e) => setAttendeeNames(e.target.value)}
                placeholder="Comma-separated names, or leave blank to auto-detect"
                className="w-full px-4 py-2.5 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-sm text-[#1C251E] focus:bg-white focus:ring-2 focus:ring-[#45644F] outline-none"
              />
              <p className="text-[11px] text-[#6B7280] mt-1">
                Optional: Leave blank to auto-detect speakers from spoken dialogue.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                Shareable Invite Link (For Remote Faculty / Attendees)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={jitsiDirectLink}
                  className="flex-1 px-3 py-2 bg-[#F3EFE6] border border-[#E5E0D5] rounded-xl text-xs text-[#4B5563] outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(jitsiDirectLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] rounded-xl text-xs font-semibold text-[#1C251E] flex items-center space-x-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-1">
                Share this link with anyone — they can join instantly from their phone or laptop without logging in.
              </p>
            </div>

            {/* Recording Source Selection */}
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1.5">
                Audio Capture Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div 
                  onClick={() => setRecordingSource('both')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    recordingSource === 'both'
                      ? 'border-[#45644F] bg-[#F0F5F1] shadow-xs'
                      : 'border-[#E8E5DA] bg-[#FAF9F5] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      recordingSource === 'both' ? 'border-[#45644F]' : 'border-gray-400'
                    }`}>
                      {recordingSource === 'both' && <span className="w-2 h-2 rounded-full bg-[#45644F]"></span>}
                    </span>
                    <span className="text-xs font-bold text-[#1C251E]">Full Conference Audio</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-1 pl-5">
                    Records both your mic + remote attendees&apos; voices. Browser will ask to share tab audio.
                  </p>
                </div>

                <div 
                  onClick={() => setRecordingSource('mic')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    recordingSource === 'mic'
                      ? 'border-[#45644F] bg-[#F0F5F1] shadow-xs'
                      : 'border-[#E8E5DA] bg-[#FAF9F5] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      recordingSource === 'mic' ? 'border-[#45644F]' : 'border-gray-400'
                    }`}>
                      {recordingSource === 'mic' && <span className="w-2 h-2 rounded-full bg-[#45644F]"></span>}
                    </span>
                    <span className="text-xs font-bold text-[#1C251E]">Microphone Only</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-1 pl-5">
                    Best for solo testing or when attendees are sitting in the same physical room.
                  </p>
                </div>
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

      {isLive && !isProcessingMoM && (
        <div className="space-y-4">
          {micError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>{micError}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm overflow-hidden h-[620px]">
            <iframe
              src={`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-full border-0"
              title="ConverseIQ Live Video"
            />
          </div>

          <div className="p-4 bg-[#E2EBE2] border border-[#C9D8C9] rounded-xl text-xs text-[#2F4E36] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#45644F] flex-shrink-0" />
              <span>
                Meeting audio is being captured in real time. When you finish, click <strong>&quot;End &amp; Generate MoM&quot;</strong> in the top right to process multi-speaker diarization!
              </span>
            </div>
            <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-[#2F4E36]">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

