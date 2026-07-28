'use client'

import React from 'react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/core/ui/dropdown-menu'
import { Ruler, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ANSWER_LENGTH_TIERS, getAnswerLengthTier, type AnswerLength } from '@/lib/ai/answer-length'

interface LengthSelectorProps {
  /** Current answer-length tier id (undefined = auto). */
  value?: AnswerLength
  /** Called with the chosen tier id. */
  onChange: (value: AnswerLength) => void
  disabled?: boolean
  className?: string
}

/**
 * Answer-length switcher for the Deep Dive agent only. Lets the student size the
 * next answer to a CBSE question type (VSA/SA/LA/Essay). "Auto" lets the agent
 * decide. Sits beside the tutor + subject pills inside the input box.
 */
export function LengthSelector({ value, onChange, disabled = false, className }: LengthSelectorProps) {
  const active = getAnswerLengthTier(value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={active ? `Answer length: ${active.label}, ${active.marks}. Click to change.` : 'Set answer length'}
          className={cn(
            'group inline-flex items-center gap-1.5 rounded-full border border-orange-200/70 bg-white/80 py-1 pl-1.5 pr-2 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm transition-colors',
            'hover:border-blue-400 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <Ruler className="h-3 w-3" />
          </span>
          <span className="max-w-[9rem] truncate">{active ? `${active.label} · ${active.marks}` : 'Answer length'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-72 p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Answer length
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ANSWER_LENGTH_TIERS.map((tier) => {
          const isActive = tier.id === value
          return (
            <DropdownMenuItem
              key={tier.id}
              onSelect={() => {
                if (!isActive) onChange(tier.id)
              }}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2',
                isActive && 'bg-blue-50/70',
              )}
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                <Ruler className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900">{tier.label}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{tier.marks}</span>
                  {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </div>
                <p className="truncate text-xs text-gray-500">{tier.wordRange} · {tier.hint}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
