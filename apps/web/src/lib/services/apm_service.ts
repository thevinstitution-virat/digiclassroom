/**
 * Application Performance Monitoring (APM) Service for DigiClassroom
 * Provides comprehensive monitoring, tracing, and analytics
 */

export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name: string;
  start_time: number;
  end_time?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    fields?: Record<string, any>;
  }>;
  status: 'pending' | 'success' | 'error';
  error?: {
    message: string;
    stack?: string;
    type: string;
  };
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  metadata: Record<string, any>;
}

export interface APMStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  error_rate: number;
  requests_per_minute: number;
  active_traces: number;
}

export class APMService {
  private traces: Map<string, TraceSpan> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_TRACES = 10000;
  private readonly MAX_METRICS = 50000;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  
  private stats = {
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    start_time: Date.now()
  };

  constructor() {
    // Periodic cleanup of old traces and metrics
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    console.log('📊 APM Service initialized');
  }

  /**
   * Start a new trace span
   */
  startSpan(
    operation_name: string,
    parent_span_id?: string,
    tags: Record<string, any> = {}
  ): TraceSpan {
    const trace_id = parent_span_id ? 
      this.traces.get(parent_span_id)?.trace_id || this.generateId() : 
      this.generateId();
    
    const span_id = this.generateId();
    
    const span: TraceSpan = {
      trace_id,
      span_id,
      parent_span_id,
      operation_name,
      start_time: Date.now(),
      tags: {
        ...tags,
        service: 'digiclassroom-ai-tutor',
        version: process.env.APP_VERSION || '1.0.0'
      },
      logs: [],
      status: 'pending'
    };

    this.traces.set(span_id, span);
    
    console.log(`🔍 Started span: ${operation_name} [${span_id}]`);
    return span;
  }

  /**
   * Finish a trace span
   */
  finishSpan(span_id: string, status: 'success' | 'error' = 'success', error?: Error): void {
    const span = this.traces.get(span_id);
    if (!span) {
      console.warn(`⚠️ Span not found: ${span_id}`);
      return;
    }

    span.end_time = Date.now();
    span.duration = span.end_time - span.start_time;
    span.status = status;

    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      };
    }

    // Record metrics
    this.recordMetric({
      operation: span.operation_name,
      duration: span.duration,
      timestamp: span.end_time,
      success: status === 'success',
      metadata: {
        trace_id: span.trace_id,
        span_id: span.span_id,
        tags: span.tags
      }
    });

    // Update stats
    this.stats.total_requests++;
    if (status === 'success') {
      this.stats.successful_requests++;
    } else {
      this.stats.failed_requests++;
    }

    console.log(`✅ Finished span: ${span.operation_name} [${span_id}] - ${span.duration}ms - ${status}`);
  }

  /**
   * Add log to a span
   */
  addSpanLog(
    span_id: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields?: Record<string, any>
  ): void {
    const span = this.traces.get(span_id);
    if (!span) {
      console.warn(`⚠️ Span not found for log: ${span_id}`);
      return;
    }

    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields
    });
  }

  /**
   * Add tags to a span
   */
  addSpanTags(span_id: string, tags: Record<string, any>): void {
    const span = this.traces.get(span_id);
    if (!span) {
      console.warn(`⚠️ Span not found for tags: ${span_id}`);
      return;
    }

    span.tags = { ...span.tags, ...tags };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Cleanup old metrics if we exceed the limit
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS * 0.8); // Keep 80% of max
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(trace_id: string): TraceSpan[] {
    const spans: TraceSpan[] = [];
    for (const span of this.traces.values()) {
      if (span.trace_id === trace_id) {
        spans.push(span);
      }
    }
    return spans.sort((a, b) => a.start_time - b.start_time);
  }

  /**
   * Get span by ID
   */
  getSpan(span_id: string): TraceSpan | undefined {
    return this.traces.get(span_id);
  }

  /**
   * Get APM statistics
   */
  getStats(): APMStats {
    const now = Date.now();
    const uptime = now - this.stats.start_time;
    const uptimeMinutes = uptime / (1000 * 60);
    
    // Calculate response time percentiles
    const durations = this.metrics
      .filter(m => m.success && m.timestamp > now - 3600000) // Last hour
      .map(m => m.duration)
      .sort((a, b) => a - b);
    
    const p95_index = Math.floor(durations.length * 0.95);
    const p99_index = Math.floor(durations.length * 0.99);
    
    const average_response_time = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    const p95_response_time = durations.length > 0 ? durations[p95_index] || 0 : 0;
    const p99_response_time = durations.length > 0 ? durations[p99_index] || 0 : 0;
    
    const error_rate = this.stats.total_requests > 0 
      ? (this.stats.failed_requests / this.stats.total_requests) * 100 
      : 0;
    
    const requests_per_minute = uptimeMinutes > 0 ? this.stats.total_requests / uptimeMinutes : 0;
    
    const active_traces = Array.from(this.traces.values()).filter(span => span.status === 'pending').length;

    return {
      total_requests: this.stats.total_requests,
      successful_requests: this.stats.successful_requests,
      failed_requests: this.stats.failed_requests,
      average_response_time: Math.round(average_response_time),
      p95_response_time: Math.round(p95_response_time),
      p99_response_time: Math.round(p99_response_time),
      error_rate: Math.round(error_rate * 100) / 100,
      requests_per_minute: Math.round(requests_per_minute * 100) / 100,
      active_traces
    };
  }

  /**
   * Get recent metrics for a specific operation
   */
  getOperationMetrics(operation: string, timeWindow: number = 3600000): PerformanceMetrics[] {
    const cutoff = Date.now() - timeWindow;
    return this.metrics.filter(m => 
      m.operation === operation && m.timestamp > cutoff
    );
  }

  /**
   * Get all active spans
   */
  getActiveSpans(): TraceSpan[] {
    return Array.from(this.traces.values()).filter(span => span.status === 'pending');
  }

  /**
   * Export traces for external APM systems
   */
  exportTraces(format: 'jaeger' | 'zipkin' | 'opentelemetry' = 'opentelemetry'): any[] {
    const traces = Array.from(this.traces.values());
    
    switch (format) {
      case 'opentelemetry':
        return traces.map(span => ({
          traceId: span.trace_id,
          spanId: span.span_id,
          parentSpanId: span.parent_span_id,
          operationName: span.operation_name,
          startTime: span.start_time * 1000, // Convert to microseconds
          duration: (span.duration || 0) * 1000,
          tags: span.tags,
          logs: span.logs,
          status: span.status,
          error: span.error
        }));
      
      case 'jaeger':
        return traces.map(span => ({
          traceID: span.trace_id,
          spanID: span.span_id,
          parentSpanID: span.parent_span_id,
          operationName: span.operation_name,
          startTime: span.start_time * 1000,
          duration: (span.duration || 0) * 1000,
          tags: Object.entries(span.tags).map(([key, value]) => ({ key, value: String(value) })),
          logs: span.logs.map(log => ({
            timestamp: log.timestamp * 1000,
            fields: [
              { key: 'level', value: log.level },
              { key: 'message', value: log.message },
              ...(log.fields ? Object.entries(log.fields).map(([k, v]) => ({ key: k, value: String(v) })) : [])
            ]
          }))
        }));
      
      default:
        return traces;
    }
  }

  /**
   * Health check for APM service
   */
  healthCheck(): { status: 'healthy' | 'degraded' | 'unhealthy'; details: any } {
    const stats = this.getStats();
    const activeSpans = this.getActiveSpans();
    
    // Check for potential issues
    const issues: string[] = [];
    
    if (stats.error_rate > 10) {
      issues.push(`High error rate: ${stats.error_rate}%`);
    }
    
    if (stats.average_response_time > 5000) {
      issues.push(`High average response time: ${stats.average_response_time}ms`);
    }
    
    if (activeSpans.length > 100) {
      issues.push(`Too many active spans: ${activeSpans.length}`);
    }
    
    if (this.traces.size > this.MAX_TRACES * 0.9) {
      issues.push(`Trace storage nearly full: ${this.traces.size}/${this.MAX_TRACES}`);
    }

    const status = issues.length === 0 ? 'healthy' : 
                  issues.length <= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      details: {
        stats,
        active_spans: activeSpans.length,
        total_traces: this.traces.size,
        total_metrics: this.metrics.length,
        issues: issues.length > 0 ? issues : undefined
      }
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour ago
    
    // Clean up old completed traces
    let cleanedTraces = 0;
    for (const [span_id, span] of this.traces.entries()) {
      if (span.status !== 'pending' && span.start_time < cutoff) {
        this.traces.delete(span_id);
        cleanedTraces++;
      }
    }
    
    // Clean up old metrics
    const oldMetricsCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    const cleanedMetrics = oldMetricsCount - this.metrics.length;
    
    if (cleanedTraces > 0 || cleanedMetrics > 0) {
      console.log(`🧹 APM cleanup: ${cleanedTraces} traces, ${cleanedMetrics} metrics`);
    }
  }
}

// Singleton instance
let apmService: APMService | null = null;

export function createAPMService(): APMService {
  if (!apmService) {
    apmService = new APMService();
  }
  return apmService;
}

export function getAPMService(): APMService {
  return createAPMService();
}
