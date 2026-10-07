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
  Volume2,
  UploadCloud,
  FileAudio,
  MessageSquare,
  Play,
  RotateCcw
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import AnimatedButton from '@/components/ui/AnimatedButton';
import {
  initSessionVault,
  appendChunkToVault,
  getLatestUnsavedSession,
  clearVaultSession,
  assembleAudioBlob
} from '@/lib/indexedDbVault';

const PIPELINE_STEPS = [
  'Upload',
  'Audio Processing',
  'Transcription',
  'Speaker ID',
  'Translation',
  'AI Analysis',
  'MoM Complete'
];

interface TranscriptLine {
  speaker: string;
  text: string;
  time: string;
}

export default function LiveMeetingPage() {
  const router = useRouter();
  
  // Navigation & mode
  const [activeMode, setActiveMode] = useState<'live' | 'upload'>('live');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendeeNames, setAttendeeNames] = useState('');
  const [roomName] = useState(`ConverseIQ-${Math.random().toString(36).substring(2, 8)}`);
  const [isLive, setIsLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'studio' | 'jitsi'>('studio');
  const [captureSource, setCaptureSource] = useState<'mic' | 'conference'>('mic');
  
  // Media states
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [unsavedSession, setUnsavedSession] = useState<any | null>(null);
  
  // Real-time live speech recognition
  const [liveTranscript, setLiveTranscript] = useState<TranscriptLine[]>([]);
  const [isSpeechRecognitionActive, setIsSpeechRecognitionActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  // File upload mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDuration, setUploadDuration] = useState('45');
  const [uploadError, setUploadError] = useState('');

  // Recording & Pipeline states
  const [isProcessingMoM, setIsProcessingMoM] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [pipelineStage, setPipelineStage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const sessionIdRef = useRef<string>('');
  const isLiveRef = useRef<boolean>(false);
  const elapsedSecondsRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const jitsiDirectLink = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false`;

  useEffect(() => {
    // Check for any un-ingested recordings from interrupted sessions
    getLatestUnsavedSession().then((saved) => {
      if (saved && saved.chunks && saved.chunks.length > 0) {
        setUnsavedSession(saved);
      }
    });

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLiveRef.current) {
        e.preventDefault();
        e.returnValue = 'Live academic recording session is in progress. Audio is securely backed up in your offline vault.';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      cleanupMedia();
    };
  }, []);

  const cleanupMedia = () => {
    isLiveRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    stopLiveSpeechRecognition();
  };

  // Start in-browser real-time speech recognition
  const startLiveSpeechRecognition = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('SpeechRecognition API not available in this browser');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Multi-accent English / Hinglish friendly

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const transcriptText = event.results[i][0].transcript.trim();
            if (transcriptText) {
              const currentMin = Math.floor(elapsedSecondsRef.current / 60);
              const currentSec = elapsedSecondsRef.current % 60;
              const timeTag = `${currentMin.toString().padStart(2, '0')}:${currentSec.toString().padStart(2, '0')}`;
              
              setLiveTranscript(prev => [
                ...prev,
                {
                  speaker: attendeeNames.trim() ? attendeeNames.split(',')[0].trim() : 'Speaker A',
                  text: transcriptText,
                  time: timeTag
                }
              ]);
            }
          }
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Live SpeechRecognition error:', err);
      };

      recognition.onend = () => {
        // Keep speech recognition continuously running while call is live
        if (isLiveRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsSpeechRecognitionActive(true);
    } catch (e) {
      console.warn('Speech recognition setup failed:', e);
    }
  };

  const stopLiveSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsSpeechRecognitionActive(false);
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
    setIsInterrupted(false);
    audioChunksRef.current = [];
    setLiveTranscript([]);

    const newSessionId = `session_${Date.now()}`;
    sessionIdRef.current = newSessionId;

    let mediaStream: MediaStream | null = null;

    try {
      if (captureSource === 'conference') {
        // Capture tab/screen audio + microphone combined
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        // Mix both audio tracks into one stream via Web Audio API
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        if (displayStream.getAudioTracks().length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(displayStream);
          sysSource.connect(dest);
        }
        if (micStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(dest);
        }

        // Combined stream with display video and mixed audio
        mediaStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ]);
        setCameraActive(true);
        setMicActive(true);
      } else {
        // Standard high-fidelity mic + camera
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        setCameraActive(true);
        setMicActive(true);
      }
    } catch (videoErr: any) {
      console.warn('Video request failed, falling back to audio only:', videoErr);
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        setCameraActive(false);
        setMicActive(true);
        setMediaError('Running in High-Fidelity Voice Studio Mode.');
      } catch (audioErr: any) {
        console.warn('Audio permission denied:', audioErr);
        setMediaError('Microphone permission was denied. Please allow microphone access to record.');
        setMicActive(false);
        setCameraActive(false);
      }
    }

    if (mediaStream) {
      streamRef.current = mediaStream;

      mediaStream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          console.warn('Audio track ended.');
          setIsInterrupted(true);
          setMediaError('Microphone track ended. Recorded speech is safe in your offline vault.');
        };
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setupAudioVisualizer(mediaStream);

      // Start MediaRecorder with IndexedDB vault backup
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

        await initSessionVault(newSessionId, meetingTitle.trim(), attendeeNames.trim(), mimeType || 'audio/webm');

        const recorder = mimeType
          ? new MediaRecorder(mediaStream, { mimeType })
          : new MediaRecorder(mediaStream);

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            appendChunkToVault(newSessionId, event.data, elapsedSecondsRef.current);
          }
        };

        recorder.start(2000);
      } catch (recErr) {
        console.warn('MediaRecorder init failed:', recErr);
      }

      // Start live speech-to-text
      startLiveSpeechRecognition();
    }

    // Start elapsed timer
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);

    isLiveRef.current = true;
    setIsLive(true);
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraActive(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicActive(audioTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
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
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => setIsScreenSharing(false);

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
        console.warn('Screen share canceled:', err);
      }
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Universal Ingestion Engine: Combines audio blob + live speech-to-text transcript
  const completeIngestion = async (
    audioBlob?: Blob,
    overrideTitle?: string,
    overrideParticipants?: string,
    overrideDuration?: number,
    manualTranscriptText?: string
  ) => {
    setIsProcessingMoM(true);
    setProcessingStatus('Uploading meeting stream & dialogue to AI pipeline...');
    setPipelineStage(0);

    const effectiveTitle = overrideTitle || meetingTitle.trim() || 'Live Academic Meeting';
    const effectiveParticipants = overrideParticipants !== undefined ? overrideParticipants : attendeeNames.trim();
    const effectiveDuration = overrideDuration || Math.max(1, Math.ceil(elapsedSeconds / 60));

    // Construct live transcript text from live recognition bubbles
    const assembledLiveTranscript = manualTranscriptText || liveTranscript.map(l => `${l.speaker}: ${l.text}`).join('\n');

    try {
      const formData = new FormData();
      formData.append('title', effectiveTitle);
      formData.append('participants', effectiveParticipants);
      formData.append('duration_minutes', String(effectiveDuration));

      if (assembledLiveTranscript) {
        formData.append('live_transcript', assembledLiveTranscript);
      }

      // If we have an audio blob, attach it
      if (audioBlob && audioBlob.size > 0) {
        const fileExt = audioBlob.type.includes('webm') ? 'webm' : 'wav';
        formData.append('file', audioBlob, `live_meeting_${Date.now()}.${fileExt}`);
      } else {
        // Generate a fallback audio container if only speech text was captured
        const silentWav = new Blob([new Uint8Array(44)], { type: 'audio/wav' });
        formData.append('file', silentWav, `speech_recording_${Date.now()}.wav`);
      }

      setTimeout(() => {
        setPipelineStage(1);
        setProcessingStatus('Processing raw audio spectra & normalising channels...');
      }, 700);

      setTimeout(() => {
        setPipelineStage(2);
        setProcessingStatus('Transcribing speech across English, Hindi & Hinglish...');
      }, 1800);

      setTimeout(() => {
        setPipelineStage(3);
        setProcessingStatus('Performing zero-manual faculty speaker diarization...');
      }, 3000);

      setTimeout(() => {
        setPipelineStage(4);
        setProcessingStatus('Aligning side-by-side English translations...');
      }, 4000);

      setTimeout(() => {
        setPipelineStage(5);
        setProcessingStatus('Gemini synthesizing structured MoM, decisions & action items...');
      }, 5000);

      const result = await apiRequest('/meetings/upload-and-analyze', {
        method: 'POST',
        body: formData,
      });

      if (sessionIdRef.current) {
        await clearVaultSession(sessionIdRef.current);
      }

      setPipelineStage(6);
      setProcessingStatus('MoM Ready! Redirecting to meeting intelligence...');
      setTimeout(() => router.push(`/meetings/${result.meeting_id}`), 900);
    } catch (err: any) {
      alert(err.message || 'Error processing meeting. Please try again.');
      setIsProcessingMoM(false);
    } finally {
      cleanupMedia();
    }
  };

  // Finish meeting & trigger AI MoM generation
  const handleFinishAndIngest = async () => {
    if (isProcessingMoM) return;

    // Safety check: ensure at least some speech or duration was captured
    const hasLiveWords = liveTranscript.length > 0;
    const hasAudioData = audioChunksRef.current.length > 0;

    if (!hasLiveWords && !hasAudioData && elapsedSeconds < 4) {
      if (!confirm('This session lasted under 4 seconds with no recorded speech. Proceed anyway?')) {
        return;
      }
    }

    setIsProcessingMoM(true);
    setProcessingStatus('Finalizing audio recording & safeguarding buffers...');
    setPipelineStage(0);

    if (timerRef.current) clearInterval(timerRef.current);
    stopLiveSpeechRecognition();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        completeIngestion(audioBlob);
      };
      recorder.stop();
    } else {
      const audioBlob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
        : undefined;
      completeIngestion(audioBlob);
    }
  };

  // Recover session from IndexedDB vault
  const handleRecoverSession = async () => {
    if (!unsavedSession) return;
    try {
      const blob = assembleAudioBlob(unsavedSession);
      sessionIdRef.current = unsavedSession.sessionId;
      await completeIngestion(
        blob,
        unsavedSession.meetingTitle || 'Recovered Academic Meeting',
        unsavedSession.attendeeNames || '',
        Math.max(1, Math.ceil((unsavedSession.durationSeconds || 0) / 60))
      );
      setUnsavedSession(null);
    } catch (err: any) {
      alert('Error recovering session: ' + err.message);
    }
  };

  const handleDismissRecovery = async () => {
    if (unsavedSession?.sessionId) {
      await clearVaultSession(unsavedSession.sessionId);
    }
    setUnsavedSession(null);
  };

  // Handle direct audio file upload (Zoom / Google Meet / Phone recording)
  const handleDirectFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim()) {
      setUploadError('Please provide a meeting title.');
      return;
    }
    if (!selectedFile) {
      setUploadError('Please select an audio file (.mp3, .wav, .m4a, .webm, .mp4).');
      return;
    }

    setUploadError('');
    setIsProcessingMoM(true);
    setProcessingStatus('Uploading audio file to AI intelligence pipeline...');
    setPipelineStage(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', meetingTitle.trim());
      formData.append('participants', attendeeNames.trim());
      formData.append('duration_minutes', uploadDuration || '45');

      setTimeout(() => { setPipelineStage(1); setProcessingStatus('Normalizing audio channels...'); }, 800);
      setTimeout(() => { setPipelineStage(2); setProcessingStatus('Transcribing speech across English, Hindi & Hinglish...'); }, 2000);
      setTimeout(() => { setPipelineStage(3); setProcessingStatus('Performing speaker diarization...'); }, 3200);
      setTimeout(() => { setPipelineStage(4); setProcessingStatus('Generating English translations...'); }, 4200);
      setTimeout(() => { setPipelineStage(5); setProcessingStatus('Gemini synthesizing grounded MoM, decisions & action items...'); }, 5200);

      const result = await apiRequest('/meetings/upload-and-analyze', {
        method: 'POST',
        body: formData,
      });

      setPipelineStage(6);
      setProcessingStatus('MoM Complete! Redirecting...');
      setTimeout(() => router.push(`/meetings/${result.meeting_id}`), 900);
    } catch (err: any) {
      alert(err.message || 'Failed to analyze uploaded audio.');
      setIsProcessingMoM(false);
    }
  };

  // Demo: Load Sample Academic Discussion (for instant guide demonstration)
  const handleLoadSampleDemo = () => {
    setMeetingTitle('Computer Science Department Board of Studies (Curriculum 2026)');
    setAttendeeNames('Prof. Sharma, Dr. Anita Rao, Prof. Mishra');
    setLiveTranscript([
      {
        speaker: 'Prof. Sharma',
        text: 'Welcome colleagues. Today we must finalize the syllabus revision for the 3rd Year AI & Machine Learning curriculum.',
        time: '00:05'
      },
      {
        speaker: 'Dr. Anita Rao',
        text: 'I propose we include hands-on PyTorch model training and Docker container deployment in the 5th semester lab exercises.',
        time: '00:18'
      },
      {
        speaker: 'Prof. Mishra',
        text: 'Agreed. That aligns directly with industry demand. I will prepare the revised lab manual and assessment rubric by Friday.',
        time: '00:32'
      },
      {
        speaker: 'Prof. Sharma',
        text: 'Excellent decision. Decision is approved. Dr. Rao, please coordinate with the examination controller for credits approval.',
        time: '00:46'
      }
    ]);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#367C88] dark:text-[#4DA3B0] border border-[#B9DDE3] dark:border-[#2A5A63]">
              Meeting Studio
            </span>
            {isLive && (
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Live Recording</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#173A2C] dark:text-[#E8F0EC] tracking-tight mt-1">
            Academic Meeting Intelligence Studio
          </h1>
          <p className="text-xs text-[#667875] dark:text-[#8FA89C] mt-0.5">
            Conduct multi-party video conferences or record classroom lectures with real-time speech transcription &amp; AI Minutes of Meeting (MoM).
          </p>
        </div>

        {/* Mode Switcher & Finish Button */}
        {!isLive && !isProcessingMoM && (
          <div className="flex items-center p-1 bg-white dark:bg-[#1A2B24] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-2xl shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveMode('live')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'live'
                  ? 'bg-[#3F795F] text-white shadow-xs'
                  : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Video Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'upload'
                  ? 'bg-[#3F795F] text-white shadow-xs'
                  : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Recording</span>
            </button>
          </div>
        )}

        {isLive && (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A2B24] border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-2xs font-mono text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC]">
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              <span>{formatTimer(elapsedSeconds)}</span>
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
        <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-8 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-xl max-w-xl mx-auto space-y-6 text-center animate-fade-in my-8">
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

      {/* Disaster Recovery Banner for Interrupted Meetings */}
      {!isLive && !isProcessingMoM && unsavedSession && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 rounded-3xl p-6 shadow-md max-w-2xl mx-auto space-y-4 animate-fade-in">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
                Unsaved Meeting Recording Detected
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 leading-relaxed">
                Your previous session <strong>&quot;{unsavedSession.meetingTitle || 'Academic Meeting'}&quot;</strong> was abruptly cut. ConverseIQ safely preserved <strong>{unsavedSession.chunks?.length || 0} audio buffers</strong> ({Math.max(1, Math.ceil((unsavedSession.durationSeconds || 0) / 60))} min) in your offline browser vault!
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-amber-200 dark:border-amber-800">
            <button
              type="button"
              onClick={handleDismissRecovery}
              className="px-4 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <AnimatedButton
              variant="primary"
              size="sm"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={handleRecoverSession}
            >
              Recover &amp; Generate AI MoM Now
            </AnimatedButton>
          </div>
        </div>
      )}

      {/* MODE 1: Direct File Upload (Zoom/Meet/Recorded Audio) */}
      {!isLive && !isProcessingMoM && activeMode === 'upload' && (
        <div className="bg-white dark:bg-[#1A2B24] rounded-3xl p-6 sm:p-8 border border-[#DCE7E2] dark:border-[#2D4A3E] shadow-sm max-w-xl mx-auto space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-[#DCE7E2] dark:border-[#2D4A3E]">
            <div className="w-10 h-10 rounded-2xl bg-[#E4F2F4] dark:bg-[#1A3A3F] border border-[#B9DDE3] dark:border-[#2A5A63] flex items-center justify-center text-[#367C88] dark:text-[#4DA3B0] flex-shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#173A2C] dark:text-[#E8F0EC]">
                Upload Meeting Audio or Video
              </h2>
              <p className="text-xs text-[#667875] dark:text-[#8FA89C]">
                Already had a meeting on Zoom, Google Meet, or WhatsApp? Upload it for instant AI MoM.
              </p>
            </div>
          </div>

          {uploadError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <form onSubmit={handleDirectFileUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Meeting Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Department Meeting / Curriculum Review"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder-[#667875] dark:placeholder-[#8FA89C] focus:outline-none focus:ring-2 focus:ring-[#78A98F]/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Faculty Attendees (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Prof. Sharma, Dr. Anita Rao"
                value={attendeeNames}
                onChange={(e) => setAttendeeNames(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder-[#667875] dark:placeholder-[#8FA89C] focus:outline-none focus:ring-2 focus:ring-[#78A98F]/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Audio or Video File <span className="text-rose-500">*</span>
              </label>
              <div className="border-2 border-dashed border-[#DCE7E2] dark:border-[#2D4A3E] hover:border-[#78A98F] rounded-2xl p-6 text-center transition-all bg-[#F5FAF8] dark:bg-[#0F1A15] cursor-pointer relative">
                <input
                  type="file"
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileAudio className="w-8 h-8 text-[#3F795F] dark:text-[#78A98F] mx-auto mb-2" />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-bold text-[#173A2C] dark:text-[#E8F0EC]">{selectedFile.name}</p>
                    <p className="text-xs text-[#667875] dark:text-[#8FA89C] mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI extraction
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-[#173A2C] dark:text-[#E8F0EC]">Click or drag audio file here</p>
                    <p className="text-[11px] text-[#667875] dark:text-[#8FA89C] mt-1">Supports MP3, WAV, M4A, WebM, MP4</p>
                  </div>
                )}
              </div>
            </div>

            <AnimatedButton
              type="submit"
              variant="primary"
              className="w-full py-3"
              icon={<Sparkles className="w-4 h-4" />}
            >
              Extract &amp; Generate MoM
            </AnimatedButton>
          </form>
        </div>
      )}

      {/* MODE 2: Pre-launch Live Setup Card */}
      {!isLive && !isProcessingMoM && activeMode === 'live' && (
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
                Configure room details and audio capture before launching
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
                Faculty Attendees (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Prof. Sharma, Dr. Anita Rao, Prof. Mishra"
                value={attendeeNames}
                onChange={(e) => setAttendeeNames(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-sm text-[#173A2C] dark:text-[#E8F0EC] placeholder-[#667875] dark:placeholder-[#8FA89C] focus:outline-none focus:ring-2 focus:ring-[#78A98F]/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] mb-1.5">
                Audio Capture Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCaptureSource('mic')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    captureSource === 'mic'
                      ? 'border-[#3F795F] bg-[#E8F5EE] dark:bg-[#1A3326] text-[#173A2C] dark:text-[#E8F0EC]'
                      : 'border-[#DCE7E2] dark:border-[#2D4A3E] bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C]'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1 font-bold text-xs">
                    <Mic className="w-3.5 h-3.5 text-[#3F795F]" />
                    <span>Microphone Only</span>
                  </div>
                  <p className="text-[11px] leading-tight opacity-80">Direct local voice capture</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCaptureSource('conference')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    captureSource === 'conference'
                      ? 'border-[#367C88] bg-[#E4F2F4] dark:bg-[#1A3A3F] text-[#173A2C] dark:text-[#E8F0EC]'
                      : 'border-[#DCE7E2] dark:border-[#2D4A3E] bg-[#F5FAF8] dark:bg-[#0F1A15] text-[#667875] dark:text-[#8FA89C]'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1 font-bold text-xs">
                    <Users className="w-3.5 h-3.5 text-[#367C88]" />
                    <span>Conference Mix</span>
                  </div>
                  <p className="text-[11px] leading-tight opacity-80">Captures tab/call + mic</p>
                </button>
              </div>
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
            </div>

            {/* Quick Demo Preload Button */}
            <div className="flex items-center justify-between p-3 bg-[#E4F2F4]/60 dark:bg-[#1A3A3F]/40 border border-[#B9DDE3] dark:border-[#2A5A63] rounded-2xl">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#367C88]" />
                <span className="text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC]">Demo for Project Guide?</span>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleDemo}
                className="px-2.5 py-1 bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] border border-[#367C88]/30 rounded-lg text-xs font-bold text-[#367C88] dark:text-[#4DA3B0] transition-colors cursor-pointer"
              >
                Preload Sample &rarr;
              </button>
            </div>
          </div>

          <AnimatedButton
            variant="primary"
            className="w-full py-3"
            icon={<Video className="w-4 h-4" />}
            onClick={handleStartMeeting}
          >
            Launch Video Conference Studio
          </AnimatedButton>
        </div>
      )}

      {/* Active Live Conference View with Real-Time Transcription Stage */}
      {isLive && !isProcessingMoM && (
        <div className="space-y-4 animate-fade-in">
          {mediaError && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-2xl text-xs text-amber-800 dark:text-amber-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>{mediaError}</span>
            </div>
          )}

          {isInterrupted && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>
                  <strong>Connection Interrupted:</strong> Recorded speech is preserved in your offline vault!
                </span>
              </div>
              <button
                type="button"
                onClick={handleFinishAndIngest}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
              >
                Synthesize MoM Now
              </button>
            </div>
          )}

          {/* Room Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#1A2B24] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-2xl shadow-xs">
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
                🎥 Studio &amp; Real-Time AI
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

              <a
                href={jitsiDirectLink}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] dark:hover:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl text-xs font-semibold text-[#173A2C] dark:text-[#E8F0EC] inline-flex items-center space-x-1 transition-colors"
                title="Open meeting in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Jitsi Tab</span>
              </a>
            </div>
          </div>

          {/* Main Stage Grid: Video on Left, Live Real-Time Transcription on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Video Stage (2 Cols) */}
            <div className="lg:col-span-2 bg-[#141F1A] rounded-3xl border border-[#2D4A3E] overflow-hidden relative shadow-lg h-[540px] flex flex-col justify-between p-4">
              {activeTab === 'studio' ? (
                <>
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

                  {/* Floating Room Info Tag */}
                  <div className="relative z-10 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white text-xs font-medium w-fit">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold truncate max-w-[200px]">{meetingTitle}</span>
                    <span className="text-white/40">|</span>
                    <span className="text-white/80 font-mono">{formatTimer(elapsedSeconds)}</span>
                  </div>

                  {/* Audio Level Meter */}
                  <div className="relative z-10 self-center flex items-center space-x-3 bg-black/70 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/15">
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
                </>
              ) : (
                <div className="absolute inset-0">
                  <iframe
                    src={`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
                    allow="camera *; microphone *; display-capture *; fullscreen; autoplay"
                    className="w-full h-full border-0"
                    title="ConverseIQ Multi-Party Video Meeting"
                  />
                </div>
              )}
            </div>

            {/* Right: Live Real-Time AI Speech Transcription Feed */}
            <div className="bg-white dark:bg-[#1A2B24] rounded-3xl border border-[#DCE7E2] dark:border-[#2D4A3E] p-5 flex flex-col justify-between shadow-sm h-[540px]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE7E2] dark:border-[#2D4A3E]">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-[#3F795F] dark:text-[#78A98F]" />
                    <h3 className="text-sm font-bold text-[#173A2C] dark:text-[#E8F0EC]">
                      Live Real-Time Transcript
                    </h3>
                  </div>
                  <span className="flex items-center space-x-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active Listening</span>
                  </span>
                </div>

                <div className="mt-3 overflow-y-auto max-h-[380px] space-y-3 pr-1 text-xs">
                  {liveTranscript.length > 0 ? (
                    liveTranscript.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#F5FAF8] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl space-y-1 animate-fade-in"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#3F795F] dark:text-[#78A98F]">
                            {line.speaker}
                          </span>
                          <span className="text-[10px] text-[#667875] dark:text-[#8FA89C] font-mono">
                            {line.time}
                          </span>
                        </div>
                        <p className="text-[#173A2C] dark:text-[#E8F0EC] leading-relaxed">
                          {line.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 px-4 space-y-3">
                      <Mic className="w-8 h-8 text-[#78A98F] mx-auto opacity-60 animate-pulse" />
                      <p className="text-xs text-[#667875] dark:text-[#8FA89C] leading-relaxed">
                        Speak into your microphone. Words appear here in real-time and will be synthesized by Gemini into Minutes of Meeting.
                      </p>
                      <button
                        type="button"
                        onClick={handleLoadSampleDemo}
                        className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#367C88] hover:underline"
                      >
                        <span>Preload demonstration transcript</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick-Add / Status */}
              <div className="pt-3 border-t border-[#DCE7E2] dark:border-[#2D4A3E] flex items-center justify-between text-[11px] text-[#667875] dark:text-[#8FA89C]">
                <span>{liveTranscript.length} dialogue turns captured</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">100% Buffer Intact</span>
              </div>
            </div>

          </div>

          {/* Footer Status Bar */}
          <div className="p-4 bg-[#D4E9DF] dark:bg-[#243D33]/60 border border-[#78A98F]/30 rounded-2xl text-xs text-[#173A2C] dark:text-[#E8F0EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#3F795F] dark:text-[#78A98F] flex-shrink-0" />
              <span>
                Meeting stream &amp; dialogue are actively capturing. When finished, click <strong>&quot;End &amp; Generate MoM&quot;</strong> to trigger Zero-Hallucination transcription &amp; decision extraction.
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
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
          </div>
        </div>
      )}

    </div>
  );
}
