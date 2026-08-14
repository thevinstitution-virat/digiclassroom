'use client'

// VG Kosh Practest Engine - Active Test Interface
// Consumes REAL questions returned by /api/practest/generate (shuffle-safe: each
// option carries a stable id). The student selects an option id; on completion we
// PUT the { questionId: optionId } map and the server scores authoritatively.

import React, { useState, useEffect, useRef } from 'react'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Flag,
  Play,
} from 'lucide-react'

// Difficulty → [background tint, foreground] (mock diffTint).
const DIFF_TINT: Record<string, [string, string]> = {
  EASY: ['rgb(14 159 110 / 0.14)', 'var(--emerald)'],
  MEDIUM: ['rgb(0 106 110 / 0.12)', '#006A6E'],
  HARD: ['rgb(192 57 43 / 0.12)', 'var(--kumkum)'],
}

export interface GeneratedOption {
  id: string
  text: string
  imageUrl?: string | null
}

export interface GeneratedQuestion {
  id: string
  questionText: string
  questionType?: string
  options: GeneratedOption[]
  subject?: string | null
  grade?: number | null
  difficulty?: string | null
  topic?: string | null
  maxMarks?: number | null
}

export interface GeneratedSession {
  sessionId: string
  questions: GeneratedQuestion[]
  totalQuestions: number
  durationSeconds: number
  status: string
}

interface ActiveTestInterfaceProps {
  session: GeneratedSession
  onTestCompleted?: (results: any) => void
  onError: (error: string) => void
  onBatchSubmit?: (answers: Record<string, string | null>) => Promise<void>
}

const LETTER = (i: number) => String.fromCharCode(65 + i)

export default function ActiveTestInterface({ session, onTestCompleted, onError, onBatchSubmit }: ActiveTestInterfaceProps) {
  const questions = session.questions ?? []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [times, setTimes] = useState<Record<string, number>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [timeRemaining, setTimeRemaining] = useState(session.durationSeconds || questions.length * 90 || 600)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionStart = useRef<number>(Date.now())
  const completedRef = useRef(false)

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          handleComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recordTime = (questionId: string | undefined) => {
    if (!questionId) return
    const spent = Math.max(0, Math.floor((Date.now() - questionStart.current) / 1000))
    setTimes((prev) => ({ ...prev, [questionId]: (prev[questionId] ?? 0) + spent }))
    questionStart.current = Date.now()
  }

  const goTo = (index: number) => {
    recordTime(questions[currentIndex]?.id)
    setCurrentIndex(Math.max(0, Math.min(index, questions.length - 1)))
  }

  const handleAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev)
      next.has(questionId) ? next.delete(questionId) : next.add(questionId)
      return next
    })
  }

  const handleComplete = async () => {
    if (completedRef.current) return
    completedRef.current = true
    setIsSubmitting(true)
    recordTime(questions[currentIndex]?.id)

    if (onBatchSubmit) {
      const fullAnswers: Record<string, string | null> = {}
      questions.forEach(q => {
        fullAnswers[q.id] = answers[q.id] ?? null
      })
      try {
        await onBatchSubmit(fullAnswers)
      } catch (err: any) {
        completedRef.current = false
        console.error('Failed to submit batch test:', err)
        onError(err.message || 'Failed to submit test')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    try {
      const res = await fetch('/api/practest/submit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, answers, times }),
      })
      const data = await res.json()
      if (data.success) {
        onTestCompleted?.(data)
      } else {
        completedRef.current = false
        onError(data.error || 'Failed to complete test')
      }
    } catch (err) {
      completedRef.current = false
      console.error('Failed to complete test:', err)
      onError('Failed to complete test')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (s: number): string => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m}:${sec.toString().padStart(2, '0')}`
  }

  const answeredCount = Object.keys(answers).length
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0
  const current = questions[currentIndex]
  const currentAnswer = current ? answers[current.id] ?? '' : ''

  if (!questions.length) {
    return (
      <div className="dcs">
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          No questions available for this test.
        </div>
      </div>
    )
  }

  const timerRed = timeRemaining < 60
  const [diffBg, diffFg] = current?.difficulty ? (DIFF_TINT[current.difficulty] ?? DIFF_TINT.MEDIUM) : DIFF_TINT.MEDIUM

  return (
    <div className="dcs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Play className="h-5 w-5" style={{ color: 'var(--emerald)' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>
                  {current?.subject || 'Practice'} Test{current?.grade ? ` — Class ${current.grade}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{questions.length} questions</div>
              </div>
            </div>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'monospace',
                fontWeight: 800, fontSize: 17, padding: '8px 16px', borderRadius: 11,
                background: timerRed ? 'rgb(192 57 43 / 0.14)' : 'rgb(var(--accent-primary-rgb) / 0.12)',
                color: timerRed ? 'var(--kumkum)' : 'var(--accent-text)',
              }}
            >
              <Clock className="h-[19px] w-[19px]" />
              {formatTime(timeRemaining)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)', margin: '14px 0 6px' }}>
            <span>{answeredCount} / {questions.length} answered</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${progress}%`, background: 'linear-gradient(90deg,var(--accent-strong),var(--gold))', transition: 'width .3s' }} />
          </div>
        </div>

        <div className="two-col">
          {/* Question */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span className="tag" style={{ background: 'var(--panel-2)', color: 'var(--muted)', border: '1px solid var(--line)' }}>Question {currentIndex + 1}</span>
                {current?.difficulty && (
                  <span className="tag" style={{ background: diffBg, color: diffFg }}>{current.difficulty}</span>
                )}
                <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  {current?.maxMarks ?? 1} mark{(current?.maxMarks ?? 1) !== 1 ? 's' : ''}
                </span>
              </div>
              <button className="iconbtn" onClick={() => current && toggleFlag(current.id)} aria-label="Flag question" style={{ border: 'none', background: 'none' }}>
                <Flag className="h-5 w-5" style={{ color: current && flagged.has(current.id) ? 'var(--kumkum)' : 'var(--muted)', fill: current && flagged.has(current.id) ? 'var(--kumkum)' : 'none' }} />
              </button>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: 'clamp(16px,2vw,19px)', lineHeight: 1.5, color: 'var(--ink)', fontWeight: 600 }}>{current?.questionText}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {current?.options.map((opt, i) => {
                const selected = currentAnswer === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => current && handleAnswer(current.id, opt.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', padding: '14px 16px',
                      borderRadius: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14.5,
                      fontWeight: 600, color: 'var(--ink)', transition: 'all .16s',
                      background: selected ? 'rgb(var(--accent-primary-rgb) / 0.1)' : 'var(--panel-2)',
                      border: `1.5px solid ${selected ? 'var(--accent-primary)' : 'var(--line)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: 28, height: 28, borderRadius: 999, flex: 'none', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13,
                        background: selected ? 'linear-gradient(135deg,var(--kumkum),var(--saffron))' : 'var(--chip-bg)',
                        color: selected ? '#fff' : 'var(--accent-text)',
                      }}
                    >
                      {LETTER(i)}
                    </span>
                    <span style={{ flex: 1 }}>{opt.text}</span>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
              <button className="btn btn-ghost" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              {currentIndex === questions.length - 1 ? (
                <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={isSubmitting}>
                  <CheckCircle className="h-4 w-4" /> Finish Test
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={() => goTo(currentIndex + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Navigator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <h3 className="sech" style={{ fontSize: 16, marginBottom: 14 }}>Navigator</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                {questions.map((qq, i) => {
                  const isAnswered = !!answers[qq.id]
                  const isCurrent = i === currentIndex
                  const isFlagged = flagged.has(qq.id)
                  return (
                    <button
                      key={qq.id}
                      onClick={() => goTo(i)}
                      style={{
                        height: 40, borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-body)',
                        fontWeight: 700, fontSize: 13.5,
                        background: isCurrent ? 'linear-gradient(135deg,var(--kumkum),var(--saffron))' : isAnswered ? 'rgb(14 159 110 / 0.14)' : 'var(--panel-2)',
                        color: isCurrent ? '#fff' : isAnswered ? 'var(--emerald)' : 'var(--muted)',
                        border: `1.5px solid ${isCurrent ? 'transparent' : isAnswered ? 'var(--emerald)' : 'var(--line)'}`,
                        boxShadow: isFlagged ? '0 0 0 2px var(--kumkum)' : 'none',
                      }}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowConfirm(true)} disabled={isSubmitting}>
                Submit Test
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 13, height: 13, borderRadius: 4, background: 'rgb(14 159 110 / 0.2)', border: '1px solid var(--emerald)' }} /> Answered</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 13, height: 13, borderRadius: 4, border: '1.5px solid var(--line)' }} /> Not answered</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Flag className="h-[14px] w-[14px]" style={{ color: 'var(--kumkum)', fill: 'var(--kumkum)' }} /> Flagged</span>
              </div>
            </div>
          </div>
        </div>

        {showConfirm && (
          <div
            onClick={() => !isSubmitting && setShowConfirm(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, background: 'rgb(10 15 30 / 0.55)', backdropFilter: 'blur(4px)' }}
          >
            <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--ink)' }}>Submit test?</h3>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>This cannot be undone.</p>
              <div style={{ margin: '16px 0', padding: 13, borderRadius: 11, background: 'var(--panel-2)', fontSize: 13, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span>Answered: {answeredCount} / {questions.length}</span>
                <span>Time remaining: {formatTime(timeRemaining)}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowConfirm(false)} disabled={isSubmitting}>
                  Cancel
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleComplete} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
