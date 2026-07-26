/**
 * Enhanced Attention Tracking Hook
 * Comprehensive tracking for TEA-Ch² Focus Check assessments
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface GazePoint {
  x: number
  y: number
  timestamp: number
}

export interface ClickEvent {
  x: number
  y: number
  timestamp: number
  correct: boolean
  reactionTime?: number
}

export interface AttentionMetrics {
  totalClicks: number
  correctClicks: number
  incorrectClicks: number
  averageReactionTime: number
  clickAccuracy: number
  gazePoints: GazePoint[]
  distractionEvents: number
  idleTime: number
  responseVariability: number
  engagementScore: number
  focusLossEvents: number
  mouseMovements: number
  gazeStability: number
  totalTime: number
}

export const useAttentionTracker = () => {
  const gazeHistory = useRef<GazePoint[]>([])
  const clickHistory = useRef<ClickEvent[]>([])
  const [isIdle, setIsIdle] = useState(false)
  const [distractionCount, setDistractionCount] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [focusLossEvents, setFocusLossEvents] = useState(0)
  const [mouseMovements, setMouseMovements] = useState(0)
  
        // @ts-ignore
  const idleTimeoutRef = useRef<NodeJS.Timeout>()
  const startTimeRef = useRef<number>(Date.now())
  const lastActivityTime = useRef<number>(Date.now())

  /**
   * Track gaze/mouse movement with enhanced metrics
   */
  const trackGaze = useCallback((event: React.MouseEvent) => {
    if (!isTracking) return
    
    const now = Date.now()
    
    gazeHistory.current.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: now
    })
    
    // Keep only last 100 gaze points for performance
    if (gazeHistory.current.length > 100) {
      gazeHistory.current = gazeHistory.current.slice(-100)
    }
    
    setMouseMovements(prev => prev + 1)
    lastActivityTime.current = now
    
    // Reset idle timer
    setIsIdle(false)
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
    
    idleTimeoutRef.current = setTimeout(() => {
      setIsIdle(true)
      setDistractionCount(prev => prev + 1)
    }, 3000) // 3 seconds of no movement = idle/distracted
    
  }, [isTracking])

  /**
   * Track click events with reaction time
   */
  const trackClick = useCallback((event: React.MouseEvent, correct: boolean, reactionTime?: number) => {
    if (!isTracking) return
    
    const now = Date.now()
    
    clickHistory.current.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: now,
      correct,
      reactionTime
    })
    
    lastActivityTime.current = now
    setIsIdle(false)
  }, [isTracking])

  /**
   * Start tracking with initialization
   */
  const startTracking = useCallback(() => {
    setIsTracking(true)
    startTimeRef.current = Date.now()
    lastActivityTime.current = Date.now()
    
    // Reset all tracking data
    gazeHistory.current = []
    clickHistory.current = []
    setDistractionCount(0)
    setIsIdle(false)
    setFocusLossEvents(0)
    setMouseMovements(0)
    
    // Track focus loss events (when user leaves the window)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setFocusLossEvents(prev => prev + 1)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  /**
   * Stop tracking and cleanup
   */
  const stopTracking = useCallback(() => {
    setIsTracking(false)
    
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
  }, [])

  /**
   * Get comprehensive attention metrics
   */
  const getMetrics = useCallback((): AttentionMetrics => {
    const totalTime = Date.now() - startTimeRef.current
    const clicks = clickHistory.current
    const gaze = gazeHistory.current
    
    // Calculate click accuracy
    const accuracy = clicks.length > 0 
      ? clicks.filter(c => c.correct).length / clicks.length 
      : 0
    
    // Calculate average reaction time for correct responses
    const correctClicks = clicks.filter(c => c.correct && c.reactionTime)
    const averageReactionTime = correctClicks.length > 0
      ? correctClicks.reduce((sum, click) => sum + (click.reactionTime || 0), 0) / correctClicks.length
      : 0
    
    // Calculate gaze variability (attention stability)
    const gazeVariability = gaze.length > 1
      ? Math.sqrt(
          gaze.slice(1).reduce((sum, point, i) => {
            const dx = point.x - gaze[i].x
            const dy = point.y - gaze[i].y
            return sum + (dx * dx + dy * dy)
          }, 0) / (gaze.length - 1)
        )
      : 0
    
    // Calculate response variability
    const reactionTimes = correctClicks.map(c => c.reactionTime || 0)
    const rtMean = averageReactionTime
    const rtVariance = reactionTimes.length > 1
      ? reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - rtMean, 2), 0) / reactionTimes.length
      : 0
    const responseVariability = rtMean > 0 ? Math.sqrt(rtVariance) / rtMean : 0
    
    // Calculate engagement score
    const engagementScore = calculateEngagementScore(totalTime, accuracy, gazeVariability)
    
    return {
      totalClicks: clicks.length,
      correctClicks: clicks.filter(c => c.correct).length,
      incorrectClicks: clicks.filter(c => !c.correct).length,
      clickAccuracy: accuracy * 100,
      averageReactionTime,
      gazePoints: gaze,
      distractionEvents: distractionCount,
      idleTime: isIdle ? 3000 : 0, // Simplified idle time
      responseVariability,
      engagementScore,
      focusLossEvents,
      mouseMovements,
      gazeStability: gazeVariability < 50 ? 1 : 0.5,
      totalTime: totalTime / 1000 // Convert to seconds
    }
  }, [distractionCount, isIdle, focusLossEvents, mouseMovements])

  /**
   * Calculate engagement score based on multiple factors
   */
  const calculateEngagementScore = (totalTime: number, accuracy: number, gazeVariability: number): number => {
    let score = 100
    
    // Deduct for low accuracy
    if (accuracy < 0.7) {
      score -= (0.7 - accuracy) * 50
    }
    
    // Deduct for high gaze variability (poor attention stability)
    if (gazeVariability > 100) {
      score -= Math.min((gazeVariability - 100) / 10, 20)
    }
    
    // Deduct for distractions
    score -= Math.min(distractionCount * 5, 25)
    
    // Deduct for focus loss events
    score -= Math.min(focusLossEvents * 10, 20)
    
    // Bonus for consistent mouse movement (indicates engagement)
    const movementRate = mouseMovements / (totalTime / 1000)
    if (movementRate > 0.5 && movementRate < 5) {
      score += 5
    }
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Reset all tracking data
   */
  const resetTracking = useCallback(() => {
    gazeHistory.current = []
    clickHistory.current = []
    setDistractionCount(0)
    setIsIdle(false)
    setFocusLossEvents(0)
    setMouseMovements(0)
    startTimeRef.current = Date.now()
    lastActivityTime.current = Date.now()
    
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
      }
    }
  }, [])

  return {
    trackGaze,
    trackClick,
    getMetrics,
    resetTracking,
    startTracking,
    stopTracking,
    isIdle,
    isTracking
  }
}
