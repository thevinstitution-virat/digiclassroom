// src/components/dashboard/DashboardPlaceholder.tsx
// Shared "feature surface exists, full build coming" placeholder — modern glass card.

import type { ComponentType } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface DashboardPlaceholderProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  /** Optional bullet list of what this feature will include. */
  points?: string[];
}

export default function DashboardPlaceholder({
  title,
  description,
  icon: Icon,
  points,
}: DashboardPlaceholderProps) {
  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4">
      <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200/70 bg-white/70 p-10 text-center shadow-xl shadow-gray-300/30 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/60 dark:shadow-black/30">
        {/* gradient halo */}
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-gradient-to-br from-orange-400/30 to-blue-500/30 blur-3xl" />

        <div className="relative">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20">
            {Icon ? <Icon className="h-8 w-8" /> : <span className="text-2xl">📋</span>}
          </div>

          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Coming soon
          </span>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>

          {points && points.length > 0 && (
            <ul className="mx-auto mt-8 max-w-sm space-y-2.5 text-left">
              {points.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white/60 px-4 py-2.5 text-sm text-gray-600 dark:border-white/5 dark:bg-white/[0.03] dark:text-gray-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
