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
      className={`inline-flex items-center bg-[#EDF5F2] border border-[#DCE7E2] rounded-xl relative ${sizeClasses} ${className}`}
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
                ? 'bg-white text-[#173A2C] shadow-sm'
                : 'text-[#667875] hover:text-[#173A2C]'
            }`}
          >
            {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                  isActive
                    ? 'bg-[#D4E9DF] text-[#173A2C]'
                    : 'bg-[#DCE7E2]/70 text-[#667875]'
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
