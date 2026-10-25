// GET /api/hw-eval/media?assignment=<id> | ?task=<id> — the image for an evaluator task.
// Served through the server (not a signed URL) so every view is checked: the caller must be
// assigned to the task, or be its eligible adjudicator. Never cached by shared caches.

import { NextRequest, NextResponse } from 'next/server';
import { requireToolsEnabled } from '@/lib/hw/eval-tools/access';
import { resolveEvalActor } from '@/lib/hw/eval-tools/actor';
import { taskMedia } from '@/lib/hw/eval-tools/work';
import { hwHttpStatus, isHwError } from '@/lib/hw/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireToolsEnabled();
    const actor = await resolveEvalActor(req.headers);
    const q = req.nextUrl.searchParams;
    const { bytes, mime } = await taskMedia(actor, { assignmentId: q.get('assignment') ?? undefined, taskId: q.get('task') ?? undefined });
    return new NextResponse(Buffer.from(bytes), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (e) {
    if (isHwError(e)) return NextResponse.json({ ok: false, error: e.publicMessage }, { status: hwHttpStatus(e.code) });
    console.error('[hw-eval] media failed:', e);
    return NextResponse.json({ ok: false, error: 'Could not load the image.' }, { status: 500 });
  }
}
