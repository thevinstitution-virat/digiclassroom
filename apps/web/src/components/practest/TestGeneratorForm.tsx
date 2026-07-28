'use client'

// VG Kosh Practest Engine - Test Generator
// Profile-driven (like the AI Tutor): board + class come from the student's profile
// and subscription (no manual pickers), subjects come from useSubjectFilter
// (entitlement-aware), and only subjects that actually have questions are offered.

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CogIcon, DocumentTextIcon, ClockIcon, PlayIcon, InformationCircleIcon,
  AcademicCapIcon, LockClosedIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { DifficultyDistribution } from '@/types/practest'
import { useUserProfile, useSubscription, useSubjectFilter } from '@/hooks'

interface TestGeneratorFormProps {
  onTestGenerated: (session: any) => void
  onError: (error: string) => void
  loading: boolean
  usage?: { used: number; limit: number; remaining: number; isTrial: boolean; planName: string | null } | null
}

const BOARD_LABEL: Record<string, string> = {
  CBSE: 'CBSE', ICSE: 'ICSE', STATE_UP: 'UP Board', STATE_MH: 'Maharashtra Board', STATE_TN: 'Tamil Nadu Board',
}

export default function TestGeneratorForm({ onTestGenerated, onError, loading, usage }: TestGeneratorFormProps) {
  // ── Profile + subscription (the single source of truth, same as AI Tutor) ──
  const { userBoard, userClass, userMedium, userStream, isLoading: profileLoading, error: profileError } = useUserProfile()
  const { subscriptionData, hasAllSubjects, purchasedSubjects, isLoading: subLoading } = useSubscription()

  const hasAllClasses = subscriptionData?.access?.has_all_classes ?? false
  const planName = subscriptionData?.subscription?.plan_name ?? null
  const needsUpgrade = subscriptionData?.needs_upgrade ?? false

  // Pro plan can switch class; everyone else is locked to their profile class.
  const [classOverride, setClassOverride] = useState<number | null>(null)
  const effectiveClass = (hasAllClasses ? classOverride : null) ?? userClass

  // Entitlement-aware subjects for this class.
  const entitledSubjects = useSubjectFilter({
    classLevel: effectiveClass,
    medium: userMedium,
    stream: userStream,
    purchasedSubjects,
    hasAllSubjects,
    enableLogging: false,
  })

  // ── Form selections ──
  const [subjects, setSubjects] = useState<string[]>([])
  const [chapters, setChapters] = useState<string[]>([])
  const [totalQuestions, setTotalQuestions] = useState<10 | 20 | 30 | 50>(20)
  const [dist, setDist] = useState<DifficultyDistribution>({ EASY: 6, MEDIUM: 10, HARD: 4 })
  const [useCustomDist, setUseCustomDist] = useState(false)
  const [curriculum, setCurriculum] = useState<{ subjects: string[]; chapters: Record<string, string[]> }>({ subjects: [], chapters: {} })

  // Fetch the real curriculum (subjects/chapters that have questions) for this board+class.
  useEffect(() => {
    if (!effectiveClass || !userBoard) return
    const params = new URLSearchParams({ grade: String(effectiveClass), board: userBoard })
    fetch(`/api/practest/curriculum?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { if (d?.success) setCurriculum({ subjects: d.subjects || [], chapters: d.chapters || {} }) })
      .catch(() => {})
    setSubjects([]); setChapters([])
  }, [effectiveClass, userBoard])

  // Offer subjects the student is entitled to AND that have questions. (All plans
  // include all subjects, so entitlement rarely restricts here — but we still respect
  // it. Fall back to "has questions" so a subject-name mismatch never blocks the student.)
  const availableSubjects = useMemo(() => {
    if (!curriculum.subjects.length) return entitledSubjects
    if (!entitledSubjects.length) return curriculum.subjects
    const intersection = curriculum.subjects.filter((s) => entitledSubjects.includes(s))
    return intersection.length ? intersection : curriculum.subjects
  }, [entitledSubjects, curriculum.subjects])

  const availableChapters = useMemo(
    () => Array.from(new Set(subjects.flatMap((s) => curriculum.chapters[s] || []))).sort(),
    [subjects, curriculum.chapters],
  )

  // Default difficulty mix tracks the count unless customised.
  useEffect(() => {
    if (!useCustomDist) {
      const t = totalQuestions
      const easy = Math.round(t * 0.3), med = Math.round(t * 0.5)
      setDist({ EASY: easy, MEDIUM: med, HARD: t - easy - med })
    }
  }, [totalQuestions, useCustomDist])

  const estimatedDuration = Math.max(5, Math.ceil(totalQuestions * 1.5))

  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const isValid = !!userBoard && !!effectiveClass && subjects.length > 0
  const limitReached = !!usage && usage.limit > 0 && usage.remaining <= 0

  const handleGenerate = async () => {
    if (!isValid) { onError('Select at least one subject.'); return }
    try {
      const res = await fetch('/api/practest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: userBoard,
          class_level: effectiveClass,
          subjects,
          chapters,
          total_questions: totalQuestions,
          difficulty_distribution: useCustomDist ? dist : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) onTestGenerated(data)
      else onError(data.error || 'Failed to generate test')
    } catch {
      onError('Failed to generate test. Please try again.')
    }
  }

  // ── Loading / onboarding states ──
  if (profileLoading || subLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading your profile…
      </div>
    )
  }

  if (profileError === 'NO_PROFILE' || !userClass) {
    return (
      <div className="p-8 text-center">
        <AcademicCapIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">Complete your profile first</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Practest uses your board and class to build the right test. Set them up once and you’re ready.
        </p>
        <Button asChild variant="gradient" className="mt-5">
          <Link href="/dashboard/user/profile">Set up my profile</Link>
        </Button>
      </div>
    )
  }

  const distTotal = dist.EASY + dist.MEDIUM + dist.HARD

  return (
    <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-3">
      {/* Form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Profile context bar (auto — not a picker) */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/70 p-3 shadow-elev-1">
          <Badge variant="brand" className="gap-1"><AcademicCapIcon className="h-3.5 w-3.5" /> Class {effectiveClass}</Badge>
          <Badge variant="soft">{BOARD_LABEL[userBoard ?? ''] || userBoard}</Badge>
          {userMedium && <Badge variant="secondary">{`${String(userMedium).charAt(0)}${String(userMedium).slice(1).toLowerCase()}`} medium</Badge>}
          {planName && <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><SparklesIcon className="h-3.5 w-3.5" /> {planName}</span>}

          {hasAllClasses ? (
            <div className="ml-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Switch class:</span>
              <Select value={String(effectiveClass)} onValueChange={(v) => setClassOverride(parseInt(v))}>
                <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><LockClosedIcon className="h-3.5 w-3.5" /> from your profile</span>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CogIcon className="h-5 w-5 text-primary" /> Build your test</CardTitle>
            <CardDescription>Pick one or more subjects for a mixed test. Chapters are optional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Subjects (entitlement-aware) */}
            <div className="space-y-3">
              <Label>Subjects <span className="font-normal text-muted-foreground">(select one or more)</span></Label>
              {availableSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No practice questions are available for Class {effectiveClass} yet. Please check back soon.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableSubjects.map((s) => {
                    const on = subjects.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { toggle(subjects, setSubjects, s); setChapters([]) }}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                          on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-accent'
                        }`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                          {on && '✓'}
                        </span>
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
              {subjects.length > 1 && <p className="text-xs text-muted-foreground">Mixed test — questions are balanced across your {subjects.length} subjects.</p>}
            </div>

            {/* Optional chapters */}
            {availableChapters.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label>Chapters <span className="font-normal text-muted-foreground">(optional — leave empty for all)</span></Label>
                  <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-3">
                    {availableChapters.map((c) => (
                      <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={chapters.includes(c)} onChange={() => toggle(chapters, setChapters, c)} className="rounded border-input text-primary focus:ring-ring" />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Count + difficulty */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Number of questions</Label>
                <Select value={String(totalQuestions)} onValueChange={(v) => setTotalQuestions(parseInt(v) as 10 | 20 | 30 | 50)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 20, 30, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated duration</Label>
                <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-medium text-foreground"><ClockIcon className="h-4 w-4 text-muted-foreground" /> {estimatedDuration} min</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Difficulty mix</Label>
                <Button variant="outline" size="sm" onClick={() => setUseCustomDist((v) => !v)}>{useCustomDist ? 'Use default' : 'Customize'}</Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {(['EASY', 'MEDIUM', 'HARD'] as const).map((k) => (
                  <div key={k} className="space-y-2">
                    <Label className="text-sm">{k}</Label>
                    {useCustomDist ? (
                      <input type="number" min={0} max={totalQuestions} value={dist[k]} onChange={(e) => setDist((d) => ({ ...d, [k]: Math.max(0, parseInt(e.target.value) || 0) }))} className="w-full rounded-xl border border-input bg-background p-2 text-sm text-foreground shadow-elev-1 outline-none focus:border-primary focus:ring-2 focus:ring-ring/35" />
                    ) : (
                      <div className="rounded-xl bg-muted p-2 text-center text-sm font-medium text-foreground">{dist[k]}</div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Total {distTotal} / {totalQuestions}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <div className="space-y-6">
        {needsUpgrade && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
            <InformationCircleIcon className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
              Your plan is inactive. <Link href="/dashboard/user/pricing" className="font-semibold underline">See plans</Link> to unlock more.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DocumentTextIcon className="h-5 w-5 text-emerald-600" /> Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Class" value={`Class ${effectiveClass} · ${BOARD_LABEL[userBoard ?? ''] || userBoard}`} />
            <Row label="Subjects" value={subjects.length ? subjects.join(', ') : '—'} />
            <Row label="Chapters" value={chapters.length ? `${chapters.length} selected` : 'All'} />
            <Row label="Questions" value={String(totalQuestions)} />
            <Row label="Est. duration" value={`${estimatedDuration} min`} />
          </CardContent>
        </Card>

        {usage && usage.limit > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {usage.remaining > 0 ? (
              <><span className="font-semibold text-foreground">{usage.remaining}</span> of {usage.limit} practice tests left today{usage.isTrial ? ' (trial)' : ''}</>
            ) : (
              <span className="font-medium text-rose-600 dark:text-rose-400">Daily limit reached — resets tomorrow.</span>
            )}
          </p>
        )}

        <Button onClick={handleGenerate} disabled={!isValid || loading || limitReached} variant="gradient" size="xl" className="w-full">
          {loading ? 'Generating…' : limitReached ? 'Daily limit reached' : <><PlayIcon className="h-5 w-5" /> Generate test</>}
        </Button>

        {limitReached && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard/user/pricing">Upgrade for more tests</Link>
          </Button>
        )}

        <Alert>
          <InformationCircleIcon className="h-4 w-4" />
          <AlertDescription className="text-sm text-muted-foreground">
            Your class and board are taken from your profile — the same way the AI Tutor works. Options shuffle per question and score by ID, so there are no answer mismatches.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}
