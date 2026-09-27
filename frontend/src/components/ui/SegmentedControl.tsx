'use client';

import React from 'react';

export interface SegmentedOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  activeId?: string;
  value?: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export default function SegmentedControl({
  options,
  activeId,
  value,
  onChange,
  size = 'md',
  className = '',
}: SegmentedControlProps) {
  const currentActive = activeId || value;
  const sizeClasses = size === 'sm' ? 'p-0.5 text-xs' : 'p-1 text-sm';
  const itemPadding = size === 'sm' ? 'py-1 px-2.5' : 'py-1.5 px-3.5';

  return (
    <div
      className={`inline-flex items-center bg-[#EDF5F2] dark:bg-[#0F1A15] border border-[#DCE7E2] dark:border-[#2D4A3E] rounded-xl relative ${sizeClasses} ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.id === currentActive;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 flex items-center space-x-1.5 font-bold rounded-lg transition-all duration-200 select-none ${itemPadding} ${
              isActive
                ? 'bg-white dark:bg-[#1A2B24] text-[#173A2C] dark:text-[#E8F0EC] shadow-sm'
                : 'text-[#667875] dark:text-[#8FA89C] hover:text-[#173A2C] dark:hover:text-[#E8F0EC]'
            }`}
          >
            {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                  isActive
                    ? 'bg-[#D4E9DF] dark:bg-[#243D33] text-[#173A2C] dark:text-[#E8F0EC]'
                    : 'bg-[#DCE7E2]/70 dark:bg-[#2D4A3E]/70 text-[#667875] dark:text-[#8FA89C]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
