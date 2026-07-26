/**
 * Worker Health Check Endpoint
 * Phase 5.2: BullMQ Production Hardening
 *
 * Returns queue metrics and alerts for:
 * - High failure rate (>10 failed jobs)
 * - Worker stall (jobs waiting but nothing active)
 * - Redis unreachable (returns 503 within 3 seconds, never hangs)
 */

import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Dynamic import with a timeout guard — prevents hanging when Redis is down.
        // ioredis retries indefinitely by default; we race against a 3-second deadline.
        const result = await Promise.race([
            getQueueMetrics(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Redis connection timeout (3s)')), 3000)
            ),
        ]);

        return NextResponse.json(result, {
            status: result.status === 'healthy' ? 200 : 503,
        });
    } catch (err) {
        // Redis unreachable or timeout — return 503 immediately
        return NextResponse.json(
            {
                status: 'error',
                message: 'Cannot connect to BullMQ Redis instance',
                error: (err as Error).message,
                timestamp: new Date().toISOString(),
            },
            { status: 503 }
        );
    }
}

async function getQueueMetrics() {
    // Import queue only when we actually need it — avoids triggering
    // the ioredis connection on every module load
    const { audioGenerationQueue } = await import('@/lib/queues/index');

    const [waiting, active, failed, completed] = await Promise.all([
        audioGenerationQueue.getWaitingCount(),
        audioGenerationQueue.getActiveCount(),
        audioGenerationQueue.getFailedCount(),
        audioGenerationQueue.getCompletedCount(),
    ]);

    const workerHealthy = failed < 10;
    const workerStalled = waiting > 5 && active === 0;

    return {
        status: workerHealthy && !workerStalled ? ('healthy' as const) : ('degraded' as const),
        queue: 'audio-generation',
        counts: { waiting, active, failed, completed },
        alerts: {
            highFailureRate: !workerHealthy,
            workerStalled,
        },
        timestamp: new Date().toISOString(),
    };
}
