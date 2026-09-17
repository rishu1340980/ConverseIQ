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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-[#F8F7F2] w-full max-w-xl rounded-3xl shadow-2xl p-8 relative border border-[#E8E5DA]">
          
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-[#EAE5D9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#1C251E] tracking-tight">
              Add a Meeting
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Start a live recording or upload an existing audio file.
            </p>
          </div>

          <div className="space-y-4">
            {/* Card 1: Go Live (Dark Forest Green) */}
            <div
              onClick={() => {
                onClose();
                router.push('/live-meeting');
              }}
              className="bg-[#2C3E33] hover:bg-[#233328] text-white rounded-2xl p-6 cursor-pointer transition-all duration-150 transform hover:-translate-y-0.5 shadow-md flex items-start space-x-4"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Go Live
                  </h3>
                </div>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Start recording your meeting right now. ConverseIQ will capture audio in real time and auto-analyze once you stop.
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-red-500/20 text-red-200 border border-red-500/30 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                    <span>Live Recording</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Upload Recording (Pure White) */}
            <div
              onClick={() => {
                setIsUploadModalOpen(true);
              }}
              className="bg-white hover:border-[#45644F] border border-[#E8E5DA] rounded-2xl p-6 cursor-pointer transition-all duration-150 transform hover:-translate-y-0.5 shadow-sm flex items-start space-x-4"
            >
              <div className="w-12 h-12 rounded-xl bg-[#F0F5F1] text-[#45644F] flex items-center justify-center flex-shrink-0 mt-0.5">
                <FolderUp className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#1C251E] tracking-tight">
                  Upload Recording
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Already have a meeting recording? Upload an audio file and let AI extract the transcript, summary, and action items.
                </p>
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-[#E2EBE2] text-[#2F4E36] rounded-full text-xs font-medium">
                    MP3 • WAV • M4A supported
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
