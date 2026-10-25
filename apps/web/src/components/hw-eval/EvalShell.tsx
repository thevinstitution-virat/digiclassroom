'use client'

// Frame for the evaluator screens: switched-off and not-a-rater states, so no page renders
// half-working. English only for now; raters are adult evaluators, and Devanagari is typed
// with the device's own keyboard.

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { HwError, HwLoading, HwMessage } from '@/components/hw/HwShell'

export function useEvalMe() {
  return api.hwEval.me.useQuery(undefined, { staleTime: 60_000, retry: false })
}

export function EvalShell({ title, subtitle, back, actions, needs = 'rater', children }: {
  title: string
  subtitle?: string
  back?: { href: string; label: string }
  actions?: ReactNode
  needs?: 'rater' | 'superAdmin'
  children: ReactNode
}) {
  const me = useEvalMe()
  let body: ReactNode = children
  if (me.isLoading) body = <HwLoading />
  else if (me.error) body = <HwError message={me.error.message} onRetry={() => me.refetch()} />
  else if (!me.data?.enabled) body = <HwMessage>The evaluation tools are switched off.</HwMessage>
  else if (needs === 'rater' && !me.data.isRater) body = <HwMessage>This page is for evaluators. Ask the platform team to add you as a rater.</HwMessage>
  else if (needs === 'superAdmin' && !me.data.isSuperAdmin) body = <HwMessage>Only the platform owner can manage evaluation.</HwMessage>

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {back && <Link href={back.href} className="text-sm text-muted-foreground hover:underline">← {back.label}</Link>}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {me.data?.pseudonym && <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">Signed in as rater {me.data.pseudonym}</span>}
          {actions}
        </div>
      </div>
      {body}
    </div>
  )
}

export const KIND_LABEL: Record<string, string> = {
  transcribe: 'Transcription',
  blind_mark: 'Blind marking',
  key_audit: 'Key audit',
  deidentify: 'De-identification',
}

/** Visible working time since mount, for the submission's time_ms. Remount per task. */
export function useVisibleTime(): () => number {
  const total = useRef(0)
  const since = useRef(0)
  useEffect(() => {
    since.current = document.visibilityState === 'visible' ? Date.now() : 0
    const onVis = () => {
      if (document.visibilityState === 'visible') since.current = Date.now()
      else if (since.current) { total.current += Date.now() - since.current; since.current = 0 }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return useCallback(() => Math.min(86_400_000, Math.round(total.current + (since.current ? Date.now() - since.current : 0))), [])
}
