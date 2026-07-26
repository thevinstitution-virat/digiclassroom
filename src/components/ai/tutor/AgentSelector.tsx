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
  PenTool,
  Layers,
  Trophy,
  CheckCircle,
  Sparkles,
  MessageCircle,
  ChevronDown,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TutorAgentOption {
  id: string
  title: string
  description: string
  Icon: LucideIcon
  /** Tailwind classes for the small icon chip (bg + text) */
  accent: string
}

/**
 * The six student tutor agents. `id` matches the backend menuIntent so selecting
 * one simply calls handleMenuSelection(id) — switching agents mid-chat without
 * resetting the conversation.
 */
export const TUTOR_AGENTS: TutorAgentOption[] = [
  { id: 'selfstudy_buddy', title: 'Selfstudy Buddy', description: 'Step-by-step Socratic guidance', Icon: PenTool, accent: 'bg-amber-100 text-amber-700' },
  { id: 'explain_topic', title: 'Deep Dive', description: 'In-depth topic explanations', Icon: Layers, accent: 'bg-blue-100 text-blue-700' },
  { id: 'exam_prep', title: 'Ace Your Exams', description: 'Exam strategy & study plans', Icon: Trophy, accent: 'bg-orange-100 text-orange-700' },
  { id: 'clear_doubts', title: 'Doubt Resolution', description: 'Clear doubts & misconceptions', Icon: CheckCircle, accent: 'bg-green-100 text-green-700' },
  { id: 'study_tips', title: 'Virat Insights', description: 'Study techniques & motivation', Icon: Sparkles, accent: 'bg-purple-100 text-purple-700' },
  { id: 'book_structure', title: "Let's Talk", description: 'Chat with your textbook', Icon: MessageCircle, accent: 'bg-indigo-100 text-indigo-700' },
]

interface AgentSelectorProps {
  /** Current agent id (menuIntent). */
  value?: string
  /** Called with the chosen agent id. */
  onChange: (agentId: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Compact tutor switcher designed to sit inside the chat input box. Shows the
 * active tutor as a pill; opens a labelled list of all tutors. Switching keeps
 * the existing conversation intact.
 */
export function AgentSelector({ value, onChange, disabled = false, className }: AgentSelectorProps) {
  const active = TUTOR_AGENTS.find((a) => a.id === value) ?? TUTOR_AGENTS[0]
  const ActiveIcon = active.Icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Current tutor: ${active.title}. Click to switch tutor.`}
          className={cn(
            'group inline-flex items-center gap-1.5 rounded-full border border-orange-200/70 bg-white/80 py-1 pl-1.5 pr-2 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm transition-colors',
            'hover:border-blue-400 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', active.accent)}>
            <ActiveIcon className="h-3 w-3" />
          </span>
          <span className="max-w-[9rem] truncate">{active.title}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-72 p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Switch tutor
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TUTOR_AGENTS.map((agent) => {
          const AgentIcon = agent.Icon
          const isActive = agent.id === active.id
          return (
            <DropdownMenuItem
              key={agent.id}
              onSelect={() => {
                if (!isActive) onChange(agent.id)
              }}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2',
                isActive && 'bg-blue-50/70',
              )}
            >
              <span className={cn('mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', agent.accent)}>
                <AgentIcon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900">{agent.title}</span>
                  {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </div>
                <p className="truncate text-xs text-gray-500">{agent.description}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
