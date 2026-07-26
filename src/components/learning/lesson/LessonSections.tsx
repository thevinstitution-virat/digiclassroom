"use client"

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Clipboard, ListChecks, Target, Activity, CheckCircle2, Download, Printer } from 'lucide-react'
import remarkGfm from 'remark-gfm'

export type LessonSectionProps = {
  title: string
  icon?: React.ReactNode
  children?: React.ReactNode
  markdown?: string
}

export function SectionShell({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white/90 p-4 md:p-5 shadow-sm mb-4 break-inside-avoid">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg md:text-xl font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="prose prose-sm md:prose-base max-w-none">
        {children}
      </div>
    </section>
  )
}

export function ObjectivesSection({ markdown }: LessonSectionProps) {
  return (
    <SectionShell title="Objectives" icon={<Target className="h-5 w-5 text-indigo-600" /> }>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || ''}</ReactMarkdown>
    </SectionShell>
  )
}

export function KeyPointsSection({ markdown }: LessonSectionProps) {
  return (
    <SectionShell title="Key Points" icon={<ListChecks className="h-5 w-5 text-blue-600" /> }>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || ''}</ReactMarkdown>
    </SectionShell>
  )
}

export function ActivitiesSection({ markdown }: LessonSectionProps) {
  return (
    <SectionShell title="Activities" icon={<Activity className="h-5 w-5 text-emerald-600" /> }>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || ''}</ReactMarkdown>
    </SectionShell>
  )
}

export function AssessmentSection({ markdown }: LessonSectionProps) {
  return (
    <SectionShell title="Assessment" icon={<CheckCircle2 className="h-5 w-5 text-orange-600" /> }>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || ''}</ReactMarkdown>
    </SectionShell>
  )
}

export function LessonActionBar({ onCopy, onPrint, onExportPdf }: { onCopy: () => void; onPrint: () => void; onExportPdf: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
      <button onClick={onCopy} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">
        <Clipboard className="h-4 w-4" /> Copy
      </button>
      <button onClick={onPrint} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">
        <Printer className="h-4 w-4" /> Print
      </button>
      <button onClick={onExportPdf} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">
        <Download className="h-4 w-4" /> Export PDF
      </button>
    </div>
  )
}

