/**
 * Engagement Tracker Hook
 * Tracks user engagement during study sessions
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface EngagementMetrics {
  activeTime: number // in milliseconds
  idleTime: number // in milliseconds
  interactions: number
  focusEvents: number
  lastActivity: number
  sessionStartTime: number
}

export interface EngagementData {
  sessionId: string
  metrics: EngagementMetrics
  engagementScore: number
}

export function useEngagementTracker() {
  const [metrics, setMetrics] = useState<EngagementMetrics>({
    activeTime: 0,
    idleTime: 0,
    interactions: 0,
    focusEvents: 0,
    lastActivity: Date.now(),
    sessionStartTime: Date.now()
  })

  const [isIdle, setIsIdle] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  
  const idleTimerRef = useRef<NodeJS.Timeout>()
  const updateIntervalRef = useRef<NodeJS.Timeout>()
  const lastUpdateRef = useRef(Date.now())
  
  const IDLE_THRESHOLD = 30000 // 30 seconds
  const UPDATE_INTERVAL = 1000 // 1 second

  /**
   * Update activity and reset idle timer
   */
  const updateActivity = useCallback(() => {
    if (!isTracking) return

    const now = Date.now()
    const timeDiff = now - lastUpdateRef.current
    
    setMetrics(prev => ({
      ...prev,
      activeTime: prev.activeTime + (isIdle ? 0 : timeDiff),
      idleTime: prev.idleTime + (isIdle ? timeDiff : 0),
      interactions: prev.interactions + 1,
      lastActivity: now
    }))
    
    lastUpdateRef.current = now
    setIsIdle(false)

    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true)
    }, IDLE_THRESHOLD)
  }, [isTracking, isIdle])

  /**
   * Handle window focus events
   */
  const handleFocus = useCallback(() => {
    if (!isTracking) return

    setMetrics(prev => ({
      ...prev,
      focusEvents: prev.focusEvents + 1
    }))
    updateActivity()
  }, [updateActivity, isTracking])

  /**
   * Handle window blur events
   */
  const handleBlur = useCallback(() => {
    if (!isTracking) return
    
    const now = Date.now()
    const timeDiff = now - lastUpdateRef.current
    
    setMetrics(prev => ({
      ...prev,
      activeTime: prev.activeTime + timeDiff
    }))
    
    lastUpdateRef.current = now
    setIsIdle(true)
  }, [isTracking])

  /**
   * Update metrics periodically
   */
  const updateMetricsPeriodically = useCallback(() => {
    if (!isTracking) return

    const now = Date.now()
    const timeDiff = now - lastUpdateRef.current
    
    setMetrics(prev => ({
      ...prev,
      activeTime: prev.activeTime + (isIdle ? 0 : timeDiff),
      idleTime: prev.idleTime + (isIdle ? timeDiff : 0)
    }))
    
    lastUpdateRef.current = now
  }, [isTracking, isIdle])

  /**
   * Start tracking engagement
   */
  const startTracking = useCallback(() => {
    const now = Date.now()
    setIsTracking(true)
    setIsIdle(false)
    lastUpdateRef.current = now
    
    setMetrics({
      activeTime: 0,
      idleTime: 0,
      interactions: 0,
      focusEvents: 0,
      lastActivity: now,
      sessionStartTime: now
    })

    // Start periodic updates
    updateIntervalRef.current = setInterval(updateMetricsPeriodically, UPDATE_INTERVAL)
    
    // Start idle timer
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true)
    }, IDLE_THRESHOLD)
  }, [updateMetricsPeriodically])

  /**
   * Stop tracking engagement
   */
  const stopTracking = useCallback(() => {
    setIsTracking(false)
    
    // Clear timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
    }
    
    // Final update
    updateMetricsPeriodically()
  }, [updateMetricsPeriodically])

  /**
   * Reset metrics
   */
  const resetMetrics = useCallback(() => {
    const now = Date.now()
    setMetrics({
      activeTime: 0,
      idleTime: 0,
      interactions: 0,
      focusEvents: 0,
      lastActivity: now,
      sessionStartTime: now
    })
    setIsIdle(false)
    lastUpdateRef.current = now
  }, [])

  /**
   * Calculate engagement score
   */
  const calculateEngagementScore = useCallback((metricsData: EngagementMetrics): number => {
    const totalTime = metricsData.activeTime + metricsData.idleTime
    if (totalTime === 0)
  return 0

    const activeRatio = metricsData.activeTime / totalTime
    const interactionDensity = totalTime > 0 ? metricsData.interactions / (totalTime / 60000) : 0 // interactions per minute
    const focusDensity = totalTime > 0 ? metricsData.focusEvents / (totalTime / 60000) : 0 // focus events per minute

    // Weighted scoring
    const activeScore = activeRatio * 70 // 70% weight for active time
    const interactionScore = Math.min(interactionDensity * 2, 20) // 20% weight for interactions (capped)
    const focusScore = Math.min(focusDensity * 5, 10) // 10% weight for focus events (capped)

    return Math.min(100, Math.max(0, activeScore + interactionScore + focusScore))
  }, [])

  /**
   * Get current engagement score
   */
  const getCurrentEngagementScore = useCallback((): number => {
    return calculateEngagementScore(metrics)
  }, [metrics, calculateEngagementScore])

  /**
   * Save metrics to server
   */
  const saveMetrics = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const engagementScore = calculateEngagementScore(metrics)
      
      const response = await fetch('/api/curricutimer/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          metrics: {
            activeTime: Math.round(metrics.activeTime / 1000), // Convert to seconds
            idleTime: Math.round(metrics.idleTime / 1000),
            interactions: metrics.interactions,
            focusEvents: metrics.focusEvents
          },
          engagementScore
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save engagement metrics')
      }

      return true
    } catch (error) {
      console.error('Error saving engagement metrics:', error)
      return false
    }
  }, [metrics, calculateEngagementScore])

  /**
   * Get engagement summary
   */
  const getEngagementSummary = useCallback(() => {
    const totalTime = metrics.activeTime + metrics.idleTime
    const activePercentage = totalTime > 0 ? (metrics.activeTime / totalTime) * 100 : 0
    const engagementScore = getCurrentEngagementScore()
    
    return {
      totalTime: Math.round(totalTime / 1000), // in seconds
      activeTime: Math.round(metrics.activeTime / 1000),
      idleTime: Math.round(metrics.idleTime / 1000),
      activePercentage: Math.round(activePercentage),
      interactions: metrics.interactions,
      focusEvents: metrics.focusEvents,
      engagementScore: Math.round(engagementScore),
      status: engagementScore >= 80 ? 'excellent' : 
              engagementScore >= 60 ? 'good' : 
              engagementScore >= 40 ? 'fair' : 'poor'
    }
  }, [metrics, getCurrentEngagementScore])

  // Set up event listeners
  useEffect(() => {
    if (!isTracking) return

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [updateActivity, handleFocus, handleBlur, isTracking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  return {
    metrics,
    isIdle,
    isTracking,
    startTracking,
    stopTracking,
    resetMetrics,
    saveMetrics,
    getCurrentEngagementScore,
    getEngagementSummary,
    calculateEngagementScore
  }
}
