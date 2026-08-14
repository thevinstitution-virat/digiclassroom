'use client'

// VG Kosh Practest Engine - User Test Interface
// Presentation ported to the .dcs Indic mock (DigiClassroom Student App.dc.html);
// all state, fetches (/api/practest/*) and sub-component wiring are unchanged.

import React, { useState, useEffect } from 'react'
import {
  Clock,
  FileText,
  GraduationCap,
  BarChart3,
  Play,
  AlertTriangle,
  Target,
  TrendingUp,
  Sparkles,
  Award,
} from 'lucide-react'
import { TestSession } from '@/types/practest'
import TestGeneratorForm from '@/components/practest/TestGeneratorForm'
import ActiveTestInterface from '@/components/practest/ActiveTestInterface'
import TestResultsView from '@/components/practest/TestResultsView'
import { BatchModeSelector } from '@/components/practest/BatchModeSelector'
import { BatchQuizList } from '@/components/practest/BatchQuizList'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { useUserProfile } from '@/hooks'

type ViewState = 'generator' | 'active_test' | 'results' | 'history'

interface PractestPageState {
  currentView: ViewState
  activeSession: any | null
  testResults: any | null
  loading: boolean
  error: string | null
}

const GC = 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))'
const GT = 'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))'
const GV = 'linear-gradient(135deg,var(--lotus-deep),var(--lotus-pink))'
const GW = 'linear-gradient(135deg,var(--turmeric),var(--gold))'
const GP = 'linear-gradient(135deg,var(--kumkum),var(--saffron))'

export default function PractestPage() {
  const { user, isLoaded } = useBetterAuthUser()
  const [state, setState] = useState<PractestPageState>({
    currentView: 'generator',
    activeSession: null,
    testResults: null,
    loading: false,
    error: null
  })

  const [mode, setMode] = useState<'general' | 'batch'>('general')

  const [series, setSeries] = useState<any[]>([])
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number; isTrial: boolean; planName: string | null; needsUpgrade: boolean } | null>(null)
  const { userClass } = useUserProfile()
  // Only show series for the student's class (their profile drives accessibility).
  const visibleSeries = series.filter((s) => !userClass || s.classLevel === userClass)

  // Load published test series + today's usage on mount
  useEffect(() => {
    if (isLoaded && user) {
      loadSeries()
      loadUsage()
    }
  }, [isLoaded, user])

  const loadSeries = async () => {
    try {
      const res = await fetch('/api/practest/configurations')
      const data = await res.json()
      if (data.success) setSeries(data.configurations || [])
    } catch (error) {
      console.error('Failed to load test series:', error)
    }
  }

  const loadUsage = async () => {
    try {
      const res = await fetch('/api/practest/usage')
      const data = await res.json()
      if (data.success) setUsage(data)
    } catch (error) {
      console.error('Failed to load usage:', error)
    }
  }

  const startSeries = async (configurationId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch('/api/practest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurationId }),
      })
      const data = await res.json()
      if (data.success) {
        handleTestGenerated(data)
      } else {
        setState(prev => ({ ...prev, loading: false, error: data.error || 'Failed to start test series' }))
      }
    } catch {
      setState(prev => ({ ...prev, loading: false, error: 'Failed to start test series' }))
    }
  }

  const handleTestGenerated = (session: any) => {
    setState(prev => ({
      ...prev,
      currentView: 'active_test',
      activeSession: session,
      error: null
    }))
    loadUsage() // a test was just created — refresh the daily count
  }

  const handleTestCompleted = (results: any) => {
    setState(prev => ({
      ...prev,
      currentView: 'results',
      activeSession: null,
      testResults: results
    }))
  }

  const handleBackToGenerator = () => {
    setState(prev => ({
      ...prev,
      currentView: 'generator',
      activeSession: null,
      testResults: null,
      error: null
    }))
  }

  const handleViewHistory = () => {
    setState(prev => ({
      ...prev,
      currentView: 'history'
    }))
  }

  if (!isLoaded) {
    return (
      <div className="dcs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="plinth spin" style={{ width: 64, height: 64, margin: '0 auto 18px', background: GP }}>
            <Target className="h-8 w-8" />
          </span>
          <p style={{ color: 'var(--muted)', fontWeight: 600 }}>Loading Practest engine…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="dcs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ width: 384, maxWidth: '100%', padding: 26, textAlign: 'center' }}>
          <span className="plinth" style={{ width: 64, height: 64, margin: '0 auto 16px', background: GP }}>
            <Target className="h-8 w-8" />
          </span>
          <h2 className="grad" style={{ fontSize: 20, fontWeight: 800 }}>Authentication required</h2>
          <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>Please sign in to access the AI-powered Practest engine.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dcs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)', border: '1px solid rgb(var(--accent-primary-rgb) / 0.28)', padding: '7px 15px' }}>
            <Sparkles className="h-[15px] w-[15px]" /> AI-Powered Assessment Engine
          </span>
          <h2 className="grad" style={{ margin: '14px 0 6px', fontSize: 'clamp(26px,3.6vw,38px)', fontWeight: 800, letterSpacing: '-.02em' }}>
            e-Learning Practest
          </h2>
          <p style={{ margin: '0 auto', color: 'var(--muted)', fontSize: 15, maxWidth: '60ch', lineHeight: 1.55 }}>
            Adaptive testing, intelligent question generation and detailed analytics.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button
              className={`chip ${state.currentView === 'generator' ? 'on' : ''}`}
              onClick={handleBackToGenerator}
              disabled={state.currentView === 'active_test'}
              style={{ padding: '10px 20px' }}
            >
              <Play className="h-[17px] w-[17px]" /> New Test
            </button>
            <button
              className={`chip ${state.currentView === 'history' ? 'on' : ''}`}
              onClick={handleViewHistory}
              disabled={state.currentView === 'active_test'}
              style={{ padding: '10px 20px' }}
            >
              <BarChart3 className="h-[17px] w-[17px]" /> History
            </button>
          </div>

          {usage && usage.limit > 0 && (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '7px 15px', borderRadius: 999, background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Practice tests today:</span>
              <strong style={{ color: 'var(--ink)' }}>{usage.used} / {usage.limit}</strong>
              {usage.isTrial && (
                <span className="tag" style={{ background: GP, color: '#fff' }}>Trial</span>
              )}
              {usage.remaining <= 0 && (
                <span style={{ fontWeight: 600, color: 'var(--kumkum)' }}>· limit reached, resets tomorrow</span>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {state.error && (
          <div className="card" style={{ padding: 16, borderColor: 'rgb(192 57 43 / 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))' }}>
                <AlertTriangle className="h-5 w-5" />
              </span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{state.error}</span>
            </div>
          </div>
        )}

        <BatchModeSelector mode={mode} setMode={setMode} />

        {/* Main content */}
        {mode === 'batch' ? (
          <BatchQuizList />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {state.currentView === 'generator' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Published test series */}
                {visibleSeries.length > 0 && (
                  <div>
                    <h3 className="sech" style={{ marginBottom: 12 }}>Ready-made test series</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 }}>
                      {visibleSeries.map((s) => (
                        <div key={s.id} className="card lift" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span className="tag" style={{ background: GP, color: '#fff' }}>{s.subject}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Class {s.classLevel}</span>
                          </div>
                          <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{s.name}</h4>
                          {s.description && (
                            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{s.description}</p>
                          )}
                          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>
                            {s.totalQuestions} questions · {s.durationMinutes} min
                          </p>
                          <button
                            className="btn btn-primary"
                            onClick={() => startSeries(s.id)}
                            disabled={state.loading}
                            style={{ marginTop: 'auto', width: '100%' }}
                          >
                            <Play className="h-4 w-4" /> Start series
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <TestGeneratorForm
                  onTestGenerated={handleTestGenerated}
                  onError={(error) => setState(prev => ({ ...prev, error }))}
                  loading={state.loading}
                  usage={usage}
                />
              </div>
            )}

            {state.currentView === 'active_test' && state.activeSession && (
              <ActiveTestInterface
                session={state.activeSession}
                onTestCompleted={handleTestCompleted}
                onError={(error) => setState(prev => ({ ...prev, error }))}
              />
            )}

            {state.currentView === 'results' && state.testResults && (
              <TestResultsView
                results={state.testResults}
                onBackToGenerator={handleBackToGenerator}
                onViewHistory={handleViewHistory}
              />
            )}

            {state.currentView === 'history' && (
              <TestHistoryView onBackToGenerator={handleBackToGenerator} />
            )}
          </div>
        )}

        {/* Quick stats footer */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          {[
            { icon: FileText, label: 'Question Bank', value: '50,000+', grad: GC },
            { icon: GraduationCap, label: 'Subjects', value: '15+', grad: GT },
            { icon: Clock, label: 'Avg. Test Time', value: '45 min', grad: GV },
            { icon: Award, label: 'Success Rate', value: '87%', grad: GW },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="card lift" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 13 }}>
                <span className="plinth" style={{ width: 46, height: 46, flex: 'none', background: s.grad }}>
                  <Icon className="h-[23px] w-[23px]" />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{s.value}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Test History — ported to the mock's history list.
function TestHistoryView({ onBackToGenerator }: { onBackToGenerator: () => void }) {
  const [history, setHistory] = useState<TestSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTestHistory()
  }, [])

  const loadTestHistory = async () => {
    try {
      const response = await fetch('/api/practest/history')
      const data = await response.json()
      if (data.success) {
        setHistory(data.sessions)
      }
    } catch (error) {
      console.error('Failed to load test history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="plinth spin" style={{ width: 56, height: 56, margin: '0 auto 16px', background: GP }}>
            <BarChart3 className="h-7 w-7" />
          </span>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Loading test history…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span className="plinth" style={{ width: 42, height: 42, background: GP }}>
          <BarChart3 className="h-[21px] w-[21px]" />
        </span>
        <div>
          <h3 className="sech" style={{ fontSize: 18 }}>Test History</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>Your previous attempts and performance</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <span className="plinth" style={{ width: 64, height: 64, margin: '0 auto 18px', background: GC }}>
            <FileText className="h-8 w-8" />
          </span>
          <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>No test history found</h4>
          <p style={{ color: 'var(--muted)', margin: '0 0 18px', fontSize: 14 }}>Start your learning journey by taking your first test</p>
          <button className="btn btn-primary" onClick={onBackToGenerator}>
            <Play className="h-5 w-5" /> Take your first test
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((session, index) => {
            const pct = Math.round(session.percentage)
            const badgeBg = pct >= 80 ? GT : pct >= 60 ? 'linear-gradient(135deg,var(--saffron),var(--turmeric))' : 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))'
            return (
              <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 15, borderRadius: 13, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: GC, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15 }}>
                    {index + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)' }}>
                      {session.custom_parameters?.subject} — Class {session.custom_parameters?.class_level}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock className="h-[14px] w-[14px]" />{new Date(session.created_at).toLocaleDateString()}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText className="h-[14px] w-[14px]" />{session.selected_questions.length} questions</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrendingUp className="h-[14px] w-[14px]" />{pct}% score</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tag" style={{ background: badgeBg, color: '#fff', fontSize: 13, padding: '5px 12px' }}>{pct}%</span>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{session.total_score}/{session.max_possible_score} marks</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
