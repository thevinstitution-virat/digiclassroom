'use client'

import React from 'react'
import { Zap, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TutorTier = 'basic' | 'prime'

export interface TutorUsage {
  tiersEnabled: boolean
  basic?: { used: number; limit: number; left: number }
  prime?: { used: number; limit: number; left: number }
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
          primeOut ? 'Prime is used up for today; answers are Basic until tomorrow' : 'Prime: a detailed explanation with examples, from the textbook',
          primeOut)}
      </div>
      <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }} aria-live="polite">
        {primeOut ? 'Prime used up today' : `Prime: ${usage.prime.left} left today`}
      </span>
    </div>
  )
}
