'use client'

// VG Kosh Practest Engine - Active Test Interface
// Consumes REAL questions returned by /api/practest/generate (shuffle-safe: each
// option carries a stable id). The student selects an option id; on completion we
// PUT the { questionId: optionId } map and the server scores authoritatively.

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  FlagIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

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
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">No questions available for this test.</CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlayIcon className="h-5 w-5 text-emerald-600" />
                {current?.subject || 'Practice'} Test{current?.grade ? ` — Class ${current.grade}` : ''}
              </CardTitle>
              <CardDescription>{questions.length} questions</CardDescription>
            </div>
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-lg font-bold ${
                timeRemaining < 60
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <ClockIcon className="h-5 w-5" />
              {formatTime(timeRemaining)}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{answeredCount} / {questions.length} answered</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Question */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Question {currentIndex + 1}</Badge>
                  {current?.difficulty && (
                    <Badge
                      variant={
                        current.difficulty === 'EASY' ? 'success' : current.difficulty === 'HARD' ? 'destructive' : 'info'
                      }
                    >
                      {current.difficulty}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {current?.maxMarks ?? 1} mark{(current?.maxMarks ?? 1) !== 1 ? 's' : ''}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => current && toggleFlag(current.id)} aria-label="Flag question">
                  <FlagIcon className={`h-4 w-4 ${current && flagged.has(current.id) ? 'fill-current text-rose-600' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg leading-relaxed text-foreground">{current?.questionText}</p>

              <RadioGroup
                value={currentAnswer}
                onValueChange={(value) => current && handleAnswer(current.id, value)}
                className="space-y-3"
              >
                {current?.options.map((opt, i) => {
                  const selected = currentAnswer === opt.id
                  return (
                    <div
                      key={opt.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                        selected ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-accent/50'
                      }`}
                    >
                      <RadioGroupItem value={opt.id} id={`${current.id}-${opt.id}`} className="mt-1" />
                      <Label htmlFor={`${current.id}-${opt.id}`} className="flex-1 cursor-pointer">
                        <span className="mr-2 font-semibold text-muted-foreground">{LETTER(i)}.</span>
                        {opt.text}
                      </Label>
                    </div>
                  )
                })}
              </RadioGroup>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button variant="outline" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
                  <ChevronLeftIcon className="mr-2 h-4 w-4" /> Previous
                </Button>
                {currentIndex === questions.length - 1 ? (
                  <Button onClick={() => setShowConfirm(true)} disabled={isSubmitting}>
                    <CheckCircleIcon className="mr-2 h-4 w-4" /> Finish Test
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => goTo(currentIndex + 1)}>
                    Next <ChevronRightIcon className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigator */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Navigator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((qq, i) => {
                  const isAnswered = !!answers[qq.id]
                  const isCurrent = i === currentIndex
                  const isFlagged = flagged.has(qq.id)
                  return (
                    <Button
                      key={qq.id}
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => goTo(i)}
                      className={`relative h-10 ${isAnswered && !isCurrent ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : ''} ${isFlagged ? 'ring-2 ring-rose-400' : ''}`}
                    >
                      {i + 1}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <Button variant="gradient" className="w-full" onClick={() => setShowConfirm(true)} disabled={isSubmitting}>
                Submit Test
              </Button>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-100" /> Answered</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border-2 border-border" /> Not answered</div>
                <div className="flex items-center gap-2"><FlagIcon className="h-3 w-3 fill-current text-rose-600" /> Flagged</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Submit test?</CardTitle>
              <CardDescription>This cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Answered: {answeredCount} / {questions.length}</p>
                <p>Time remaining: {formatTime(timeRemaining)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button variant="gradient" className="flex-1" onClick={handleComplete} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
