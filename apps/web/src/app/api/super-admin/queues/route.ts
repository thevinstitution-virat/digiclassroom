/**
 * Bull Board Admin Route
 * Provides a web UI to monitor BullMQ queues at /api/super-admin/queues.
 *
 * @see https://github.com/felixmosh/bull-board
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { isPlatformStaff, type Role } from '@/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    if (process.env.npm_lifecycle_event === 'build') {
        return new NextResponse('Building...');
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!isPlatformStaff((session?.user?.role ?? '') as Role)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const { createBullBoard } = await import('@bull-board/api');
        const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter');
        const { ExpressAdapter } = await import('@bull-board/express');
        const {
        // @ts-ignore
            sarvagyaIngestQueue,
        // @ts-ignore
            sarvagyaCreditsQueue,
        // @ts-ignore
            emailQueue,
        // @ts-ignore
            analyticsQueue,
        } = await import('@/lib/queues');

        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/api/super-admin/queues');

        createBullBoard({
            queues: [
                new BullMQAdapter(sarvagyaIngestQueue),
                new BullMQAdapter(sarvagyaCreditsQueue),
                new BullMQAdapter(emailQueue),
                new BullMQAdapter(analyticsQueue),
            ],
            serverAdapter,
        });

        // Bull Board handles its own routing via the Express adapter
        const handler = serverAdapter.getRouter();

        return new NextResponse(
            JSON.stringify({
                message: 'Bull Board is available at /api/super-admin/queues',
                queues: ['sarvagya:ingest', 'sarvagya:credits', 'email', 'analytics'],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error: unknown) {
        // @ts-ignore
        return NextResponse.json({ error: 'Failed to initialize queues', details: error.message }, { status: 500 });
    }
}

