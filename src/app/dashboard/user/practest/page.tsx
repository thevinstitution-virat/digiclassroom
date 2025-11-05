'use client'

// VG Kosh Practest Engine - User Test Interface

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Clock,
  FileText,
  GraduationCap,
  BarChart3,
  Play,
  CheckCircle,
  AlertTriangle,
  Target,
  Brain,
  TrendingUp,
  Sparkles,
  Crown,
  Zap,
  Award
} from 'lucide-react'
import { Board, GenerateTestRequest, TestSession } from '@/types/practest'
import TestGeneratorForm from '@/components/practest/TestGeneratorForm'
import ActiveTestInterface from '@/components/practest/ActiveTestInterface'
import TestResultsView from '@/components/practest/TestResultsView'

type ViewState = 'generator' | 'active_test' | 'results' | 'history'

interface PractestPageState {
  currentView: ViewState
  activeSession: TestSession | null
  testResults: any | null
  loading: boolean
  error: string | null
}

export default function PractestPage() {
  const { user, isLoaded } = useUser()
  const [state, setState] = useState<PractestPageState>({
    currentView: 'generator',
    activeSession: null,
    testResults: null,
    loading: false,
    error: null
  })

  // Check for active sessions on component mount
  useEffect(() => {
    if (isLoaded && user) {
      checkActiveSession()
    }
  }, [isLoaded, user])

  const checkActiveSession = async () => {
    try {
      const response = await fetch('/api/practest/generate')
      const data = await response.json()
      
      if (data.success && data.active_sessions > 0) {
        // User has active session, redirect to test interface
        setState(prev => ({
          ...prev,
          currentView: 'active_test',
          activeSession: data.sessions[0] // Get first active session
        }))
      }
    } catch (error) {
      console.error('Failed to check active session:', error)
    }
  }

  const handleTestGenerated = (session: TestSession) => {
    setState(prev => ({
      ...prev,
      currentView: 'active_test',
      activeSession: session,
      error: null
    }))
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 flex items-center justify-center animate-pulse shadow-lg">
            <Target className="h-10 w-10 text-white" />
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading Practest Engine...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
        <Card className="w-96 bg-white/90 backdrop-blur-md border-0 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Target className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Authentication Required
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 mt-2">
              Please sign in to access the AI-powered Practest engine.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Enhanced Header */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                AI-Powered Assessment Engine
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-4">
                <Target className="h-12 w-12 text-orange-500" />
                e-Learning Practest
              </span>
            </h1>

            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Comprehensive assessment system with adaptive testing, intelligent question generation, and detailed analytics
            </p>
          </div>

          {/* Enhanced Navigation */}
          <div className="flex justify-center gap-4">
            <Button
              variant={state.currentView === 'generator' ? 'default' : 'outline'}
              onClick={handleBackToGenerator}
              disabled={state.currentView === 'active_test'}
              className={`px-8 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 ${
                state.currentView === 'generator'
                  ? 'bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white'
                  : 'border-orange-200 hover:border-orange-400 hover:bg-orange-50 text-orange-600'
              }`}
            >
              <Play className="h-5 w-5 mr-2" />
              New Test
            </Button>
            <Button
              variant={state.currentView === 'history' ? 'default' : 'outline'}
              onClick={handleViewHistory}
              disabled={state.currentView === 'active_test'}
              className={`px-8 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 ${
                state.currentView === 'history'
                  ? 'bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white'
                  : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600'
              }`}
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              History
            </Button>
          </div>
        </div>

        {/* Enhanced Error Alert */}
        {state.error && (
          <div className="mb-8">
            <Alert className="bg-red-50/90 backdrop-blur-md border-red-200/50 rounded-2xl shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <AlertDescription className="text-red-800 font-medium">
                  {state.error}
                </AlertDescription>
              </div>
            </Alert>
          </div>
        )}

        {/* Enhanced Main Content */}
        <div className="space-y-8">
          {state.currentView === 'generator' && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
              <TestGeneratorForm
                onTestGenerated={handleTestGenerated}
                onError={(error) => setState(prev => ({ ...prev, error }))}
                loading={state.loading}
              />
            </div>
          )}

          {state.currentView === 'active_test' && state.activeSession && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
              <ActiveTestInterface
                session={state.activeSession}
                onTestCompleted={handleTestCompleted}
                onError={(error) => setState(prev => ({ ...prev, error }))}
              />
            </div>
          )}

          {state.currentView === 'results' && state.testResults && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
              <TestResultsView
                results={state.testResults}
                onBackToGenerator={handleBackToGenerator}
                onViewHistory={handleViewHistory}
              />
            </div>
          )}

          {state.currentView === 'history' && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
              <TestHistoryView
                onBackToGenerator={handleBackToGenerator}
              />
            </div>
          )}
        </div>

        {/* Enhanced Quick Stats Footer */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Question Bank</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">50,000+</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-green-500/25 transition-all duration-300">
                  <GraduationCap className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Subjects</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">15+</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300">
                  <Clock className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Avg. Test Time</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">45 min</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-orange-500/25 transition-all duration-300">
                  <Award className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Success Rate</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">87%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Enhanced Test History Component
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
      <Card className="bg-white/90 backdrop-blur-md border-0 shadow-lg rounded-2xl">
        <CardContent className="p-12">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 flex items-center justify-center animate-pulse">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto mb-4"></div>
              <span className="text-gray-600 dark:text-gray-400 font-medium">Loading test history...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-500/10 to-blue-500/10 border-b border-orange-200/30">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                Test History
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Your previous test attempts and performance analytics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                <FileText className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No test history found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Start your learning journey by taking your first test</p>
              <Button
                onClick={onBackToGenerator}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Play className="h-5 w-5 mr-2" />
                Take Your First Test
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((session, index) => (
                <div key={session.id} className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {session.custom_parameters?.subject} - Class {session.custom_parameters?.class_level}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-4">
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {new Date(session.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <FileText className="h-4 w-4 mr-1" />
                            {session.selected_questions.length} questions
                          </span>
                          <span className="flex items-center">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            {Math.round(session.percentage)}% score
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={`px-4 py-2 rounded-xl font-bold text-sm ${
                          session.percentage >= 80
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                            : session.percentage >= 60
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                            : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                        }`}
                      >
                        {Math.round(session.percentage)}%
                      </Badge>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">
                        {session.total_score}/{session.max_possible_score} marks
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
