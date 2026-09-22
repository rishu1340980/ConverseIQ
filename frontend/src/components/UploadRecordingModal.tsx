'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  X, 
  FileAudio, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { apiRequest, getAuthToken } from '@/lib/api';

interface UploadRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadRecordingModal({
  isOpen,
  onClose,
  onSuccess,
}: UploadRecordingModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('');
  const [duration, setDuration] = useState(45);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setErrorMsg('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!file) {
      setErrorMsg('Please select or drop an audio or video recording file first.');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setErrorMsg('You are not logged in. Please log in first.');
      setTimeout(() => router.push('/login'), 1200);
      return;
    }

    setIsProcessing(true);
    setStatusMsg('Uploading recording to server...');

    try {
      const formData = new FormData();
      formData.append('title', title.trim() || 'Faculty Meeting Recording');
      formData.append('participants', participants);
      formData.append('duration_minutes', String(duration || 45));
      formData.append('file', file);

      setTimeout(() => {
        setStatusMsg('Transcribing multi-speaker audio with diarization...');
      }, 1500);

      setTimeout(() => {
        setStatusMsg('AI generating structured Minutes of Meeting & Action items...');
      }, 3500);

      const data = await apiRequest('/meetings/upload-and-analyze', {
        method: 'POST',
        body: formData,
      });

      setStatusMsg('Meeting analysis complete! Redirecting...');
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
        if (onSuccess) onSuccess();
        router.push(`/meetings/${data.meeting_id}`);
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing meeting recording.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173A2C]/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 relative border border-[#DCE7E2]">
        
        {!isProcessing && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-6 right-6 text-[#667875] hover:text-[#173A2C] p-2 rounded-full hover:bg-[#F5FAF8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {isProcessing ? (
          <div className="py-12 text-center space-y-5 animate-fade-in">
            <div className="relative w-16 h-16 mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#D4E9DF] border-t-[#3F795F]"></div>
              <Sparkles className="w-6 h-6 text-[#3F795F] absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#173A2C]">Processing Meeting Intelligence</h3>
              <p className="text-xs text-[#3F795F] font-semibold mt-1 animate-pulse">{statusMsg}</p>
            </div>
            <div className="p-3.5 bg-[#E4F2F4]/60 border border-[#B9DDE3] rounded-xl max-w-xs mx-auto text-left space-y-2">
              <div className="flex items-center space-x-2 text-xs text-[#367C88] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#367C88] animate-ping"></span>
                <span>Speaker Diarization (Multi-Speaker Attribution)</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-[#3F795F] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#3F795F]"></span>
                <span>Gemini MoM &amp; Action Items Distillation</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 bg-[#E4F2F4] text-[#367C88] rounded-2xl flex items-center justify-center shadow-xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#173A2C] tracking-tight">
                  Upload Meeting Recording
                </h3>
                <p className="text-xs text-[#667875]">
                  Transcribe multi-speaker audio and extract automated Minutes of Meeting.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Drag & Drop Audio Upload Box */}
            <div>
              <label className="block text-xs font-semibold text-[#173A2C] mb-1.5">
                Recording Audio / Video File <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer select-none ${
                  isDragging 
                    ? 'border-[#78A98F] bg-[#E4F2F4]/40 scale-[1.01]' 
                    : file
                    ? 'border-[#78A98F] bg-[#D4E9DF]/30'
                    : 'border-[#DCE7E2] hover:border-[#78A98F] bg-[#F5FAF8] hover:bg-[#E4F2F4]/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.mp4,.ogg,.aac,.flac"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-[#D4E9DF] text-[#3F795F] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#173A2C] truncate max-w-xs mx-auto">
                        {file.name}
                      </p>
                      <p className="text-xs text-[#3F795F] font-semibold mt-0.5">
                        ✓ Ready to analyze • {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <p className="text-[11px] text-[#667875] underline decoration-dotted hover:text-[#173A2C]">
                      Click or drag to choose a different file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-[#E4F2F4] text-[#367C88] rounded-2xl flex items-center justify-center mx-auto">
                      <FileAudio className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#173A2C]">
                        Click here to browse or drag file
                      </p>
                      <p className="text-xs text-[#667875] mt-0.5">
                        Supports MP3, WAV, M4A, WebM, MP4 audio
                      </p>
                    </div>
                    <p className="text-[11px] text-[#3F795F] font-semibold">
                      Supports meetings up to 3 hours
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-[#173A2C] mb-1">
                Meeting Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Project Review, Curriculum Sync, or Department Meeting"
                className="w-full px-4 py-2.5 bg-white border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all placeholder:text-[#667875]/60"
              />
            </div>

            {/* Participants Field for Diarization Mapping */}
            <div>
              <label className="block text-xs font-semibold text-[#173A2C] mb-1 flex items-center justify-between">
                <span>Attendee Names (Optional)</span>
                <span className="text-[10px] bg-[#D4E9DF] text-[#3F795F] font-bold px-2 py-0.5 rounded-full">Speaker Attribution</span>
              </label>
              <textarea
                rows={2}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="Optional: leave blank to auto-detect speakers from audio, or enter comma-separated names"
                className="w-full px-4 py-2.5 bg-white border border-[#DCE7E2] rounded-xl text-sm text-[#173A2C] focus:ring-2 focus:ring-[#78A98F] focus:border-[#78A98F] outline-none transition-all placeholder:text-[#667875]/60"
              />
              <p className="text-[11px] text-[#667875] mt-1">
                Leave blank for automatic speaker detection from the recording.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-[#DCE7E2] bg-white hover:bg-[#F5FAF8] rounded-xl text-xs font-semibold text-[#173A2C] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file}
                className={`px-6 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-2 ${
                  file
                    ? 'bg-[#3F795F] hover:bg-[#34654F] text-white cursor-pointer hover:shadow-md hover:-translate-y-0.5'
                    : 'bg-[#DCE7E2] text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{file ? 'Upload & Analyze Recording' : 'Select a File to Analyze'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

