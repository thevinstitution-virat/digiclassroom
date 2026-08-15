/**
 * CurricuTimer - Comprehensive Adaptive Pomodoro with Curriculum Integration
 * Grade-specific timing with CBSE/ICSE syllabus awareness and engagement tracking
 */

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Progress } from '@/components/core/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/ui/select'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ClockIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  TrophyIcon,
  FireIcon,
  BellIcon,
  ChartBarIcon,
  LightBulbIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import { useEngagementTracker } from '@/hooks/useEngagementTracker'
import { AdaptiveScheduler } from '@/lib/utils/adaptiveScheduler'

interface TimerSession {
  id: string
  subject: string
  topic: string
  duration: number
  breakDuration: number
  grade: number
  board: string
  priority: 'high' | 'medium' | 'low'
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedCompletion: Date
  recommendations: string[]
  nextTopics: any[]
  chapter: any
}

interface TimerStats {
  sessionsCompleted: number
  totalFocusTime: number
  currentStreak: number
  todaysSessions: number
  averageEngagement: number
  completionRate: number
}

interface CurricuTimerProps {
  userId?: string
  initialGrade?: number
  initialBoard?: string
  initialSubject?: string
  initialTopic?: string
}

export default function CurricuTimer({
  userId = 'demo_user',
  initialGrade = 10,
  initialBoard = 'CBSE',
  initialSubject = 'mathematics',
  initialTopic = ''
}: CurricuTimerProps) {
  // Core timer state
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Configuration state
  const [selectedGrade, setSelectedGrade] = useState(initialGrade.toString())
  const [selectedSubject, setSelectedSubject] = useState(initialSubject)
  const [selectedBoard, setSelectedBoard] = useState(initialBoard)
  const [currentTopic, setCurrentTopic] = useState(initialTopic)

  // Session and schedule state
  const [currentSession, setCurrentSession] = useState<TimerSession | null>(null)
  const [schedule, setSchedule] = useState<any>(null)
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)

  // Statistics and performance
  const [stats, setStats] = useState<TimerStats>({
    sessionsCompleted: 0,
    totalFocusTime: 0,
    currentStreak: 0,
    todaysSessions: 0,
    averageEngagement: 0,
    completionRate: 0
  })

  // UI state
  const [showEngagementDetails, setShowEngagementDetails] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Engagement tracking
  const {
    metrics,
    isIdle,
    isTracking,
    startTracking,
    stopTracking,
    saveMetrics,
    getCurrentEngagementScore,
    getEngagementSummary
  } = useEngagementTracker()

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load initial schedule
  useEffect(() => {
    loadSchedule()
  }, [selectedGrade, selectedBoard, selectedSubject, currentTopic])

  // Load user stats
  useEffect(() => {
    loadUserStats()
  }, [userId])

  // Timer countdown logic
  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSessionComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, isPaused, timeLeft])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === 'granted')
      })
    } else {
      setNotificationsEnabled(Notification.permission === 'granted')
    }
  }, [])

  /**
   * Load schedule from API
   */
  const loadSchedule = useCallback(async () => {
    setIsLoadingSchedule(true)
    try {
      const response = await fetch('/api/curricutimer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          grade: parseInt(selectedGrade),
          board: selectedBoard,
          subject: selectedSubject,
          currentTopic: currentTopic || undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        setSchedule(data.schedule)
        setTimeLeft(data.schedule.sessionDuration * 60)

        // Set current topic if not already set
        if (!currentTopic && data.schedule.topic) {
          setCurrentTopic(data.schedule.topic)
        }
      } else {
        console.error('Failed to load schedule:', data.error)
      }
    } catch (error) {
      console.error('Error loading schedule:', error)
    } finally {
      setIsLoadingSchedule(false)
    }
  }, [userId, selectedGrade, selectedBoard, selectedSubject, currentTopic])

  /**
   * Load user statistics
   */
  const loadUserStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/curricutimer/sessions?userId=${userId}&limit=20`)
      const data = await response.json()

      if (data.success) {
        setStats({
          sessionsCompleted: data.stats.completedSessions,
          totalFocusTime: data.stats.totalStudyTime,
          currentStreak: calculateStreak(data.sessions),
          todaysSessions: getTodaySessions(data.sessions),
          averageEngagement: Math.round(data.stats.averageEngagement),
          completionRate: data.stats.completedSessions / Math.max(1, data.stats.totalSessions)
        })
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }, [userId])

  /**
   * Calculate current streak from sessions
   */
  const calculateStreak = (sessions: any[]): number => {
    if (!sessions.length)
  return 0

    let streak = 0
    const today = new Date()

    for (const session of sessions) {
      const sessionDate = new Date(session.createdAt)
      const daysDiff = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysDiff === streak && session.completed) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  /**
   * Get today's session count
   */
  const getTodaySessions = (sessions: any[]): number => {
    const today = new Date().toDateString()
    return sessions.filter(session =>
      new Date(session.createdAt).toDateString() === today
    ).length
  }

  /**
   * Start a new study session
   */
  const startSession = useCallback(async () => {
    if (!schedule) {
      console.error('No schedule available')
      return
    }

    try {
      // Create session in database
      const response = await fetch('/api/curricutimer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          topic: currentTopic || schedule.topic,
          subject: selectedSubject,
          grade: parseInt(selectedGrade),
          board: selectedBoard,
          duration: schedule.sessionDuration,
          startTime: new Date().toISOString()
        })
      })

      const data = await response.json()
      if (data.success) {
        setSessionId(data.sessionId)
        setCurrentSession({
          id: data.sessionId,
          subject: selectedSubject,
          topic: currentTopic || schedule.topic,
          duration: schedule.sessionDuration,
          breakDuration: schedule.breakDuration,
          grade: parseInt(selectedGrade),
          board: selectedBoard,
          priority: schedule.priority,
          difficulty: schedule.difficulty || 'medium',
          estimatedCompletion: schedule.estimatedCompletion,
          recommendations: schedule.recommendations,
          nextTopics: schedule.nextTopics,
          chapter: schedule.chapter
        })

        setIsRunning(true)
        setIsPaused(false)
        startTracking()

        // Show start notification
        showNotification('🎯 Study Session Started!',
          `Focusing on ${currentTopic || schedule.topic} for ${schedule.sessionDuration} minutes`)
      }
    } catch (error) {
      console.error('Error starting session:', error)
    }
  }, [schedule, userId, currentTopic, selectedSubject, selectedGrade, selectedBoard, startTracking])

  /**
   * Pause the current session
   */
  const pauseSession = useCallback(() => {
    setIsPaused(true)
    showNotification('⏸️ Session Paused', 'Take a moment to recharge')
  }, [])

  /**
   * Resume the paused session
   */
  const resumeSession = useCallback(() => {
    setIsPaused(false)
    showNotification('▶️ Session Resumed', 'Back to focused learning!')
  }, [])

  /**
   * Stop the current session
   */
  const stopSession = useCallback(async () => {
    if (sessionId && isTracking) {
      await saveMetrics(sessionId)
      stopTracking()
    }

    setIsRunning(false)
    setIsPaused(false)
    setCurrentSession(null)
    setSessionId(null)

    if (schedule) {
      setTimeLeft(schedule.sessionDuration * 60)
    }

    showNotification('🛑 Session Stopped', 'Session ended early')
    await loadUserStats()
  }, [sessionId, isTracking, saveMetrics, stopTracking, schedule, loadUserStats])

  /**
   * Handle session completion
   */
  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false)
    setIsPaused(false)

    if (sessionId && isTracking) {
      // Save engagement metrics
      const saved = await saveMetrics(sessionId)
      stopTracking()

      if (saved) {
        // Update session as completed
        await fetch('/api/curricutimer/sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            updates: {
              completed: true,
              endTime: new Date().toISOString(),
              engagementScore: getCurrentEngagementScore()
            }
          })
        })
      }
    }

    // Get engagement summary for adaptive scheduling
    const summary = getEngagementSummary()

    // Calculate next session duration using adaptive scheduler
    if (schedule && summary.engagementScore > 0) {
      const adjustment = AdaptiveScheduler.adjustSessionDuration(
        schedule.sessionDuration,
        summary.engagementScore,
        parseInt(selectedGrade)
      )

      // Update schedule with new duration
      setSchedule(prev => prev ? {
        ...prev,
        sessionDuration: adjustment.newDuration,
        adaptiveReason: adjustment.reason
      } : null)
    }

    // Show completion notification
    showNotification('🎉 Session Complete!',
      `Great job! You studied ${currentTopic || schedule?.topic} for ${schedule?.sessionDuration} minutes. ` +
      `Take a ${schedule?.breakDuration || 5}-minute break.`)

    // Schedule break reminder
    if (schedule?.breakDuration) {
      notificationTimeoutRef.current = setTimeout(() => {
        showNotification('⏰ Break Time Over!', 'Ready for your next study session?')
      }, schedule.breakDuration * 60 * 1000)
    }

    // Reset for next session
    setCurrentSession(null)
    setSessionId(null)
    await loadUserStats()

    // Reload schedule for next session
    setTimeout(() => {
      loadSchedule()
    }, 1000)
  }, [sessionId, isTracking, saveMetrics, stopTracking, getCurrentEngagementScore,
      getEngagementSummary, schedule, selectedGrade, currentTopic, loadUserStats, loadSchedule])

  /**
   * Show notification if permissions granted
   */
  const showNotification = useCallback((title: string, body: string) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      })
    }
  }, [notificationsEnabled])

  /**
   * Format time display
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Get days until exam
   */
  const getDaysUntilExam = (examDate: string): number => {
    const today = new Date()
    const exam = new Date(examDate)
    const diffTime = exam.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Get progress percentage
   */
  const getProgress = (): number => {
    if (!schedule)
  return 0
    return ((schedule.sessionDuration * 60 - timeLeft) / (schedule.sessionDuration * 60)) * 100
  }

  /**
   * Get engagement status
   */
  const getEngagementStatus = () => {
    const score = getCurrentEngagementScore()
    if (score >= 80)
  return { level: 'excellent', color: 'text-green-600', icon: '🔥' }
    if (score >= 60)
  return { level: 'good', color: 'text-blue-600', icon: '👍' }
    if (score >= 40)
  return { level: 'fair', color: 'text-yellow-600', icon: '⚡' }
    return { level: 'needs focus', color: 'text-red-600', icon: '⚠️' }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [])

  if (isLoadingSchedule) {
    return (
      <div className="space-y-6">
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <ClockIcon className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Loading Your Personalized Schedule...</h3>
              <p className="text-muted-foreground">
                Analyzing {selectedBoard} Grade {selectedGrade} {selectedSubject} curriculum
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <ClockIcon className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <h3 className="text-lg font-semibold mb-2 text-red-800 dark:text-red-200">
                Unable to Load Schedule
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-4">
                There was an issue loading your study schedule. Please try again.
              </p>
              <Button onClick={loadSchedule} variant="outline">
                Retry Loading Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const engagementStatus = getEngagementStatus()
  const progress = getProgress()

  return (
    <div className="space-y-6">
      {/* Timer Header */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
            <ClockIcon className="h-6 w-6" />
            <span>CurricuTimer - Comprehensive Study Timer</span>
          </CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            🇮🇳 AI-powered adaptive sessions with {selectedBoard} Grade {selectedGrade} curriculum integration
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Configuration</CardTitle>
            <CardDescription>Customize your study session settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Board</label>
                <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CBSE">CBSE</SelectItem>
                    <SelectItem value="ICSE">ICSE</SelectItem>
                    <SelectItem value="STATE_BOARD">State Board</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Grade Level</label>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">Class 9</SelectItem>
                    <SelectItem value="10">Class 10</SelectItem>
                    <SelectItem value="11">Class 11</SelectItem>
                    <SelectItem value="12">Class 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Subject</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mathematics">Mathematics</SelectItem>
                  <SelectItem value="physics">Physics</SelectItem>
                  <SelectItem value="chemistry">Chemistry</SelectItem>
                  <SelectItem value="biology">Biology</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="social_science">Social Science</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                variant="outline"
                className="flex-1"
              >
                <BellIcon className="h-4 w-4 mr-2" />
                {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
              </Button>

              <Button
                onClick={() => setShowEngagementDetails(!showEngagementDetails)}
                variant="outline"
                size="icon"
              >
                {showEngagementDetails ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Schedule & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LightBulbIcon className="h-5 w-5 text-yellow-600" />
              <span>Smart Recommendations</span>
            </CardTitle>
            <CardDescription>AI-powered suggestions based on your curriculum</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{schedule.topic}</h3>
                <Badge variant={schedule.priority === 'high' ? 'destructive' : schedule.priority === 'medium' ? 'default' : 'secondary'}>
                  {schedule.priority} priority
                </Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                <strong>Chapter:</strong> {schedule.chapter?.title}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Session Plan:</div>
                <div className="text-sm space-y-1">
                  <div>⏱️ Duration: {schedule.sessionDuration} minutes</div>
                  <div>☕ Break: {schedule.breakDuration} minutes</div>
                  <div>📚 Difficulty: {schedule.difficulty}</div>
                </div>
              </div>

              {schedule.recommendations && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recommendations:</div>
                  <ul className="text-sm space-y-1">
                    {schedule.recommendations.slice(0, 3).map((rec: string, index: number) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-blue-600">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {schedule.nextTopics && schedule.nextTopics.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Coming Next:</div>
                  <div className="flex flex-wrap gap-2">
                    {schedule.nextTopics.slice(0, 3).map((topic: any, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {topic.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Timer Display */}
      <Card className="text-center">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Current Session Info */}
            {currentSession && (
              <div className="space-y-3">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {currentSession.topic}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {currentSession.subject} • Grade {currentSession.grade} • {currentSession.board}
                </div>
                <div className="flex justify-center space-x-4 text-sm">
                  <span className="flex items-center space-x-1">
                    <ClockIcon className="h-4 w-4" />
                    <span>{currentSession.duration} min</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Badge variant={currentSession.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                      {currentSession.priority}
                    </Badge>
                  </span>
                </div>
              </div>
            )}

            {/* Timer Circle */}
            <div className="relative flex items-center justify-center">
              <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-200 dark:text-foreground"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 90}`}
                  strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                  className={`transition-all duration-1000 ${
                    isIdle ? 'text-yellow-500' :
                    isRunning ? 'text-green-500' : 'text-blue-500'
                  }`}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-mono font-bold text-foreground">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {isPaused ? 'Paused' :
                   isRunning ? (isIdle ? 'Idle' : 'Active') :
                   'Ready'}
                </div>
                {isRunning && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {Math.round(progress)}% complete
                  </div>
                )}
              </div>
            </div>

            {/* Engagement Status */}
            {isRunning && showEngagementDetails && (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-sm font-medium">Focus Level:</span>
                  <span className={`text-sm font-bold ${engagementStatus.color}`}>
                    {engagementStatus.icon} {engagementStatus.level}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Score: {getCurrentEngagementScore()}/100
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center space-x-4">
              {!isRunning ? (
                <Button
                  onClick={startSession}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  disabled={!schedule}
                >
                  <PlayIcon className="h-5 w-5 mr-2" />
                  Start Session
                </Button>
              ) : (
                <>
                  <Button onClick={pauseSession} size="lg" variant="outline">
                    {isPaused ? <PlayIcon className="h-5 w-5 mr-2" /> : <PauseIcon className="h-5 w-5 mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button onClick={stopSession} size="lg" variant="destructive">
                    <StopIcon className="h-5 w-5 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            {/* Session Info */}
            {schedule && !isRunning && (
              <div className="text-sm text-muted-foreground">
                Next session: {schedule.sessionDuration} minutes on {schedule.topic}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <TrophyIcon className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">{stats.sessionsCompleted}</div>
            <div className="text-sm text-muted-foreground">Sessions Completed</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <ClockIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{Math.round(stats.totalFocusTime / 60)}</div>
            <div className="text-sm text-muted-foreground">Total Hours</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <FireIcon className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold">{stats.currentStreak}</div>
            <div className="text-sm text-muted-foreground">Current Streak</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <ChartBarIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{stats.averageEngagement}%</div>
            <div className="text-sm text-muted-foreground">Avg Engagement</div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Details */}
      {showEngagementDetails && isTracking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ChartBarIcon className="h-5 w-5" />
              <span>Live Engagement Metrics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {Math.round(metrics.activeTime / 1000)}s
                </div>
                <div className="text-sm text-muted-foreground">Active Time</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-yellow-600">
                  {Math.round(metrics.idleTime / 1000)}s
                </div>
                <div className="text-sm text-muted-foreground">Idle Time</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {metrics.interactions}
                </div>
                <div className="text-sm text-muted-foreground">Interactions</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {metrics.focusEvents}
                </div>
                <div className="text-sm text-muted-foreground">Focus Events</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Engagement Score</span>
                <span>{getCurrentEngagementScore()}/100</span>
              </div>
              <Progress value={getCurrentEngagementScore()} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adaptive Insights */}
      {schedule?.adaptiveReason && (
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <LightBulbIcon className="h-6 w-6 text-purple-600 mt-1" />
              <div>
                <h4 className="font-semibold text-purple-800 dark:text-purple-200">
                  Adaptive Adjustment
                </h4>
                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                  {schedule.adaptiveReason}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
