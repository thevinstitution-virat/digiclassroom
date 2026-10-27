// GET /api/hw/submissions/:submissionId/concept-feedback — a marked submission read concept by concept from the
// library's knowledge graph: marks lost per concept, weakest first, with what to revise before it. For the student
// once the work is returned, and for a teacher who may view the submission. Off unless LIBRARY_GRAPH_ENABLED.

import { NextRequest, NextResponse } from 'next/server';
import { resolveHwActor } from '@/lib/hw/access/actor';
import { requireHwEnabled } from '@/lib/hw/access/guards';
import { conceptFeedbackForSubmission } from '@/lib/hw/concept-feedback';
import { hwHttpStatus, isHwError } from '@/lib/hw/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }): Promise<NextResponse> {
  try {
    const { submissionId } = await params;
    const actor = await resolveHwActor(req.headers);
    await requireHwEnabled(actor);
    return NextResponse.json({ ok: true, ...(await conceptFeedbackForSubmission(actor, submissionId)) });
  } catch (e) {
    if (isHwError(e)) return NextResponse.json({ ok: false, error: e.publicMessage, code: e.code }, { status: hwHttpStatus(e.code) });
    console.error('[hw] concept feedback failed:', e);
    return NextResponse.json({ ok: false, error: 'Concept feedback is not available right now.' }, { status: 500 });
  }
}
