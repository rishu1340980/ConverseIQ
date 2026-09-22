'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'sage' | 'softblue' | 'light' | 'amber';
  trend?: string;
  trendPositive?: boolean;
  subtitle?: string;
  className?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  variant = 'sage',
  trend,
  trendPositive = true,
  subtitle,
  className = '',
}: StatCardProps) {
  const iconContainerStyles = {
    sage: 'bg-[#D4E9DF] text-[#173A2C]',
    softblue: 'bg-[#E4F2F4] text-[#367C88]',
    light: 'bg-[#F5FAF8] text-[#3F795F]',
    amber: 'bg-[#FEF3C7] text-[#B45309]',
  };

  return (
    <div
      className={`card-interactive bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-sm flex flex-col justify-between space-y-3 select-none ${className}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconContainerStyles[variant]}`}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              trendPositive
                ? 'bg-[#D4E9DF] text-[#173A2C]'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      <div>
        <div className="text-3xl font-black text-[#173A2C] tracking-tight leading-none">
          {value}
        </div>
        <p className="text-xs font-semibold text-[#667875] mt-1.5 uppercase tracking-wide">
          {label}
        </p>
        {subtitle && (
          <p className="text-[11px] text-[#667875]/80 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
