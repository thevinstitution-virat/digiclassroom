// POST /api/hw/submissions/:submissionId/ink — upload one handwritten answer.
// multipart/form-data: questionId, ink (gzipped stroke JSON v1), render (PNG drawn from it).
// The files pass through the server so they can be validated before they reach R2.

import { NextRequest, NextResponse } from 'next/server';
import { resolveHwActor } from '@/lib/hw/access/actor';
import { requireHwEnabled } from '@/lib/hw/access/guards';
import { getHwConfig } from '@/lib/hw/config';
import { HwError, hwHttpStatus, isHwError } from '@/lib/hw/errors';
import { storeInk } from '@/lib/hw/services/submissions';

export const dynamic = 'force-dynamic';

async function fileBytes(form: FormData, name: string, maxBytes: number, types: string[]): Promise<Uint8Array> {
  const f = form.get(name);
  if (!(f instanceof Blob)) throw new HwError('BAD_REQUEST', `Missing ${name} file.`);
  if (f.size > maxBytes) throw new HwError('PAYLOAD_TOO_LARGE', `The ${name} file is too large.`);
  if (!types.includes(f.type)) throw new HwError('BAD_REQUEST', `The ${name} file has the wrong type.`, `${name} content-type ${f.type}`);
  return new Uint8Array(await f.arrayBuffer());
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ submissionId: string }> }): Promise<NextResponse> {
  try {
    const { submissionId } = await params;
    const cfg = getHwConfig();
    // Refuse oversized bodies before parsing them.
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > cfg.HW_INK_MAX_BYTES + cfg.HW_RENDER_MAX_BYTES + 64 * 1024) {
      throw new HwError('PAYLOAD_TOO_LARGE', 'This upload is too large.');
    }
    const actor = await resolveHwActor(req.headers);
    await requireHwEnabled(actor);

    const form = await req.formData();
    const questionId = form.get('questionId');
    if (typeof questionId !== 'string' || !questionId) throw new HwError('BAD_REQUEST', 'Missing questionId.');
    const ink = await fileBytes(form, 'ink', cfg.HW_INK_MAX_BYTES, ['application/gzip', 'application/x-gzip', 'application/octet-stream']);
    const render = await fileBytes(form, 'render', cfg.HW_RENDER_MAX_BYTES, ['image/png']);

    const result = await storeInk(actor, submissionId, questionId, ink, render);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (isHwError(e)) {
      if (e.publicMessage !== e.message) console.warn(`[hw] ink upload refused: ${e.message}`);
      return NextResponse.json({ ok: false, error: e.publicMessage, code: e.code }, { status: hwHttpStatus(e.code) });
    }
    console.error('[hw] ink upload failed:', e);
    return NextResponse.json({ ok: false, error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
