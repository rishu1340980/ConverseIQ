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
    secondary: 'bg-[#E4F2F4] dark:bg-[#1A3A3F] hover:bg-[#B9DDE3] dark:hover:bg-[#2A5A63] text-[#173A2C] dark:text-[#E8F0EC] active:bg-[#91CAD4] dark:active:bg-[#2A5A63]',
    softblue: 'bg-[#B9DDE3] dark:bg-[#2A5A63] hover:bg-[#91CAD4] dark:hover:bg-[#367C88]/70 text-[#132F34] dark:text-[#B9DDE3] font-bold shadow-sm',
    outline: 'border border-[#DCE7E2] dark:border-[#2D4A3E] bg-white dark:bg-[#1A2B24] hover:bg-[#F5FAF8] dark:hover:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] active:bg-[#EDF5F2] dark:active:bg-[#243D33]',
    ghost: 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC] hover:bg-[#D4E9DF] dark:bg-[#243D33]/30 dark:hover:bg-[#243D33]/30',
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
