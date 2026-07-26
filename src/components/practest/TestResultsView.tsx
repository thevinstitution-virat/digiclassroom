'use client'

// VG Kosh Practest Engine - Test Results View (real, server-scored results)

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrophyIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

interface QuestionResult {
  questionId: string
  questionText: string | null
  yourAnswerText: string
  correctAnswerText: string
  isCorrect: boolean
  marksAwarded: number
  maxMarks: number
  difficulty: string | null
  topic: string | null
  explanation: string | null
}

interface Breakdown {
  key: string
  attempted: number
  correct: number
  accuracy: number
}

interface ResultsShape {
  percentage?: number
  totalScore?: number
  maxPossibleScore?: number
  correct?: number
  total?: number
  questionResults?: QuestionResult[]
  topicPerformance?: Breakdown[]
  difficultyPerformance?: Breakdown[]
}

interface TestResultsViewProps {
  results: ResultsShape
  onBackToGenerator: () => void
  onViewHistory: () => void
}

const accuracyVariant = (a: number): 'success' | 'warning' | 'destructive' =>
  a >= 80 ? 'success' : a >= 60 ? 'warning' : 'destructive'

export default function TestResultsView({ results, onBackToGenerator, onViewHistory }: TestResultsViewProps) {
  const [tab, setTab] = useState('overview')

  const percentage = Math.round(results?.percentage ?? 0)
  const totalScore = results?.totalScore ?? 0
  const maxScore = results?.maxPossibleScore ?? 0
  const correct = results?.correct ?? 0
  const total = results?.total ?? 0
  const questionResults = results?.questionResults ?? []
  const topicPerformance = results?.topicPerformance ?? []
  const difficultyPerformance = results?.difficultyPerformance ?? []

  const badge =
    percentage >= 90 ? { variant: 'success' as const, text: 'Excellent' }
    : percentage >= 75 ? { variant: 'success' as const, text: 'Very Good' }
    : percentage >= 60 ? { variant: 'warning' as const, text: 'Good' }
    : percentage >= 40 ? { variant: 'warning' as const, text: 'Average' }
    : { variant: 'destructive' as const, text: 'Needs work' }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <Card variant="gradient">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                <TrophyIcon className="h-7 w-7" />
              </div>
              <div>
                <CardTitle>Test completed!</CardTitle>
                <CardDescription>Server-scored — every answer verified by option id.</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold tracking-tight text-foreground">{percentage}%</div>
              <Badge variant={badge.variant} className="mt-1">{badge.text}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat icon={<DocumentTextIcon className="h-5 w-5" />} label="Score" value={`${totalScore} / ${maxScore}`} chip="from-blue-500 to-cyan-600" />
        <Stat icon={<CheckCircleIcon className="h-5 w-5" />} label="Correct" value={`${correct} / ${total}`} chip="from-emerald-500 to-teal-600" />
        <Stat icon={<ChartBarIcon className="h-5 w-5" />} label="Accuracy" value={`${total ? Math.round((correct / total) * 100) : 0}%`} chip="from-orange-500 to-amber-600" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="difficulty">By difficulty</TabsTrigger>
          <TabsTrigger value="questions">Review</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Topic-wise performance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {topicPerformance.length === 0 && <p className="text-sm text-muted-foreground">No topic data.</p>}
              {topicPerformance.map((t) => (
                <div key={t.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{t.key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t.correct}/{t.attempted}</span>
                      <Badge variant={accuracyVariant(t.accuracy)}>{t.accuracy}%</Badge>
                    </div>
                  </div>
                  <Progress value={t.accuracy} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="difficulty" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Difficulty-wise performance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {difficultyPerformance.length === 0 && <p className="text-sm text-muted-foreground">No difficulty data.</p>}
              {difficultyPerformance.map((d) => (
                <div key={d.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{d.key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{d.correct}/{d.attempted}</span>
                      <Badge variant={accuracyVariant(d.accuracy)}>{d.accuracy}%</Badge>
                    </div>
                  </div>
                  <Progress value={d.accuracy} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question-by-question review</CardTitle>
              <CardDescription>Your answer vs. the correct answer, with explanations.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {questionResults.map((q, i) => (
                  <div key={q.questionId} className="rounded-xl border border-border p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">Q{i + 1}</span>
                        {q.difficulty && <Badge variant="outline">{q.difficulty}</Badge>}
                        {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {q.isCorrect ? (
                          <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-rose-600" />
                        )}
                        <span className="text-sm text-muted-foreground">{q.marksAwarded}/{q.maxMarks}</span>
                      </div>
                    </div>
                    {q.questionText && <p className="mb-2 text-sm text-foreground">{q.questionText}</p>}
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-muted-foreground">Your answer: </span>
                        <span className={q.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                          {q.yourAnswerText || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Correct: </span>
                        <span className="text-emerald-600">{q.correctAnswerText}</span>
                      </div>
                    </div>
                    {!q.isCorrect && q.explanation && (
                      <div className="mt-2 rounded-lg bg-primary/5 p-2 text-sm">
                        <span className="font-medium text-primary">Explanation: </span>
                        <span className="text-muted-foreground">{q.explanation}</span>
                      </div>
                    )}
                  </div>
                ))}
                {questionResults.length === 0 && <p className="text-sm text-muted-foreground">No question data.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center gap-4">
        <Button variant="gradient" size="lg" onClick={onBackToGenerator}>
          <ArrowPathIcon className="mr-2 h-5 w-5" /> Take another test
        </Button>
        <Button variant="outline" size="lg" onClick={onViewHistory}>
          <EyeIcon className="mr-2 h-5 w-5" /> View history
        </Button>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, chip }: { icon: React.ReactNode; label: string; value: string; chip: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${chip} text-white shadow-sm`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
