'use client'

// VG Kosh Practest Engine - Test Results View (real, server-scored results)
// Presentation ported to the .dcs Indic mock; scoring/data stay server-authoritative.

import React, { useState } from 'react'
import {
  Trophy,
  BarChart3,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
} from 'lucide-react'

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

import { type NormalizedResult } from '@/types/quiz'

interface TestResultsViewProps {
  results?: ResultsShape
  batchResult?: NormalizedResult
  onBackToGenerator: () => void
  onViewHistory: () => void
}

const GC = 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))'
const GT = 'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))'
const GW = 'linear-gradient(135deg,var(--turmeric),var(--gold))'

const accuracyColor = (a: number): string =>
  a >= 80 ? 'var(--emerald)' : a >= 60 ? 'var(--turmeric)' : 'var(--kumkum)'

const barGrad = (key: string): string => {
  const k = key.toUpperCase()
  if (k === 'EASY') return 'linear-gradient(90deg,var(--teal-light),var(--peacock-teal))'
  if (k === 'HARD') return 'linear-gradient(90deg,var(--kumkum),var(--saffron))'
  return 'linear-gradient(90deg,var(--saffron),var(--turmeric))'
}

export default function TestResultsView({ results, batchResult, onBackToGenerator, onViewHistory }: TestResultsViewProps) {
  const [tab, setTab] = useState<'overview' | 'difficulty' | 'questions'>('difficulty')

  let computedResults = results
  if (batchResult) {
    computedResults = {
      percentage: batchResult.score,
      totalScore: batchResult.correctAnswers,
      maxPossibleScore: batchResult.totalQuestions,
      correct: batchResult.correctAnswers,
      total: batchResult.totalQuestions,
      questionResults: batchResult.breakdown.map(b => ({
        questionId: b.questionId,
        questionText: b.questionText,
        yourAnswerText: b.selectedOptionId ? (b.selectedOptionId === b.correctOptionId ? 'Correct Option' : 'Incorrect Option') : 'Not answered',
        correctAnswerText: 'Correct Option',
        isCorrect: b.isCorrect,
        marksAwarded: b.isCorrect ? 1 : 0,
        maxMarks: 1,
        difficulty: null,
        topic: null,
        explanation: b.explanation || null,
      }))
    }
  }

  const percentage = Math.round(computedResults?.percentage ?? 0)
  const totalScore = computedResults?.totalScore ?? 0
  const maxScore = computedResults?.maxPossibleScore ?? 0
  const correct = computedResults?.correct ?? 0
  const total = computedResults?.total ?? 0
  const questionResults = computedResults?.questionResults ?? []
  const topicPerformance = computedResults?.topicPerformance ?? []
  const difficultyPerformance = computedResults?.difficultyPerformance ?? []

  const badge =
    percentage >= 90 ? { bg: 'var(--emerald)', text: 'Excellent' }
    : percentage >= 75 ? { bg: 'var(--emerald)', text: 'Very Good' }
    : percentage >= 60 ? { bg: 'var(--turmeric)', text: 'Good' }
    : percentage >= 40 ? { bg: 'var(--turmeric)', text: 'Average' }
    : { bg: 'var(--kumkum)', text: 'Needs work' }

  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: 'overview', label: 'By topic' },
    { id: 'difficulty', label: 'By difficulty' },
    { id: 'questions', label: 'Review' },
  ]

  const renderBars = (rows: Breakdown[], empty: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {rows.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{empty}</p>}
      {rows.map((d) => (
        <div key={d.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{d.key}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {d.correct}/{d.attempted} · <strong style={{ color: accuracyColor(d.accuracy) }}>{d.accuracy}%</strong>
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${d.accuracy}%`, background: barGrad(d.key) }} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="dcs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg,rgb(var(--accent-primary-rgb) / 0.1),rgb(0 106 110 / 0.06))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="plinth" style={{ width: 54, height: 54, background: GT }}>
                <Trophy className="h-[27px] w-[27px]" />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>Test completed!</h2>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--muted)' }}>Server-scored — every answer verified by option id.</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{percentage}%</div>
              <span className="tag" style={{ marginTop: 6, background: badge.bg, color: '#fff' }}>{badge.text}</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
          <Stat Icon={FileText} label="Score" value={`${totalScore} / ${maxScore}`} grad={GC} />
          <Stat Icon={CheckCircle} label="Correct" value={`${correct} / ${total}`} grad={GT} />
          <Stat Icon={BarChart3} label="Accuracy" value={`${total ? Math.round((correct / total) * 100) : 0}%`} grad={GW} />
        </div>

        {/* Tabs + content */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`chip ${tab === t.id ? 'on' : ''}`} style={{ padding: '9px 18px' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && renderBars(topicPerformance, 'No topic data.')}
          {tab === 'difficulty' && renderBars(difficultyPerformance, 'No difficulty data.')}
          {tab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '30rem', overflowY: 'auto' }}>
              {questionResults.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>No question data.</p>}
              {questionResults.map((q, i) => (
                <div key={q.questionId} style={{ borderRadius: 12, border: '1px solid var(--line)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Q{i + 1}</strong>
                      {q.difficulty && <span className="tag" style={{ background: 'var(--panel-2)', color: 'var(--muted)', border: '1px solid var(--line)' }}>{q.difficulty}</span>}
                      {q.topic && <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)' }}>{q.topic}</span>}
                    </div>
                    {q.isCorrect
                      ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--emerald)' }} />
                      : <XCircle className="h-5 w-5" style={{ color: 'var(--kumkum)' }} />}
                  </div>
                  {q.questionText && <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--ink)' }}>{q.questionText}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Your answer: </span>
                      <span style={{ color: q.isCorrect ? 'var(--emerald)' : 'var(--kumkum)', fontWeight: 600 }}>{q.yourAnswerText || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)' }}>Correct: </span>
                      <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>{q.correctAnswerText}</span>
                    </div>
                  </div>
                  {!q.isCorrect && q.explanation && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: 'rgb(var(--accent-primary-rgb) / 0.08)', fontSize: 12.5, lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--accent-text)' }}>Explanation: </strong>
                      <span style={{ color: 'var(--muted)' }}>{q.explanation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onBackToGenerator}>
            <RefreshCw className="h-5 w-5" /> Take another test
          </button>
          <button className="btn btn-ghost" onClick={onViewHistory}>
            <Eye className="h-5 w-5" /> View history
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ Icon, label, value, grad }: { Icon: React.ComponentType<{ className?: string }>; label: string; value: string; grad: string }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className="plinth" style={{ width: 42, height: 42, flex: 'none', background: grad }}>
        <Icon className="h-[21px] w-[21px]" />
      </span>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{value}</div>
      </div>
    </div>
  )
}
