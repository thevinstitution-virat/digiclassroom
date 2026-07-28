// Startup Performance Monitor
// Tracks application startup time, memory usage, and initialization phases

interface StartupMetrics {
  phase: string
  startTime: number
  endTime?: number
  duration?: number
  memoryUsage?: NodeJS.MemoryUsage
  metadata?: Record<string, any>
}

interface StartupReport {
  totalStartupTime: number
  phases: StartupMetrics[]
  memoryPeak: number
  recommendations: string[]
  status: 'excellent' | 'good' | 'needs_improvement' | 'critical'
}

class StartupMonitor {
  private phases: StartupMetrics[] = []
  private startTime: number = Date.now()
  private initialized = false

  constructor() {
    this.recordPhase('application_start', { 
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    })
  }

  // Record a startup phase
  recordPhase(phase: string, metadata?: Record<string, any>): void {
    const now = Date.now()
    const memoryUsage = process.memoryUsage()

    // End previous phase if exists
    if (this.phases.length > 0) {
      const lastPhase = this.phases[this.phases.length - 1]
      if (!lastPhase.endTime) {
        lastPhase.endTime = now
        lastPhase.duration = now - lastPhase.startTime
      }
    }

    // Start new phase
    this.phases.push({
      phase,
      startTime: now,
      memoryUsage,
      metadata
    })

    console.log(`🚀 Startup Phase: ${phase} (${now - this.startTime}ms from start)`)
  }

  // Mark startup as complete
  markComplete(): void {
    if (this.initialized) return
    
    this.recordPhase('startup_complete')
    this.initialized = true
    
    const report = this.generateReport()
    console.log('📊 Startup Performance Report:', report)
    
    // Store report for dashboard
    if (typeof window !== 'undefined') {
      localStorage.setItem('startup_report', JSON.stringify(report))
    }
  }

  // Generate comprehensive startup report
  generateReport(): StartupReport {
    const totalStartupTime = Date.now() - this.startTime
    const memoryPeak = Math.max(...this.phases.map(p => p.memoryUsage?.heapUsed || 0))
    
    const recommendations = this.generateRecommendations(totalStartupTime, memoryPeak)
    const status = this.determineStatus(totalStartupTime, memoryPeak)

    return {
      totalStartupTime,
      phases: this.phases,
      memoryPeak,
      recommendations,
      status
    }
  }

  // Generate performance recommendations
  private generateRecommendations(totalTime: number, memoryPeak: number): string[] {
    const recommendations: string[] = []

    if (totalTime > 5000) {
      recommendations.push('Startup time is slow (>5s). Consider lazy loading heavy dependencies.')
    }

    if (totalTime > 10000) {
      recommendations.push('Critical startup time (>10s). Implement background initialization.')
    }

    if (memoryPeak > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage during startup. Review memory-intensive operations.')
    }

    const ragPhase = this.phases.find(p => p.phase.includes('rag'))
    if (ragPhase && ragPhase.duration && ragPhase.duration > 2000) {
      recommendations.push('RAG system initialization is slow. Consider lazy initialization.')
    }

    const dbPhase = this.phases.find(p => p.phase.includes('database'))
    if (dbPhase && dbPhase.duration && dbPhase.duration > 1000) {
      recommendations.push('Database connection is slow. Check connection pool configuration.')
    }

    if (recommendations.length === 0) {
      recommendations.push('Startup performance is optimal!')
    }

    return recommendations
  }

  // Determine overall status
  private determineStatus(totalTime: number, memoryPeak: number): StartupReport['status'] {
    if (totalTime > 10000 || memoryPeak > 200 * 1024 * 1024) {
      return 'critical'
    }
    if (totalTime > 5000 || memoryPeak > 100 * 1024 * 1024) {
      return 'needs_improvement'
    }
    if (totalTime > 2000) {
      return 'good'
    }
    return 'excellent'
  }

  // Get current metrics
  getCurrentMetrics(): {
    currentPhase: string
    elapsedTime: number
    memoryUsage: NodeJS.MemoryUsage
  } {
    const currentPhase = this.phases[this.phases.length - 1]
    return {
      currentPhase: currentPhase?.phase || 'unknown',
      elapsedTime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage()
    }
  }

  // Export metrics for external monitoring
  exportMetrics(): StartupMetrics[] {
    return [...this.phases]
  }
}

// Singleton instance
export const startupMonitor = new StartupMonitor()

// Browser-side startup monitoring
export class BrowserStartupMonitor {
  private startTime: number = performance.now()
  private phases: Array<{
    phase: string
    startTime: number
    endTime?: number
    duration?: number
    metadata?: Record<string, any>
  }> = []

  recordPhase(phase: string, metadata?: Record<string, any>): void {
    const now = performance.now()

    // End previous phase
    if (this.phases.length > 0) {
      const lastPhase = this.phases[this.phases.length - 1]
      if (!lastPhase.endTime) {
        lastPhase.endTime = now
        lastPhase.duration = now - lastPhase.startTime
      }
    }

    // Start new phase
    this.phases.push({
      phase,
      startTime: now,
      metadata
    })

    console.log(`🌐 Browser Phase: ${phase} (${now - this.startTime}ms from start)`)
  }

  // Measure Time to First Byte (TTFB)
  measureTTFB(): number | null {
    if (typeof window === 'undefined')
  return null
    
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return navigation ? navigation.responseStart - navigation.requestStart : null
  }

  // Measure First Contentful Paint (FCP)
  measureFCP(): Promise<number | null> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null)
        return
      }

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
        if (fcpEntry) {
          observer.disconnect()
          resolve(fcpEntry.startTime)
        }
      })

      observer.observe({ entryTypes: ['paint'] })

      // Timeout after 10 seconds
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, 10000)
    })
  }

  // Generate browser performance report
  generateBrowserReport(): {
    totalTime: number
        // @ts-ignore
    phases: typeof this.phases
    ttfb: number | null
    webVitals: {
      fcp?: number
      lcp?: number
      cls?: number
    }
  } {
    return {
      totalTime: performance.now() - this.startTime,
      phases: this.phases,
      ttfb: this.measureTTFB(),
      webVitals: {
        fcp: undefined, // Will be populated by measureFCP
      }
    }
  }
}

// Export browser monitor instance
export const browserStartupMonitor = typeof window !== 'undefined' 
  ? new BrowserStartupMonitor() 
  : null

// Utility functions for easy integration
export function recordStartupPhase(phase: string, metadata?: Record<string, any>): void {
  startupMonitor.recordPhase(phase, metadata)
  browserStartupMonitor?.recordPhase(phase, metadata)
}

export function markStartupComplete(): void {
  startupMonitor.markComplete()
}

export function getStartupReport(): StartupReport {
  return startupMonitor.generateReport()
}
