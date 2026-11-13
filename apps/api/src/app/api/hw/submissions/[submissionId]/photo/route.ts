// POST /api/hw/submissions/:submissionId/photo — a photo of one answer written on paper (homework, and always in InkBuddy).
// multipart/form-data: questionId, photo (JPEG/PNG/WebP, already shrunk by the browser), facts (JSON: sharpness, brightness, glare, override —
// what the browser measured). The photo passes through the server so it is checked before it reaches R2; the browser decides nothing the
// server can check itself.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveHwActor } from '@/lib/hw/access/actor';
import { requireHwEnabled } from '@/lib/hw/access/guards';
import { HwError, hwHttpStatus, isHwError } from '@/lib/hw/errors';
import { PHOTO_LIMITS } from '@/lib/hw/photo/rules';
import { storePhoto } from '@/lib/hw/services/submissions';

export const dynamic = 'force-dynamic';

const unit = z.number().min(0).max(1);
const factsSchema = z.object({ sharpness: unit, brightness: unit, glare: unit, override: z.boolean().default(false) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }): Promise<NextResponse> {
  try {
    const { submissionId } = await params;
    if (Number(req.headers.get('content-length') ?? '0') > PHOTO_LIMITS.maxBytes + 64 * 1024) {
      throw new HwError('PAYLOAD_TOO_LARGE', 'This photo is too large.');
    }
    const actor = await resolveHwActor(req.headers);
    await requireHwEnabled(actor);

    const form = await req.formData();
    const questionId = form.get('questionId');
    if (typeof questionId !== 'string' || !questionId) throw new HwError('BAD_REQUEST', 'Missing questionId.');
    const photo = form.get('photo');
    if (!(photo instanceof Blob)) throw new HwError('BAD_REQUEST', 'Missing photo.');
    if (photo.size > PHOTO_LIMITS.maxBytes) throw new HwError('PAYLOAD_TOO_LARGE', 'This photo is too large.');
    const raw = form.get('facts');
    let parsed: unknown = null;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : null } catch { /* refused below */ }
    const facts = factsSchema.safeParse(parsed);
    if (!facts.success) throw new HwError('BAD_REQUEST', 'The photo could not be checked. Please try again.', 'facts missing or malformed');

    const result = await storePhoto(actor, submissionId, questionId, new Uint8Array(await photo.arrayBuffer()), facts.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (isHwError(e)) {
      if (e.publicMessage !== e.message) console.warn(`[hw] photo upload refused: ${e.message}`);
      return NextResponse.json({ ok: false, error: e.publicMessage, code: e.code }, { status: hwHttpStatus(e.code) });
    }
    console.error('[hw] photo upload failed:', e);
    return NextResponse.json({ ok: false, error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
