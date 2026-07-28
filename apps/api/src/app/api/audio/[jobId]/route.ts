/**
 * Audio Job Polling Endpoint
 * Phase 4 Pre-flight — frontend polls this to get async TTS results.
 *
 * GET /api/audio/[jobId]
 * Returns: { status: 'pending' | 'completed' | 'failed' | 'not_found', result?: AudioJobResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { audioGenerationQueue } from '@/lib/queues';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    const { jobId } = await params;

    try {
        const job = await audioGenerationQueue.getJob(jobId);

        if (!job) {
            return NextResponse.json({ status: 'not_found' }, { status: 404 });
        }

        const state = await job.getState();

        if (state === 'completed') {
            const result = job.returnvalue;
            return NextResponse.json({ status: 'completed', result });
        }

        if (state === 'failed') {
            return NextResponse.json({ status: 'failed', result: null });
        }

        // active, waiting, delayed, etc.
        return NextResponse.json({ status: 'pending' });
    } catch (error) {
        console.error('[AudioPoll] Error checking job status:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
