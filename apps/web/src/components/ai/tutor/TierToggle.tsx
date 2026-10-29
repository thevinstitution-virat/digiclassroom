'use client'

import React from 'react'
import { Zap, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TutorTier = 'basic' | 'prime'

export interface TutorUsage {
  tiersEnabled: boolean
  basic?: { used: number; limit: number; left: number; leftPct?: number; monthOut?: boolean }
  prime?: { used: number; limit: number; left: number; leftPct?: number; monthOut?: boolean }
  /** When the monthly ceiling renews (start of next month). */
  renewsAt?: string
  /** 'tokens': the limits are tokens per window of windowHours, whole again at resetsAt (null: no window open). */
  quota?: 'tokens'
  windowHours?: number
  resetsAt?: string | null
}

/**
 * Basic / Prime switch for the tutor, beside the answer-length chip. Basic is a quick answer from the textbook; Prime
 * a detailed explanation with examples on a stronger model, from a share of the daily question limit. Both answer
 * from the textbook: Prime is depth, never "more accurate". Hidden while tiers are off or usage could not be read.
 */
export function TierToggle({
  value,
  onChange,
  usage,
  disabled = false,
}: {
  value: TutorTier
  onChange: (tier: TutorTier) => void
  usage: TutorUsage | null
  disabled?: boolean
}) {
  if (!usage?.tiersEnabled || !usage.prime || usage.prime.limit === 0) return null
  const primeOut = usage.prime.left === 0
  // Token windows: what is left of Prime in this window, and when the window resets (shown once something is used).
  const tokens = usage.quota === 'tokens'
  const resets = usage.resetsAt
    ? new Date(usage.resetsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null
  // The monthly ceiling, rarely met: says the month, so the student does not wait for a window reset that won't help.
  const monthOut = !!usage.prime.monthOut
  const status = tokens
    ? monthOut
      ? 'Prime used up this month'
      : primeOut
      ? `Prime used up${resets ? ` · resets ${resets}` : ''}`
      : `Prime: ${usage.prime.leftPct ?? 100}% left${resets ? ` · resets ${resets}` : ''}`
    : primeOut
      ? 'Prime used up today'
      : `Prime: ${usage.prime.left} left today`

  const option = (tier: TutorTier, label: string, Icon: typeof Zap, title: string, off = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === tier}
      title={title}
      disabled={disabled || off}
      onClick={() => onChange(tier)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
        value === tier ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label="Answer depth" className="chip !gap-0.5 !p-0.5">
        {option('basic', 'Basic', Zap, 'Basic: a quick answer from the textbook')}
        {option('prime', 'Prime', Sparkles,
          primeOut
            ? tokens
              ? `Prime is used up for this ${usage.windowHours ?? 4}-hour window; answers are Basic until it resets`
              : 'Prime is used up for today; answers are Basic until tomorrow'
            : 'Prime: a detailed explanation with examples, from the textbook',
          primeOut)}
      </div>
      <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }} aria-live="polite">
        {status}
      </span>
    </div>
  )
}
