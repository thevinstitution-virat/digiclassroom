// Performance Monitoring Initialization
// This module sets up comprehensive performance monitoring for the application

import { recordStartupPhase, markStartupComplete, browserStartupMonitor } from './startup-monitor'
import { performanceMonitor } from '../ai/optimization/performance-monitor'

// Server-side initialization
export function initializeServerMonitoring(): void {
  recordStartupPhase('server_monitoring_init', {
    environment: process.env.NODE_ENV,
    platform: process.platform,
    nodeVersion: process.version
  })

  // Set up process event listeners for monitoring
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    performanceMonitor.recordMetrics({
      responseTime: 0,
      tier: 'FAST' as any,
      model: 'GPT_3_5_TURBO' as any,
      cacheHit: false,
      success: false,
      errorType: 'uncaught_exception',
      timestamp: Date.now(),
      query: 'system_error'
    })
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    performanceMonitor.recordMetrics({
      responseTime: 0,
      tier: 'FAST' as any,
      model: 'GPT_3_5_TURBO' as any,
      cacheHit: false,
      success: false,
      errorType: 'unhandled_rejection',
      timestamp: Date.now(),
      query: 'system_error'
    })
  })

  // Monitor memory usage periodically
  setInterval(() => {
    const memoryUsage = process.memoryUsage()
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024

    // Alert if memory usage is high
    if (heapUsedMB > 500) { // 500MB threshold
      console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`)
    }
  }, 30000) // Check every 30 seconds

  recordStartupPhase('server_monitoring_complete')
}

// Client-side initialization
export function initializeBrowserMonitoring(): void {
  if (typeof window === 'undefined') return

  browserStartupMonitor?.recordPhase('browser_monitoring_init', {
    userAgent: navigator.userAgent,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine
  })

  // Monitor page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      browserStartupMonitor?.recordPhase('page_hidden')
    } else {
      browserStartupMonitor?.recordPhase('page_visible')
    }
  })

  // Monitor page load events
  window.addEventListener('load', () => {
    browserStartupMonitor?.recordPhase('page_load_complete')
    
    // Measure Web Vitals
    measureWebVitals()
  })

  // Monitor errors
  window.addEventListener('error', (event) => {
    console.error('JavaScript Error:', event.error)
    browserStartupMonitor?.recordPhase('javascript_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason)
    browserStartupMonitor?.recordPhase('promise_rejection', {
      reason: event.reason?.toString()
    })
  })

  browserStartupMonitor?.recordPhase('browser_monitoring_complete')
}

// Measure Web Vitals (Core Web Vitals)
function measureWebVitals(): void {
  if (typeof window === 'undefined') return

  // Largest Contentful Paint (LCP)
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    const lastEntry = entries[entries.length - 1]
    
    console.log('LCP:', lastEntry.startTime)
    browserStartupMonitor?.recordPhase('lcp_measured', {
      value: lastEntry.startTime,
      metric: 'largest-contentful-paint'
    })
  })

  try {
    observer.observe({ entryTypes: ['largest-contentful-paint'] })
  } catch (error) {
    console.log('LCP measurement not supported')
  }

  // First Input Delay (FID) - measured when user first interacts
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry) => {
      console.log('FID:', entry.processingStart - entry.startTime)
      browserStartupMonitor?.recordPhase('fid_measured', {
        value: entry.processingStart - entry.startTime,
        metric: 'first-input-delay'
      })
    })
  })

  try {
    fidObserver.observe({ entryTypes: ['first-input'] })
  } catch (error) {
    console.log('FID measurement not supported')
  }

  // Cumulative Layout Shift (CLS)
  let clsValue = 0
  const clsObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value
      }
    })
    
    console.log('CLS:', clsValue)
    browserStartupMonitor?.recordPhase('cls_measured', {
      value: clsValue,
      metric: 'cumulative-layout-shift'
    })
  })

  try {
    clsObserver.observe({ entryTypes: ['layout-shift'] })
  } catch (error) {
    console.log('CLS measurement not supported')
  }
}

// API Response Time Monitoring
export function monitorAPICall(
  endpoint: string,
  startTime: number,
  endTime: number,
  success: boolean,
  errorType?: string
): void {
  const responseTime = endTime - startTime

  performanceMonitor.recordMetrics({
    responseTime,
    tier: 'FAST' as any, // Default tier
    model: 'API_CALL' as any,
    cacheHit: false,
    success,
    errorType,
    timestamp: Date.now(),
    query: endpoint
  })

  // Log slow API calls
  if (responseTime > 2000) {
    console.warn(`Slow API call detected: ${endpoint} took ${responseTime}ms`)
  }
}

// Database Query Monitoring
export function monitorDatabaseQuery(
  query: string,
  startTime: number,
  endTime: number,
  success: boolean,
  errorType?: string
): void {
  const responseTime = endTime - startTime

  performanceMonitor.recordMetrics({
    responseTime,
    tier: 'FAST' as any,
    model: 'DATABASE' as any,
    cacheHit: false,
    success,
    errorType,
    timestamp: Date.now(),
    query: query.substring(0, 100) // Truncate long queries
  })

  // Log slow queries
  if (responseTime > 1000) {
    console.warn(`Slow database query: ${responseTime}ms - ${query.substring(0, 50)}...`)
  }
}

// RAG System Monitoring
export function monitorRAGQuery(
  query: string,
  startTime: number,
  endTime: number,
  success: boolean,
  cacheHit: boolean,
  tier: string,
  errorType?: string
): void {
  const responseTime = endTime - startTime

  performanceMonitor.recordMetrics({
    responseTime,
    tier: tier as any,
    model: 'GPT_4' as any,
    cacheHit,
    success,
    errorType,
    timestamp: Date.now(),
    query: query.substring(0, 100)
  })

  // Log performance insights
  if (cacheHit && responseTime < 100) {
    console.log(`Fast cache hit: ${responseTime}ms`)
  } else if (!cacheHit && responseTime > 5000) {
    console.warn(`Slow RAG query: ${responseTime}ms - consider caching`)
  }
}

// Export monitoring utilities
export const monitoring = {
  initializeServer: initializeServerMonitoring,
  initializeBrowser: initializeBrowserMonitoring,
  monitorAPI: monitorAPICall,
  monitorDatabase: monitorDatabaseQuery,
  monitorRAG: monitorRAGQuery,
  recordPhase: recordStartupPhase,
  markComplete: markStartupComplete
}

// Auto-initialize based on environment
if (typeof window !== 'undefined') {
  // Browser environment
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBrowserMonitoring)
  } else {
    initializeBrowserMonitoring()
  }
} else {
  // Server environment
  initializeServerMonitoring()
}
