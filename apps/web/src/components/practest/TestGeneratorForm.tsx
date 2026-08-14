'use client'

// VG Kosh Practest Engine - Test Generator
// Profile-driven (like the AI Tutor): board + class come from the student's profile
// and subscription (no manual pickers), subjects come from useSubjectFilter
// (entitlement-aware), and only subjects that actually have questions are offered.

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Settings, FileText, Clock, Play, Info, GraduationCap, Lock, Sparkles,
} from 'lucide-react'
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
      <div className="dcs">
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <div className="spin" style={{ width: 32, height: 32, margin: '0 auto 12px', borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent-primary)' }} />
          Loading your profile…
        </div>
      </div>
    )
  }

  if (profileError === 'NO_PROFILE' || !userClass) {
    return (
      <div className="dcs">
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <span className="plinth" style={{ width: 56, height: 56, margin: '0 auto 14px', background: 'linear-gradient(135deg,var(--kumkum),var(--saffron))' }}>
            <GraduationCap className="h-7 w-7" />
          </span>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Complete your profile first</h3>
          <p style={{ margin: '6px auto 0', maxWidth: '42ch', fontSize: 13.5, color: 'var(--muted)' }}>
            Practest uses your board and class to build the right test. Set them up once and you’re ready.
          </p>
          <Link href="/dashboard/user/profile" className="btn btn-primary" style={{ marginTop: 18 }}>Set up my profile</Link>
        </div>
      </div>
    )
  }

  const distTotal = dist.EASY + dist.MEDIUM + dist.HARD
  const diffColor: Record<string, string> = { EASY: 'var(--emerald)', MEDIUM: '#006A6E', HARD: 'var(--kumkum)' }

  return (
    <div className="dcs">
      <div className="two-col">
        {/* Form */}
        <div className="card" style={{ padding: 22 }}>
          {/* Profile context bar (auto — not a picker) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 18, padding: '11px 13px', borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
            <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)' }}><GraduationCap className="h-[13px] w-[13px]" /> Class {effectiveClass}</span>
            <span className="tag" style={{ background: 'rgb(0 106 110 / 0.12)', color: '#006A6E' }}>{BOARD_LABEL[userBoard ?? ''] || userBoard}</span>
            {userMedium && <span className="tag" style={{ background: 'var(--panel)', color: 'var(--muted)', border: '1px solid var(--line)' }}>{`${String(userMedium).charAt(0)}${String(userMedium).slice(1).toLowerCase()}`} medium</span>}
            {planName && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}><Sparkles className="h-[13px] w-[13px]" /> {planName}</span>}

            {hasAllClasses ? (
              <div style={{ marginLeft: planName ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Switch class:</span>
                <Select value={String(effectiveClass)} onValueChange={(v) => setClassOverride(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <span style={{ marginLeft: planName ? 0 : 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)' }}><Lock className="h-[13px] w-[13px]" /> from your profile</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Settings className="h-[19px] w-[19px]" style={{ color: 'var(--accent-text)' }} />
            <h3 className="sech" style={{ fontSize: 17 }}>Build your test</h3>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Pick one or more subjects for a mixed test. Chapters are optional.</p>

          {/* Subjects (entitlement-aware) */}
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 9 }}>
            Subjects <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(select one or more)</span>
          </label>
          {availableSubjects.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              No practice questions are available for Class {effectiveClass} yet. Please check back soon.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 9, marginBottom: 8 }}>
              {availableSubjects.map((s) => {
                const on = subjects.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { toggle(subjects, setSubjects, s); setChapters([]) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', padding: '11px 12px',
                      borderRadius: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600,
                      background: on ? 'rgb(var(--accent-primary-rgb) / 0.1)' : 'var(--panel-2)',
                      border: `1.5px solid ${on ? 'var(--accent-primary)' : 'var(--line)'}`,
                      color: on ? 'var(--accent-text)' : 'var(--ink)',
                    }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 5, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', background: on ? 'var(--accent-primary)' : 'transparent', border: `1.5px solid ${on ? 'var(--accent-primary)' : 'var(--muted)'}` }}>
                      {on && '✓'}
                    </span>
                    {s}
                  </button>
                )
              })}
            </div>
          )}
          {subjects.length > 1 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Mixed test — questions are balanced across your {subjects.length} subjects.</p>}

          {/* Optional chapters */}
          {availableChapters.length > 0 && (
            <>
              <div style={{ height: 1, background: 'var(--line-soft)', margin: '18px 0' }} />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 9 }}>
                Chapters <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional — leave empty for all)</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8, maxHeight: 176, overflowY: 'auto', borderRadius: 11, border: '1px solid var(--line)', padding: 12 }}>
                {availableChapters.map((c) => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                    <input type="checkbox" checked={chapters.includes(c)} onChange={() => toggle(chapters, setChapters, c)} style={{ accentColor: 'var(--accent-primary)' }} />
                    {c}
                  </label>
                ))}
              </div>
            </>
          )}

          <div style={{ height: 1, background: 'var(--line-soft)', margin: '18px 0' }} />

          {/* Count + duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 9 }}>Number of questions</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([10, 20, 30, 50] as const).map((n) => {
                  const on = totalQuestions === n
                  return (
                    <button
                      key={n}
                      onClick={() => setTotalQuestions(n)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)',
                        fontWeight: 700, fontSize: 13.5,
                        background: on ? 'linear-gradient(135deg,var(--kumkum),var(--saffron))' : 'var(--panel-2)',
                        color: on ? '#fff' : 'var(--muted)',
                        border: `1.5px solid ${on ? 'transparent' : 'var(--line)'}`,
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 9 }}>Estimated duration</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderRadius: 10, background: 'var(--panel-2)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', border: '1px solid var(--line-soft)' }}>
                <Clock className="h-[17px] w-[17px]" style={{ color: 'var(--muted)' }} /> {estimatedDuration} min
              </div>
            </div>
          </div>

          {/* Difficulty mix */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Difficulty mix</label>
            <button className="chip" onClick={() => setUseCustomDist((v) => !v)} style={{ padding: '5px 12px', fontSize: 12 }}>{useCustomDist ? 'Use default' : 'Customize'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {(['EASY', 'MEDIUM', 'HARD'] as const).map((k) => (
              <div key={k} style={{ textAlign: 'center', padding: 13, borderRadius: 11, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', color: diffColor[k] }}>{k}</div>
                {useCustomDist ? (
                  <input
                    type="number" min={0} max={totalQuestions} value={dist[k]}
                    onChange={(e) => setDist((d) => ({ ...d, [k]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{ width: '100%', marginTop: 6, textAlign: 'center', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--field)', padding: 6, fontSize: 16, fontWeight: 800, color: 'var(--ink)', outline: 'none' }}
                  />
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginTop: 3 }}>{dist[k]}</div>
                )}
              </div>
            ))}
          </div>
          {useCustomDist && <p style={{ fontSize: 12, color: distTotal === totalQuestions ? 'var(--muted)' : 'var(--kumkum)', marginTop: 8 }}>Total {distTotal} / {totalQuestions}</p>}
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {needsUpgrade && (
            <div className="card" style={{ padding: 14, borderColor: 'rgb(245 166 35 / 0.4)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Info className="h-4 w-4" style={{ color: 'var(--turmeric)', flex: 'none', marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>
                  Your plan is inactive. <Link href="/dashboard/user/pricing" style={{ fontWeight: 700, textDecoration: 'underline' }}>See plans</Link> to unlock more.
                </p>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <FileText className="h-[19px] w-[19px]" style={{ color: 'var(--emerald)' }} />
              <h3 className="sech" style={{ fontSize: 16 }}>Summary</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 13.5 }}>
              <Row label="Class" value={`Class ${effectiveClass} · ${BOARD_LABEL[userBoard ?? ''] || userBoard}`} />
              <Row label="Subjects" value={subjects.length ? subjects.join(', ') : '—'} />
              <Row label="Chapters" value={chapters.length ? `${chapters.length} selected` : 'All'} />
              <Row label="Questions" value={String(totalQuestions)} />
              <Row label="Est. duration" value={`${estimatedDuration} min`} />
            </div>
          </div>

          {usage && usage.limit > 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              {usage.remaining > 0 ? (
                <><strong style={{ color: 'var(--ink)' }}>{usage.remaining}</strong> of {usage.limit} practice tests left today{usage.isTrial ? ' (trial)' : ''}</>
              ) : (
                <span style={{ fontWeight: 600, color: 'var(--kumkum)' }}>Daily limit reached — resets tomorrow.</span>
              )}
            </p>
          )}

          <button onClick={handleGenerate} disabled={!isValid || loading || limitReached} className="btn btn-primary" style={{ width: '100%', padding: 15, fontSize: 16 }}>
            {loading ? 'Generating…' : limitReached ? 'Daily limit reached' : <><Play className="h-5 w-5" /> Generate test</>}
          </button>

          {limitReached && (
            <Link href="/dashboard/user/pricing" className="btn btn-ghost" style={{ width: '100%' }}>Upgrade for more tests</Link>
          )}

          <div style={{ display: 'flex', gap: 10, padding: 13, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
            <Info className="h-[18px] w-[18px]" style={{ color: 'var(--accent-text)', flex: 'none' }} />
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              Your class and board come from your profile, like the AI Tutor. Options shuffle per question and score by ID — no answer mismatches.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}
