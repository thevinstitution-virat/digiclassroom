/**
 * Analytics Service Implementation
 * Tracks events, performance metrics, and user behavior
 * Features:
 * - Batch event processing
 * - Async event tracking (non-blocking)
 * - Event buffering
 * - Periodic flushing
 */

import type { IAnalyticsService, AnalyticsEvent } from '../interfaces';
import { APP_CONFIG } from '@/lib/config/app-config';

export interface AnalyticsServiceConfig {
  enabled?: boolean;
  batchSize?: number;
  flushInterval?: number;
}

export class AnalyticsService implements IAnalyticsService {
  private enabled: boolean;
  private batchSize: number;
  private flushInterval: number;
  private eventBuffer: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config?: AnalyticsServiceConfig) {
    this.enabled = config?.enabled ?? APP_CONFIG.analytics.enabled;
    this.batchSize = config?.batchSize ?? APP_CONFIG.analytics.batchSize;
    this.flushInterval = config?.flushInterval ?? APP_CONFIG.analytics.flushInterval;

    if (this.enabled) {
      this.startFlushTimer();
      console.log('✅ Analytics Service initialized (enabled)');
    } else {
      console.log('✅ Analytics Service initialized (disabled)');
    }
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.enabled) return;

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async trackAgentExecution(
    agentName: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.trackEvent({
      eventType: 'agent_execution',
      userId: 'system',
      metadata: {
        agentName,
        duration,
        success
      },
      timestamp: new Date()
    });
  }

  async trackSearchPerformance(
    query: string,
    resultCount: number,
    latency: number
  ): Promise<void> {
    await this.trackEvent({
      eventType: 'search_performance',
      userId: 'system',
      metadata: {
        query: query.substring(0, 100), // Truncate for privacy
        resultCount,
        latency
      },
      timestamp: new Date()
    });
  }

  async trackCacheHit(cacheType: string, hit: boolean): Promise<void> {
    await this.trackEvent({
      eventType: 'cache_hit',
      userId: 'system',
      metadata: {
        cacheType,
        hit
      },
      timestamp: new Date()
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('❌ Failed to flush analytics:', error);
      });
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // In production, send to analytics service (e.g., Mixpanel, Amplitude, etc.)
      // For now, just log
      console.log(`📊 Analytics: Flushing ${events.length} events`);
      
      // Group by event type for summary
      const summary = events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('📊 Event summary:', summary);

      // TODO: Send to actual analytics service
      // await sendToAnalyticsService(events);

    } catch (error) {
      console.error('❌ Failed to flush analytics:', error);
      // Re-add events to buffer on failure
      this.eventBuffer.unshift(...events);
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    await this.flush();

    console.log('✅ Analytics Service shut down');
  }
}

