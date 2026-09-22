'use client';

import React from 'react';

// 1. Interactive Bar Chart Visualizer
export interface BarItem {
  label: string;
  value: number;
  secondaryValue?: number;
}

export function BarChartVisualizer({
  items,
  height = 140,
  barColor = '#78A98F',
  secondaryColor = '#B9DDE3',
}: {
  items: BarItem[];
  height?: number;
  barColor?: string;
  secondaryColor?: string;
}) {
  const maxValue = Math.max(...items.map((i) => Math.max(i.value, i.secondaryValue || 0)), 1);

  return (
    <div className="w-full flex items-end justify-between space-x-2 pt-4 px-2" style={{ height }}>
      {items.map((item, idx) => {
        const hPct = Math.round((item.value / maxValue) * 85);
        const sPct = item.secondaryValue !== undefined ? Math.round((item.secondaryValue / maxValue) * 85) : 0;

        return (
          <div key={idx} className="flex-1 flex flex-col items-center group relative">
            {/* Tooltip on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[#173A2C] text-white text-[10px] font-bold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap shadow-md z-20">
              {item.label}: {item.value} {item.secondaryValue !== undefined ? `(${item.secondaryValue})` : ''}
            </div>

            <div className="w-full max-w-[42px] flex items-end justify-center space-x-1 h-28 bg-[#EDF5F2]/50 rounded-t-xl overflow-hidden p-1">
              <div
                className="w-full rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-95"
                style={{
                  height: `${Math.max(8, hPct)}%`,
                  backgroundColor: barColor,
                }}
              />
              {item.secondaryValue !== undefined && (
                <div
                  className="w-full rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-95"
                  style={{
                    height: `${Math.max(8, sPct)}%`,
                    backgroundColor: secondaryColor,
                  }}
                />
              )}
            </div>
            <span className="text-[11px] font-semibold text-[#667875] mt-2 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 2. SVG Donut Status Meter
export function DonutStatusMeter({
  completed,
  total,
  label = 'Completion',
  size = 120,
}: {
  completed: number;
  total: number;
  label?: string;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E4F2F4"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#78A98F"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-black text-[#173A2C] tracking-tight">{percentage}%</span>
        <span className="text-[9px] font-bold text-[#667875] uppercase">{label}</span>
      </div>
    </div>
  );
}

// 3. Smooth Area/Trend Visualizer
export function TrendLineVisualizer({
  dataPoints,
  height = 90,
}: {
  dataPoints: number[];
  height?: number;
}) {
  if (dataPoints.length === 0) return null;
  const max = Math.max(...dataPoints, 1);
  const min = Math.min(...dataPoints, 0);
  const range = max - min || 1;
  const width = 280;

  const points = dataPoints.map((val, idx) => {
    const x = (idx / (dataPoints.length - 1 || 1)) * width;
    const y = height - ((val - min) / range) * (height - 18) - 9;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="sageGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78A98F" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#78A98F" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sageGradient)" />
        <path d={pathD} fill="none" stroke="#3F795F" strokeWidth="2.5" strokeLinecap="round" />
        {dataPoints.map((val, idx) => {
          const [cx, cy] = points[idx].split(',');
          return (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r="3.5"
              fill="#FFFFFF"
              stroke="#3F795F"
              strokeWidth="2"
              className="transition-transform duration-200 hover:scale-125"
            />
          );
        })}
      </svg>
    </div>
  );
}
