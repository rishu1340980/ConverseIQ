'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, FolderUp } from 'lucide-react';
import UploadRecordingModal from './UploadRecordingModal';

interface AddMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddMeetingModal({
  isOpen,
  onClose,
  onSuccess,
}: AddMeetingModalProps) {
  const router = useRouter();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173A2C]/40 p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8 relative border border-[#DCE7E2]">
          
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-6 right-6 text-[#667875] hover:text-[#173A2C] p-2 rounded-full hover:bg-[#F5FAF8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#173A2C] tracking-tight">
              Add a Meeting
            </h2>
            <p className="text-sm text-[#667875] mt-1">
              Start an interactive live recording or ingest an existing audio recording.
            </p>
          </div>

          <div className="space-y-4">
            {/* Card 1: Go Live (Deep Sage + Soft Blue accents) */}
            <div
              onClick={() => {
                onClose();
                router.push('/live-meeting');
              }}
              className="bg-[#3F795F] hover:bg-[#34654F] text-white rounded-2xl p-6 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 shadow-md flex items-start space-x-4 group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/15 text-[#B9DDE3] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B9DDE3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#B9DDE3]"></span>
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Go Live
                  </h3>
                </div>
                <p className="text-xs text-[#D4E9DF] mt-1 leading-relaxed">
                  Start recording your academic meeting in real time. ConverseIQ captures audio and runs auto-diarization when complete.
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/20 text-[#E4F2F4] border border-white/25 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#B9DDE3] animate-pulse"></span>
                    <span>Live Conference</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Upload Recording (Pure White surface + Soft Blue / Sage accents) */}
            <div
              onClick={() => {
                setIsUploadModalOpen(true);
              }}
              className="bg-white hover:border-[#78A98F] border border-[#DCE7E2] rounded-2xl p-6 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow-md flex items-start space-x-4 group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E4F2F4] text-[#367C88] flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-[#B9DDE3]/40 transition-colors">
                <FolderUp className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#173A2C] tracking-tight group-hover:text-[#3F795F] transition-colors">
                  Upload Recording
                </h3>
                <p className="text-xs text-[#667875] mt-1 leading-relaxed">
                  Already have an audio or video file? Upload it to extract the diarized transcript, summary, decisions, and action items.
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-[#D4E9DF]/70 text-[#3F795F] rounded-full text-xs font-semibold">
                    MP3 • WAV • M4A • WebM supported
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Embedded Upload Recording Modal */}
      <UploadRecordingModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          onClose();
        }}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          onClose();
          if (onSuccess) onSuccess();
        }}
      />
    </>
  );
}
