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
import {
  BookOpen,
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  TrendingUp,
  Landmark,
  Globe,
  Languages,
  Cpu,
  Briefcase,
  ScrollText,
  ChevronDown,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Best-effort icon for a subject name; falls back to a book. */
function iconForSubject(name: string): LucideIcon {
  const s = name.toLowerCase()
  if (/(math|गणित|account)/.test(s)) return Calculator
  if (/physic/.test(s)) return Atom
  if (/(chem|रसायन)/.test(s)) return FlaskConical
  if (/(bio|जीव)/.test(s)) return Leaf
  if (/scien|विज्ञान/.test(s)) return FlaskConical
  if (/(econom|अर्थ|commerce|business)/.test(s)) return /business/.test(s) ? Briefcase : TrendingUp
  if (/(history|इतिहास|civic|polit|राजनीति)/.test(s)) return /history|इतिहास/.test(s) ? ScrollText : Landmark
  if (/(geo|भूगोल)/.test(s)) return Globe
  if (/(english|hindi|sanskrit|language|भाषा|हिंदी)/.test(s)) return Languages
  if (/(computer|informatics|coding|code)/.test(s)) return Cpu
  return BookOpen
}

/** Display the subject in a clean Title Case (handles ALLCAPS source values). */
function prettySubject(name: string): string {
  if (name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return name
}

interface SubjectSelectorProps {
  /** Current subject name. */
  value?: string
  /** Accessible subjects for the student's class/medium/subscription. */
  options: string[]
  /** Called with the chosen subject. */
  onChange: (subject: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Compact subject switcher designed to sit beside the tutor selector inside the
 * chat input box. Switching keeps the active tutor and conversation intact.
 */
export function SubjectSelector({ value, options, onChange, disabled = false, className }: SubjectSelectorProps) {
  const active = options.find((o) => o.toLowerCase() === (value || '').toLowerCase()) || value || 'Subject'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || options.length === 0}>
        <button
          type="button"
          aria-label={`Current subject: ${prettySubject(active)}. Click to switch subject.`}
          className={cn('group chip', className)}
          style={{ padding: '6px 12px' }}
          disabled={disabled || options.length === 0}
        >
          <BookOpen className="h-[15px] w-[15px]" style={{ color: 'var(--muted)' }} />
          <span className="max-w-[9rem] truncate">{prettySubject(active)}</span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" style={{ color: 'var(--muted)' }} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="max-h-80 w-60 overflow-y-auto p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Switch subject
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((subject) => {
          const SubjectIcon = iconForSubject(subject)
          const isActive = subject.toLowerCase() === active.toLowerCase()
          return (
            <DropdownMenuItem
              key={subject}
              onSelect={() => {
                if (!isActive) onChange(subject)
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2',
                isActive && 'bg-blue-50/70',
              )}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <SubjectIcon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate text-sm font-medium text-gray-900">{prettySubject(subject)}</span>
              {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
