'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id?: string;
  type: 'success' | 'info' | 'error' | 'warning';
  title?: string;
  message: string;
  onClose?: () => void;
}

export default function Toast({
  type = 'success',
  title,
  message,
  onClose,
}: ToastMessage) {
  const typeStyles = {
    success: 'bg-[#D4E9DF] border-[#78A98F] text-[#173A2C]',
    info: 'bg-[#E4F2F4] border-[#B9DDE3] text-[#132F34]',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-[#3F795F] flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-[#367C88] flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-start space-x-3 p-4 rounded-2xl border shadow-lg max-w-sm transition-all duration-300 animate-slide-up ${typeStyles[type]}`}
    >
      {icons[type]}
      <div className="flex-1 min-w-0 pr-2">
        {title && <p className="text-xs font-bold">{title}</p>}
        <p className="text-xs leading-relaxed mt-0.5">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/5 transition-colors opacity-70 hover:opacity-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
