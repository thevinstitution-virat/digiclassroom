'use client'

// The "Evaluate" menu entry (roadmap task 3.2): shown to anyone who is an active rater while the evaluation tools are on, in
// whichever dashboard they use. A rater who has no other dashboard goes straight to /evaluate (dashboard router), so this is
// for teachers, institution admins and learners who are also raters.

import { ClipboardCheck } from 'lucide-react'
import { api } from '@/lib/trpc/client'

export const EVALUATE_NAV = { name: 'Evaluate', href: '/evaluate', icon: ClipboardCheck, description: 'Your evaluator tasks', section: 'Evaluate' } as const

export function useIsRater(): boolean {
  const me = api.hwEval.me.useQuery(undefined, { staleTime: 60_000, retry: false })
  return Boolean(me.data?.enabled && me.data.isRater)
}
