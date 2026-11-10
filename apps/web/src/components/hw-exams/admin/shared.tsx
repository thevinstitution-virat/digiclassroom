// Small pieces shared by the exam-package builder screens (super admin, English only like the rest of the platform console).

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const BASE = '/dashboard/super-admin/exams'

export const KIND_LABEL: Record<string, string> = {
  pyq: 'Past paper',
  sqp: 'Sample paper',
  mock_half: 'Half-syllabus mock',
  mock_full: 'Full-syllabus mock',
}

export const QTYPE_LABEL: Record<string, string> = {
  mcq: 'Multiple choice',
  assertion_reason: 'Assertion–reason',
  very_short: 'Very short',
  short: 'Short',
  long: 'Long',
  case_based: 'Case based',
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'published' ? 'default' : status === 'retired' ? 'secondary' : 'outline'
  return <Badge variant={tone}>{status}</Badge>
}

/** One line under a form or a button: what went wrong, or what just happened. */
export function Note({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  if (!children) return null
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`text-sm ${tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{children}</p>
}

export function Problems({ items, title = 'Not ready to publish' }: { items: string[]; title?: string }) {
  if (!items.length) return null
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{items.map((p) => <li key={p}>{p}</li>)}</ul>
    </div>
  )
}

export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {trail.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          {c.href ? <Link href={c.href} className="hover:text-foreground hover:underline">{c.label}</Link> : <span className="text-foreground">{c.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export const rupees = (paise: number) => (paise === 0 ? 'Free' : `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
export const marksText = (m: number) => `${m} mark${m === 1 ? '' : 's'}`
