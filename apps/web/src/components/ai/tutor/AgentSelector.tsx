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
  X,
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

/**
 * Keyword/regex pre-selector for agent auto-suggestion.
 *
 * Advisory only — suggestAgentForMessage never changes the active agent. The
 * manual dropdown remains the sole way the agent actually switches, so a bad
 * guess costs the student nothing.
 *
 * Order matters: the first pattern to match wins, so the more specific intents
 * (exam prep, doubts) are listed before the broad catch-alls (deep dive).
 * `explain_topic` is deliberately absent as a pattern — it is the default agent,
 * so suggesting it would be a no-op.
 */
const AGENT_SUGGESTION_RULES: Array<{ agentId: string; patterns: RegExp[] }> = [
  {
    // Exam strategy, timetables, marks, revision planning.
    agentId: 'exam_prep',
    patterns: [
      /\b(exam|board\s+exam|pre-?board|test|paper)\b.*\b(strategy|plan|prepare|preparation|tips|crack|score)\b/i,
      /\b(study\s+plan|time\s?table|revision\s+plan|revise|syllabus\s+complete)\b/i,
      /\b(how\s+(to|do\s+i)\s+(score|get)\s+\d+)/i,
      /\b(marks|weightage|blueprint|previous\s+year|pyq)\b/i,
      /\b(kitne\s+din|kaise\s+padhu|exam\s+ki\s+tayari)\b/i,
    ],
  },
  {
    // A specific confusion or misconception the student wants resolved.
    agentId: 'clear_doubts',
    patterns: [
      /\b(doubt|confus(ed|ing|ion)|not\s+clear|didn'?t\s+(get|understand)|unclear)\b/i,
      /\b(difference\s+between|why\s+is\s+it\s+not|but\s+why|then\s+why)\b/i,
      /\b(samajh\s+nahi|doubt\s+hai|clear\s+karo)\b/i,
    ],
  },
  {
    // Wants to be walked through solving it themselves, not handed an answer.
    agentId: 'selfstudy_buddy',
    patterns: [
      /\b(step[-\s]?by[-\s]?step|walk\s+me\s+through|guide\s+me|help\s+me\s+solve)\b/i,
      /\b(homework|assignment|worksheet|exercise\s+\d|question\s+\d)\b/i,
      /\b(solve\s+this|how\s+do\s+i\s+start)\b/i,
    ],
  },
  {
    // Conversational exploration of the textbook itself.
    agentId: 'book_structure',
    patterns: [
      /\b(chapter|textbook|ncert|book)\b.*\b(about|cover|contain|structure|organi[sz]ed|index)\b/i,
      /\b(what'?s\s+in\s+(this\s+)?chapter|summari[sz]e\s+(the\s+)?chapter)\b/i,
      /\b(let'?s\s+talk|discuss\s+with)\b/i,
    ],
  },
  {
    // Motivation, focus, technique — not subject content.
    agentId: 'study_tips',
    patterns: [
      /\b(motivat(e|ion|ed)|focus|concentrat(e|ion)|procrastinat|distract)\b/i,
      /\b(memori[sz]e|remember\s+better|retention|mnemonic|note[-\s]?taking)\b/i,
      /\b(burn(ed|t)?\s?out|stress(ed)?|anxiety|pressure)\b/i,
      /\b(mann\s+nahi\s+lagta|yaad\s+nahi\s+rehta)\b/i,
    ],
  },
]

/**
 * Suggest an agent for a student message.
 *
 * Returns null when nothing matches, when the message is too short to judge, or
 * when the best guess is already the active agent. Pure and side-effect free so
 * it can be called on every keystroke.
 */
export function suggestAgentForMessage(
  message: string,
  currentAgentId?: string,
): TutorAgentOption | null {
  if (!message) return null
  const trimmed = message.trim()
  // Below ~4 words there is rarely enough signal, and suggesting on every
  // half-typed word is noisy.
  if (trimmed.length < 12 || trimmed.split(/\s+/).length < 4) return null

  for (const rule of AGENT_SUGGESTION_RULES) {
    if (rule.patterns.some((p) => p.test(trimmed))) {
      if (rule.agentId === currentAgentId) return null
      return TUTOR_AGENTS.find((a) => a.id === rule.agentId) ?? null
    }
  }
  return null
}

interface AgentSelectorProps {
  /** Current agent id (menuIntent). */
  value?: string
  /** Called with the chosen agent id. */
  onChange: (agentId: string) => void
  disabled?: boolean
  className?: string
  /**
   * The student's in-progress message. When supplied, a dismissible suggestion
   * chip appears if a different agent looks like a better fit. Purely advisory —
   * the agent only changes if the student accepts, or uses the dropdown.
   */
  draftMessage?: string
}

/**
 * Compact tutor switcher designed to sit inside the chat input box. Shows the
 * active tutor as a pill; opens a labelled list of all tutors. Switching keeps
 * the existing conversation intact.
 */
export function AgentSelector({ value, onChange, disabled = false, className, draftMessage }: AgentSelectorProps) {
  const active = TUTOR_AGENTS.find((a) => a.id === value) ?? TUTOR_AGENTS[0]
  const ActiveIcon = active.Icon

  // Agent ids the student has explicitly waved off for this draft, so a
  // dismissed suggestion doesn't immediately reappear on the next keystroke.
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([])

  const suggestion = React.useMemo(
    () => (draftMessage ? suggestAgentForMessage(draftMessage, active.id) : null),
    [draftMessage, active.id],
  )
  const visibleSuggestion =
    suggestion && !dismissedIds.includes(suggestion.id) ? suggestion : null

  // Clear dismissals once the draft is sent/emptied, so the next question starts fresh.
  React.useEffect(() => {
    if (!draftMessage) setDismissedIds([])
  }, [draftMessage])

  const SuggestionIcon = visibleSuggestion?.Icon

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      {visibleSuggestion && SuggestionIcon && (
        <div
          className="inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1 text-xs"
          style={{ background: 'var(--chip-bg)', border: '1px solid rgb(var(--accent-primary-rgb) / 0.3)', color: 'var(--accent-text)' }}
        >
          <span className="max-w-[12rem] truncate">
            Try <span className="font-semibold">{visibleSuggestion.title}</span>?
          </span>
          <button
            type="button"
            onClick={() => onChange(visibleSuggestion.id)}
            className="btn btn-primary"
            style={{ padding: '3px 12px', fontSize: 12 }}
            aria-label={`Switch to ${visibleSuggestion.title}`}
          >
            Switch
          </button>
          <button
            type="button"
            onClick={() => setDismissedIds((prev) => [...prev, visibleSuggestion.id])}
            className="px-1 focus:outline-none"
            style={{ color: 'var(--accent-text)' }}
            aria-label="Dismiss suggestion"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Current tutor: ${active.title}. Click to switch tutor.`}
          className={cn('group chip', className)}
          style={{ padding: '6px 12px 6px 6px' }}
          disabled={disabled}
        >
          <span className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-full', active.accent)}>
            <ActiveIcon className="h-3 w-3" />
          </span>
          <span className="max-w-[9rem] truncate">{active.title}</span>
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" style={{ color: 'var(--muted)' }} />
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
    </div>
  )
}
