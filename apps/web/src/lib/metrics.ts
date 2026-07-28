import { logger } from './logger';

export interface MetricTags {
    userId?: string;
    organizationId?: string | null;
    route?: string;
    // Specific error codes or contexts
    errorCode?: string;
    [key: string]: any;
}

/**
 * Simple metrics tracker for Phase 0.5 observability.
 * Emits uniquely formatted JSON logs that can be ingested by 
 * Datadog, ELK, or CloudWatch as metric primitives.
 */
export const metrics = {
    /**
     * Increment a counter (e.g., requests, errors, rbac_denials)
     */
    increment: (metricName: string, value: number = 1, tags?: MetricTags) => {
        logger.info(`METRIC_COUNTER`, { metric: metricName, value, type: 'count', ...tags });
    },

    /**
     * Record a latency or duration in milliseconds
     */
    histogram: (metricName: string, durationMs: number, tags?: MetricTags) => {
        logger.info(`METRIC_HISTOGRAM`, { metric: metricName, value: durationMs, type: 'histogram', ...tags });
    },

    /**
     * Wrapper to measure the execution time of an asynchronous function
     * Use this to trace critical flows like login, CSV import, etc.
     */
    trace: async <T>(metricName: string, fn: () => Promise<T>, tags?: MetricTags): Promise<T> => {
        const start = Date.now();
        let isError = false;
        try {
            return await fn();
        } catch (error) {
            isError = true;
            throw error;
        } finally {
            const end = Date.now();
            metrics.histogram(metricName, end - start, { ...tags, isError });
        }
    }
};
