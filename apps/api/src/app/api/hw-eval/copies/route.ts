// POST /api/hw-eval/copies — one writing-pad copy of a known text, by an evaluator.
// multipart/form-data: datasetRef, itemId, durationMs, device, ink (gzipped stroke JSON v1),
// render (PNG drawn from it). Validated like a student's ink before anything is stored.

import { NextRequest, NextResponse } from 'next/server';
import { requireToolsEnabled } from '@/lib/hw/eval-tools/access';
import { resolveEvalActor } from '@/lib/hw/eval-tools/actor';
import { storeCopy } from '@/lib/hw/eval-tools/copies';
import { getHwConfig } from '@/lib/hw/config';
import { HwError, hwHttpStatus, isHwError } from '@/lib/hw/errors';

export const dynamic = 'force-dynamic';

async function fileBytes(form: FormData, name: string, maxBytes: number, types: string[]): Promise<Uint8Array> {
  const f = form.get(name);
  if (!(f instanceof Blob)) throw new HwError('BAD_REQUEST', `Missing ${name} file.`);
  if (f.size > maxBytes) throw new HwError('PAYLOAD_TOO_LARGE', `The ${name} file is too large.`);
  if (!types.includes(f.type)) throw new HwError('BAD_REQUEST', `The ${name} file has the wrong type.`);
  return new Uint8Array(await f.arrayBuffer());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    requireToolsEnabled();
    const cfg = getHwConfig();
    if (Number(req.headers.get('content-length') ?? '0') > cfg.HW_INK_MAX_BYTES + cfg.HW_RENDER_MAX_BYTES + 64 * 1024) {
      throw new HwError('PAYLOAD_TOO_LARGE', 'This upload is too large.');
    }
    const actor = await resolveEvalActor(req.headers);
    const form = await req.formData();
    const text = (k: string) => { const v = form.get(k); return typeof v === 'string' ? v : ''; };
    const result = await storeCopy(actor, {
      datasetRef: text('datasetRef'), itemId: text('itemId'),
      durationMs: Number(text('durationMs')) || 0, device: text('device') || 'unknown',
      ink: await fileBytes(form, 'ink', cfg.HW_INK_MAX_BYTES, ['application/gzip', 'application/x-gzip', 'application/octet-stream']),
      render: await fileBytes(form, 'render', cfg.HW_RENDER_MAX_BYTES, ['image/png']),
    });
    return NextResponse.json(result);
  } catch (e) {
    if (isHwError(e)) return NextResponse.json({ ok: false, error: e.publicMessage }, { status: hwHttpStatus(e.code) });
    console.error('[hw-eval] copy upload failed:', e);
    return NextResponse.json({ ok: false, error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
