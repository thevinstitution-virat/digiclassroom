import React from 'react';

interface OverallProgressBarProps {
  percentage: number;
}

export function OverallProgressBar({ percentage }: OverallProgressBarProps) {
  const boundedPct = Math.min(100, Math.max(0, percentage));
  
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm font-medium">
        <span>Overall Completion</span>
        <span className="text-muted-foreground">{boundedPct.toFixed(1)}%</span>
      </div>
      <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500 ease-in-out"
          style={{ width: `${boundedPct}%` }}
        />
      </div>
    </div>
  );
}
