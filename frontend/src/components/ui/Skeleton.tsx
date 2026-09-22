'use client';

import React from 'react';

export function Skeleton({
  className = '',
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className={`shimmer-bg rounded-xl ${className}`}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
      }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#DCE7E2] shadow-sm space-y-3">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="space-y-1.5 pt-1">
        <Skeleton className="w-20 h-7 rounded-lg" />
        <Skeleton className="w-28 h-3.5 rounded" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-[#DCE7E2]/60">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full max-w-[120px] rounded" />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
