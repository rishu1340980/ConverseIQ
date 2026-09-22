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
  CheckCircle2,
  Cpu,
  FileText
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';

const PIPELINE_STEPS = [
  'Upload',
  'Audio Processing',
  'Transcription',
  'Speaker ID',
  'Translation',
  'AI Analysis',
  'MoM Complete'
];

export default function LiveMeetingPage() {
  const router = useRouter();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendeeNames, setAttendeeNames] = useState('');
  const [roomName] = useState(`ConverseIQ-${Math.random().toString(36).substring(2, 8)}`);
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessingMoM, setIsProcessingMoM] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [pipelineStage, setPipelineStage] = useState(0);
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
    setProcessingStatus('Stopping recording and finalizing audio chunk...');
    setPipelineStage(0);

    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));

    const completeIngestion = async (audioBlob?: Blob) => {
      try {
        if (audioBlob && audioBlob.size > 2000) {
          setPipelineStage(0);
          setProcessingStatus('Uploading audio stream to AI pipeline...');
          
          const formData = new FormData();
          const fileExt = audioBlob.type.includes('webm') ? 'webm' : 'wav';
          formData.append('file', audioBlob, `live_meeting_${Date.now()}.${fileExt}`);
          formData.append('title', meetingTitle.trim() || 'Live Academic Meeting');
          formData.append('participants', attendeeNames.trim());
          formData.append('duration_minutes', String(durationMinutes));

          setTimeout(() => {
            setPipelineStage(1);
            setProcessingStatus('Processing raw audio spectra & normalising channels...');
          }, 800);

          setTimeout(() => {
            setPipelineStage(2);
            setProcessingStatus('Transcribing audio in Hindi, English & Hinglish...');
          }, 2000);

          setTimeout(() => {
            setPipelineStage(3);
            setProcessingStatus('Performing zero-manual faculty speaker diarization...');
          }, 3200);

          setTimeout(() => {
            setPipelineStage(4);
            setProcessingStatus('Generating side-by-side English translations...');
          }, 4200);

          setTimeout(() => {
            setPipelineStage(5);
            setProcessingStatus('Gemini 3.6 Flash synthesizing structured MoM & action items...');
          }, 5200);

          const result = await apiRequest('/meetings/upload-and-analyze', {
            method: 'POST',
            body: formData,
          });

          setPipelineStage(6);
          setProcessingStatus('MoM Ready! Redirecting to meeting intelligence...');
          setTimeout(() => router.push(`/meetings/${result.meeting_id}`), 900);
        } else {
          setPipelineStage(6);
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
    <div className="space-y-6 max-w-6xl animate-fade-in">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#173A2C]">
            Live Video Conferencing
          </h1>
          <p className="text-sm text-[#667875] mt-1">
            Launch a Jitsi Meet session with real-time mic recording and automated MoM generation.
          </p>
        </div>

        {isLive && !isProcessingMoM && (
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-bold rounded-full border ${
              micActive
                ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse-soft'
                : 'bg-amber-100 text-amber-700 border-amber-200'
            }`}>
              {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>{micActive ? 'REC' : 'NO MIC'}</span>
              <span className="font-mono text-[11px] bg-white/70 px-1.5 py-0.5 rounded">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>

            <AnimatedButton
              variant="primary"
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={handleFinishAndIngest}
              disabled={isProcessingMoM}
            >
              End &amp; Generate MoM
            </AnimatedButton>
          </div>
        )}
      </div>

      {/* Multi-Stage Pipeline Progress Overlay */}
      {isProcessingMoM && (
        <div className="bg-white rounded-3xl border border-[#DCE7E2] p-8 text-center space-y-6 shadow-xl max-w-2xl mx-auto animate-fade-in">
          <div className="relative w-16 h-16 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#D4E9DF] border-t-[#3F795F]"></div>
            <Sparkles className="w-6 h-6 text-[#3F795F] absolute inset-0 m-auto animate-pulse" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#173A2C]">AI Processing Pipeline Active</h3>
            <p className="text-xs text-[#3F795F] font-semibold mt-1 animate-pulse">{processingStatus}</p>
          </div>

          {/* Stepper Pipeline Indicator */}
          <div className="pt-2 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {PIPELINE_STEPS.map((step, idx) => {
                const isCompleted = idx < pipelineStage;
                const isCurrent = idx === pipelineStage;
                return (
                  <div
                    key={step}
                    className={`p-2 rounded-xl text-center border transition-all duration-300 flex flex-col items-center justify-between ${
                      isCompleted
                        ? 'bg-[#D4E9DF]/70 border-[#78A98F] text-[#3F795F]'
                        : isCurrent
                        ? 'bg-[#E4F2F4] border-[#367C88] text-[#367C88] shadow-xs scale-102 ring-1 ring-[#367C88]/30'
                        : 'bg-[#F5FAF8] border-[#DCE7E2] text-[#667875]/50'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mb-1">
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[3] text-[#3F795F]" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 rounded-full bg-[#367C88] animate-ping" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className="text-[10px] font-semibold leading-tight">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-[#667875]">
            Gemini 3.6 Flash engine is ingesting multimodal audio signals to formulate decisions, action assignments, and formal minutes.
          </p>
        </div>
      )}

      {/* Setup Form */}
      {!isLive && !isProcessingMoM && (
        <div className="bg-white rounded-3xl border border-[#DCE7E2] shadow-sm p-8 max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#E4F2F4] text-[#367C88] rounded-2xl mx-auto flex items-center justify-center shadow-xs">
              <Video className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#173A2C]">Start an Instant Academic Meeting</h2>
            <p className="text-xs text-[#667875] max-w-sm mx-auto leading-relaxed">
              A private Jitsi Meet room opens in this page. Your microphone is captured in real time and converted into Minutes of Meeting when you conclude.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                Meeting Topic / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => { setMeetingTitle(e.target.value); setTitleError(''); }}
                placeholder="e.g. Curriculum Review, Faculty Sync, Research Discussion"
                className={`w-full px-4 py-2.5 bg-white border rounded-xl text-sm text-[#173A2C] focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all placeholder:text-[#667875]/60 ${
                  titleError ? 'border-red-400' : 'border-[#DCE7E2]'
                }`}
              />
              {titleError && <p className="text-[11px] text-red-500 mt-1">{titleError}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] mb-1.5 flex items-center justify-between">
                <span>Attendees (Optional)</span>
                <span className="text-[10px] bg-[#D4E9DF] text-[#3F795F] font-bold px-2 py-0.5 rounded-full">
                  Helps Speaker Mapping
                </span>
              </label>
              <input
                type="text"
                value={attendeeNames}
                onChange={(e) => setAttendeeNames(e.target.value)}
                placeholder="Comma-separated names, e.g. Prof. Sharma, Dr. Mehta"
                className="w-full px-4 py-2.5 bg-white border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all placeholder:text-[#667875]/60"
              />
              <p className="text-[11px] text-[#667875] mt-1">
                Leave blank — Gemini will auto-detect speakers from audio diarization.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                Share Link with Attendees
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={jitsiDirectLink}
                  className="flex-1 px-3 py-2 bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-xs text-[#667875] outline-none font-mono truncate"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(jitsiDirectLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-[#F5FAF8] border border-[#DCE7E2] rounded-xl text-xs font-semibold text-[#173A2C] flex items-center space-x-1 cursor-pointer flex-shrink-0 transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#3F795F]" /> : <Copy className="w-3.5 h-3.5 text-[#667875]" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#667875] mt-1">
                Anyone with this link can join instantly — no credentials required.
              </p>
            </div>

            <div className="flex items-start space-x-2.5 p-3.5 bg-[#E4F2F4]/50 border border-[#B9DDE3] rounded-2xl">
              <Info className="w-4 h-4 text-[#367C88] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#173A2C] leading-relaxed">
                <strong>How recording works:</strong> Audio captured from your browser microphone is fed to the Gemini AI pipeline when you click &quot;End &amp; Generate MoM&quot;. Remote participants join via the Jitsi URL.
              </div>
            </div>
          </div>

          <AnimatedButton
            variant="primary"
            className="w-full py-3"
            icon={<Video className="w-4 h-4" />}
            onClick={handleStartMeeting}
          >
            Launch Video Meeting Room
          </AnimatedButton>
        </div>
      )}

      {/* Live Call — Jitsi Iframe */}
      {isLive && !isProcessingMoM && (
        <div className="space-y-4 animate-fade-in">
          {micError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>{micError}</span>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-[#DCE7E2] shadow-sm overflow-hidden h-[620px]">
            <iframe
              src={`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-full border-0"
              title="ConverseIQ Live Video Meeting"
            />
          </div>

          <div className="p-4 bg-[#D4E9DF]/60 border border-[#78A98F]/30 rounded-2xl text-xs text-[#173A2C] flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#3F795F] flex-shrink-0" />
              <span>
                {micActive
                  ? <>Microphone stream is actively recording. Click <strong>&quot;End &amp; Generate MoM&quot;</strong> when the session finishes to trigger multi-speaker transcription &amp; MoM distillation.</>
                  : <>Microphone inactive. Click <strong>&quot;End &amp; Generate MoM&quot;</strong> to finalize and record the session.</>
                }
              </span>
            </div>
            <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-[#3F795F] flex-shrink-0 bg-white/70 px-2.5 py-1 rounded-lg border border-[#78A98F]/20">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
