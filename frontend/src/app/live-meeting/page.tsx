'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video,
  VideoOff,
  Copy,
  Check,
  Radio,
  Sparkles,
  AlertCircle,
  Clock,
  Mic,
  MicOff,
  Info,
  ScreenShare,
  Maximize2,
  ExternalLink,
  Users,
  CheckCircle2,
  Volume2
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
  const [activeTab, setActiveTab] = useState<'studio' | 'jitsi'>('studio');
  
  // Media states
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [titleError, setTitleError] = useState('');
  
  // Recording & Pipeline states
  const [isProcessingMoM, setIsProcessingMoM] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [pipelineStage, setPipelineStage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const jitsiDirectLink = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false`;

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, []);

  const cleanupMedia = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const setupAudioVisualizer = (stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn('Audio visualizer setup skipped:', e);
    }
  };

  const handleStartMeeting = async () => {
    if (!meetingTitle.trim()) {
      setTitleError('Please enter a meeting title before launching.');
      return;
    }
    setTitleError('');
    setMediaError('');
    audioChunksRef.current = [];

    let mediaStream: MediaStream | null = null;

    try {
      // 1. Try requesting camera + microphone first
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      setCameraActive(true);
      setMicActive(true);
    } catch (videoErr: any) {
      console.warn('Camera request failed, trying audio-only:', videoErr);
      try {
        // Fallback to audio only if webcam is unavailable or in use
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        setCameraActive(false);
        setMicActive(true);
        setMediaError('Webcam unavailable or blocked. Running in High-Fidelity Audio Mode.');
      } catch (audioErr: any) {
        console.warn('Audio permission denied:', audioErr);
        setMediaError('Microphone and camera permission was denied. Meeting will proceed, but audio cannot be recorded for automated MoM.');
        setMicActive(false);
        setCameraActive(false);
      }
    }

    if (mediaStream) {
      streamRef.current = mediaStream;

      // Attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Audio spectrum visualizer
      setupAudioVisualizer(mediaStream);

      // Setup recorder
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        const recorder = mimeType
          ? new MediaRecorder(mediaStream, { mimeType })
          : new MediaRecorder(mediaStream);

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.start(1000);
      } catch (recErr) {
        console.warn('MediaRecorder init failed:', recErr);
      }
    }

    // Start elapsed timer
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    setIsLive(true);
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraActive(videoTrack.enabled);
    } else if (!cameraActive) {
      // Try to acquire camera track if not previously granted
      navigator.mediaDevices.getUserMedia({ video: true }).then(vStream => {
        const newTrack = vStream.getVideoTracks()[0];
        streamRef.current?.addTrack(newTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        setCameraActive(true);
      }).catch(err => {
        alert('Could not enable camera: ' + err.message);
      });
    }
  };

  // Toggle Microphone
  const toggleMic = () => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicActive(audioTrack.enabled);
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert back to webcam
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        const screenTrack = streamRef.current?.getVideoTracks()[0];
        if (screenTrack) {
          streamRef.current?.removeTrack(screenTrack);
          screenTrack.stop();
        }
        streamRef.current?.addTrack(camTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        setIsScreenSharing(false);
        setCameraActive(true);
      } catch (e) {
        setIsScreenSharing(false);
      }
    } else {
      // Request screen share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
          setIsScreenSharing(false);
        };

        const existingVideoTrack = streamRef.current?.getVideoTracks()[0];
        if (existingVideoTrack) {
          streamRef.current?.removeTrack(existingVideoTrack);
          existingVideoTrack.stop();
        }

        streamRef.current?.addTrack(screenTrack);
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        setIsScreenSharing(true);
      } catch (err: any) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Finish meeting & trigger AI MoM generation
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
            setProcessingStatus('Gemini synthesizing structured MoM & action items (Zero Hallucination)...');
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
        cleanupMedia();
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#173A2C] dark:text-[#E8F0EC]">
            Live Video Conferencing &amp; Studio
          </h1>
          <p className="text-sm text-[#667875] dark:text-[#8FA89C] mt-1">
            Real-time multi-speaker video room with instant AI transcript &amp; automated Minutes of Meeting.
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
              <span>{micActive ? 'RECORDING' : 'MUTED'}</span>
              <span className="font-mono text-[11px] bg-white dark:bg-[#1A2B24]/70 px-1.5 py-0.5 rounded">
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

      {/* AI Pipeline Loading Modal */}
      {isProcessingMoM && (
        <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-8 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-lg max-w-xl mx-auto space-y-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-[#E4F2F4] dark:bg-[#1A3A3F] border border-[#B9DDE3] dark:border-[#2A5A63] flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="w-8 h-8 text-[#367C88] dark:text-[#4DA3B0] animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#173A2C] dark:text-[#E8F0EC]">
              Synthesizing Meeting Intelligence
            </h2>
            <p className="text-xs text-[#667875] dark:text-[#8FA89C] font-mono">
              {processingStatus}
            </p>
          </div>

          <div className="w-full bg-[#F5FAF8] dark:bg-[#0F1A15] rounded-full h-2 overflow-hidden border border-[#DCE7E2] dark:border-[#2D4A3E]">
            <div
              className="bg-[#78A98F] h-full transition-all duration-500 rounded-full"
              style={{ width: `${Math.round(((pipelineStage + 1) / PIPELINE_STEPS.length) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-7 gap-1 pt-2">
            {PIPELINE_STEPS.map((step, idx) => (
              <div key={step} className="flex flex-col items-center space-y-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  idx < pipelineStage
                    ? 'bg-[#3F795F] text-white'
                    : idx === pipelineStage
                    ? 'bg-[#78A98F] text-white animate-bounce'
                    : 'bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C] border border-[#DCE7E2] dark:border-[#2D4A3E]'
                }`}>
                  {idx < pipelineStage ? '✓' : idx + 1}
                </div>
                <span className="text-[9px] text-[#667875] dark:text-[#8FA89C] truncate max-w-[50px] leading-tight text-center">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-launch Setup Card */}
      {!isLive && !isProcessingMoM && (
        <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-6 sm:p-8 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm max-w-xl mx-auto space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-[#DCE7E2] dark:border-[#2D4A3E]">
            <div className="w-10 h-10 rounded-2xl bg-[#E4F2F4] dark:bg-[#1A3A3F] border border-[#B9DDE3] dark:border-[#2A5A63] flex items-center justify-center text-[#367C88] dark:text-[#4DA3B0] flex-shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#173A2C] dark:text-[#E8F0EC]">
                Instant Meeting Studio
              </h2>
              <p className="text-xs text-[#667875] dark:text-[#8FA89C]">
                Configure title and attendees before starting session
              </p>
            </div>
          </div>

          {titleError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{titleError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Meeting Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Computer Science Curriculum Review 2026"
                value={meetingTitle}
                onChange={(e) => {
                  setMeetingTitle(e.target.value);
                  if (titleError) setTitleError('');
                }}
                className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder-[#667875] dark:placeholder-[#8FA89C] focus:outline-none focus:ring-2 focus:ring-[#78A98F]/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Faculty Attendees (Optional roster hint)
              </label>
              <input
                type="text"
                placeholder="e.g. Prof. Sharma, Dr. Anita Rao, Prof. Mishra"
                value={attendeeNames}
                onChange={(e) => setAttendeeNames(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder-[#667875] dark:placeholder-[#8FA89C] focus:outline-none focus:ring-2 focus:ring-[#78A98F]/40 transition-all"
              />
              <p className="text-[11px] text-[#667875] dark:text-[#8FA89C] mt-1">
                Leave blank — Gemini will auto-detect speakers from speech diarization.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Shareable Room Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={jitsiDirectLink}
                  className="flex-1 px-3 py-2 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs text-[#667875] dark:text-[#8FA89C] outline-none font-mono truncate"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(jitsiDirectLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] flex items-center space-x-1 cursor-pointer flex-shrink-0 transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#3F795F] dark:text-[#78A98F]" /> : <Copy className="w-3.5 h-3.5 text-[#667875] dark:text-[#8FA89C]" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#667875] dark:text-[#8FA89C] mt-1">
                Colleagues can join using this link from any device or browser.
              </p>
            </div>

            <div className="flex items-start space-x-2.5 p-3.5 bg-[#E4F2F4] dark:bg-[#1A3A3F]/50 border border-[#B9DDE3] dark:border-[#2A5A63] rounded-2xl">
              <Info className="w-4 h-4 text-[#367C88] dark:text-[#4DA3B0] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#173A2C] dark:text-[#E8F0EC] leading-relaxed">
                <strong>Camera &amp; Audio Studio:</strong> ConverseIQ captures real-time video, microphone audio, and screen sharing. Clicking &quot;End &amp; Generate MoM&quot; triggers instant AI transcription.
              </div>
            </div>
          </div>

          <AnimatedButton
            variant="primary"
            className="w-full py-3"
            icon={<Video className="w-4 h-4" />}
            onClick={handleStartMeeting}
          >
            Launch Video Conference Room
          </AnimatedButton>
        </div>
      )}

      {/* Live Active Conference View */}
      {isLive && !isProcessingMoM && (
        <div className="space-y-4 animate-fade-in">
          {mediaError && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-2xl text-xs text-amber-800 dark:text-amber-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>{mediaError}</span>
            </div>
          )}

          {/* Room Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#1A2B24] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-2xl shadow-xs">
            {/* View Switcher: Studio vs Jitsi */}
            <div className="flex items-center space-x-1 p-1 bg-[#F5FAF8] dark:bg-[#0F1A15] rounded-xl border border-[#DCE7E2] dark:border-[#2D4A3E]">
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'studio'
                    ? 'bg-[#78A98F] text-white shadow-xs'
                    : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
                }`}
              >
                🎥 ConverseIQ Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('jitsi')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'jitsi'
                    ? 'bg-[#78A98F] text-white shadow-xs'
                    : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
                }`}
              >
                🌐 Jitsi Multi-Party
              </button>
            </div>

            {/* Quick Actions (Mic, Camera, ScreenShare) */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMic}
                title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
                  micActive
                    ? 'bg-white dark:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] border-[#DCE7E2] dark:border-[#2D4A3E] hover:border-[#78A98F]'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-300'
                }`}
              >
                {micActive ? <Mic className="w-4 h-4 text-[#3F795F] dark:text-[#78A98F]" /> : <MicOff className="w-4 h-4 text-rose-500" />}
                <span>{micActive ? 'Mic On' : 'Muted'}</span>
              </button>

              <button
                onClick={toggleCamera}
                title={cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
                  cameraActive
                    ? 'bg-white dark:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] border-[#DCE7E2] dark:border-[#2D4A3E] hover:border-[#78A98F]'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-300'
                }`}
              >
                {cameraActive ? <Video className="w-4 h-4 text-[#3F795F] dark:text-[#78A98F]" /> : <VideoOff className="w-4 h-4 text-rose-500" />}
                <span>{cameraActive ? 'Camera On' : 'Camera Off'}</span>
              </button>

              <button
                onClick={toggleScreenShare}
                title="Share Screen"
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
                  isScreenSharing
                    ? 'bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#367C88] dark:text-[#4DA3B0] border-[#B9DDE3] dark:border-[#2A5A63]'
                    : 'bg-white dark:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] border-[#DCE7E2] dark:border-[#2D4A3E] hover:border-[#78A98F]'
                }`}
              >
                <ScreenShare className="w-4 h-4" />
                <span>{isScreenSharing ? 'Sharing' : 'Share'}</span>
              </button>

              {/* External tab join button for Jitsi */}
              <a
                href={jitsiDirectLink}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] inline-flex items-center space-x-1 transition-colors"
                title="Open meeting in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Tab</span>
              </a>
            </div>
          </div>

          {/* Main Stage View */}
          {activeTab === 'studio' ? (
            /* Tab 1: ConverseIQ Native WebRTC Video Stage */
            <div className="bg-[#141F1A] rounded-3xl border border-[#2D4A3E] overflow-hidden relative shadow-lg h-[580px] flex flex-col justify-between p-4">
              
              {/* Video Element */}
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {cameraActive || isScreenSharing ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="w-24 h-24 rounded-full bg-[#1A2B24] border border-[#2D4A3E] flex items-center justify-center text-white text-3xl font-bold shadow-md">
                      {meetingTitle.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <p className="text-sm font-semibold text-[#E8F0EC]">Camera is Paused</p>
                    <p className="text-xs text-[#8FA89C]">Microphone is actively capturing dialogue</p>
                  </div>
                )}
              </div>

              {/* Floating Room Info Tag (Top Left) */}
              <div className="relative z-10 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white text-xs font-medium w-fit">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold truncate max-w-[200px]">{meetingTitle}</span>
                <span className="text-white/40">|</span>
                <span className="text-white/80 font-mono">{formatTimer(elapsedSeconds)}</span>
              </div>

              {/* Floating Audio Level Meter & Controls (Bottom Center) */}
              <div className="relative z-10 self-center flex items-center space-x-3 bg-black/70 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/15">
                <Volume2 className="w-4 h-4 text-[#78A98F]" />
                <div className="flex items-center space-x-1">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        (audioLevel / 100) * 12 > i
                          ? 'bg-[#78A98F] h-4'
                          : 'bg-white/20 h-1.5'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-white/80 font-mono">
                  {micActive ? 'Live Audio' : 'Muted'}
                </span>
              </div>
            </div>
          ) : (
            /* Tab 2: Jitsi Multi-Party Embedded Frame */
            <div className="bg-white dark:bg-[#1A2B24] rounded-3xl border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm overflow-hidden h-[580px] relative">
              <iframe
                src={`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
                allow="camera *; microphone *; display-capture *; fullscreen; autoplay"
                className="w-full h-full border-0"
                title="ConverseIQ Multi-Party Video Meeting"
              />
            </div>
          )}

          {/* Footer Status Bar */}
          <div className="p-4 bg-[#D4E9DF] dark:bg-[#243D33]/60 border border-[#78A98F]/30 rounded-2xl text-xs text-[#173A2C] dark:text-[#E8F0EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#3F795F] dark:text-[#78A98F] flex-shrink-0" />
              <span>
                Meeting stream is actively capturing. When finished, click <strong>&quot;End &amp; Generate MoM&quot;</strong> to trigger Zero-Hallucination transcription &amp; decision extraction.
              </span>
            </div>
            <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-[#3F795F] dark:text-[#78A98F] flex-shrink-0 bg-white dark:bg-[#1A2B24]/70 px-2.5 py-1 rounded-lg border border-[#78A98F]/20">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
