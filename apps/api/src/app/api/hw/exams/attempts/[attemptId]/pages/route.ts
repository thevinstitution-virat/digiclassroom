// POST /api/hw/exams/attempts/:attemptId/pages — add one photographed answer page to an exam attempt's booklet (docs/hw-eval/exam-packages.md,
// phase 4). multipart/form-data: page (the photo, JPEG/PNG/WebP), facts (JSON: sharpness, brightness, glare, override — what the browser
// measured). The photo passes through the server so it can be checked before it is stored; the browser's measurements decide nothing the
// server can check itself.

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/auth';
import { db as hwDb } from '@/lib/hw/db';
import { HwError, hwHttpStatus, isHwError } from '@/lib/hw/errors';
import { addPage } from '@/lib/hw/exams/pages';
import { PAGE_LIMITS } from '@/lib/hw/exams/rules';
import { examPageStore } from '@/lib/hw/storage/exam-pages';

export const dynamic = 'force-dynamic';

const unit = z.number().min(0).max(1);
const factsSchema = z.object({ sharpness: unit, brightness: unit, glare: unit, override: z.boolean().default(false) });
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }): Promise<NextResponse> {
  try {
    const { attemptId } = await params;
    if (!ID.test(attemptId)) throw new HwError('NOT_FOUND', 'Not found. / नहीं मिला।');
    if (Number(req.headers.get('content-length') ?? '0') > PAGE_LIMITS.maxBytes + 64 * 1024) {
      throw new HwError('PAYLOAD_TOO_LARGE', 'This photo is too large. / यह फ़ोटो बहुत बड़ी है।');
    }
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) throw new HwError('UNAUTHORIZED', 'Please sign in again. / कृपया फिर से साइन इन करें।');

    const form = await req.formData();
    const page = form.get('page');
    if (!(page instanceof Blob)) throw new HwError('BAD_REQUEST', 'Missing photo. / फ़ोटो नहीं मिली।');
    if (page.size > PAGE_LIMITS.maxBytes) throw new HwError('PAYLOAD_TOO_LARGE', 'This photo is too large. / यह फ़ोटो बहुत बड़ी है।');
    const factsRaw = form.get('facts');
    const facts = factsSchema.safeParse(typeof factsRaw === 'string' ? JSON.parse(factsRaw) : null);
    if (!facts.success) throw new HwError('BAD_REQUEST', 'The photo could not be checked. Please try again. / फ़ोटो जाँची नहीं जा सकी। फिर कोशिश करें।', 'facts missing or malformed');

    const r = await addPage(hwDb, examPageStore(), userId, attemptId, new Uint8Array(await page.arrayBuffer()), facts.data);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ ok: false, error: 'The photo could not be checked. / फ़ोटो जाँची नहीं जा सकी।' }, { status: 400 });
    if (isHwError(e)) {
      if (e.publicMessage !== e.message) console.warn(`[hw-exams] page refused: ${e.message}`);
      return NextResponse.json({ ok: false, error: e.publicMessage, code: e.code }, { status: hwHttpStatus(e.code) });
    }
    console.error('[hw-exams] page upload failed:', e);
    return NextResponse.json({ ok: false, error: 'Upload failed. Please try again. / अपलोड नहीं हुआ। फिर कोशिश करें।' }, { status: 500 });
  }
}
