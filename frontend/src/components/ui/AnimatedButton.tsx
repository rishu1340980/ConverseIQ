'use client';

import React from 'react';
import { Loader2, Check } from 'lucide-react';

export interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'softblue' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  isSuccess?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export default function AnimatedButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  isSuccess = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: AnimatedButtonProps) {
  const isBusy = isLoading || loading;
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
    md: 'px-4 py-2 text-sm font-semibold rounded-xl',
    lg: 'px-5 py-2.5 text-base font-bold rounded-xl',
  };

  const variantClasses = {
    primary: 'bg-[#78A98F] hover:bg-[#5A9175] text-white shadow-sm hover:shadow active:bg-[#3F795F]',
    secondary: 'bg-[#E4F2F4] hover:bg-[#B9DDE3] text-[#173A2C] active:bg-[#91CAD4]',
    softblue: 'bg-[#B9DDE3] hover:bg-[#91CAD4] text-[#132F34] font-bold shadow-sm',
    outline: 'border border-[#DCE7E2] bg-white hover:bg-[#F5FAF8] text-[#173A2C] active:bg-[#EDF5F2]',
    ghost: 'text-[#667875] hover:text-[#173A2C] hover:bg-[#D4E9DF]/30',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm',
  };

  return (
    <button
      disabled={disabled || isBusy}
      className={`btn-interactive inline-flex items-center justify-center space-x-2 select-none ${sizeClasses[size]} ${variantClasses[variant]} disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {isBusy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Processing...</span>
        </>
      ) : isSuccess ? (
        <>
          <Check className="w-4 h-4 text-emerald-100 flex-shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
