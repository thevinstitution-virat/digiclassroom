// POST /api/cron/hw-jobs — drains the Handwritten Assignments job queue for up to ~50s.
// Called every minute by a Coolify scheduled task:
//   curl -fsS -X POST -H "Authorization: Bearer $HW_CRON_SECRET" http://localhost:3000/api/cron/hw-jobs
//
// Fails closed: with HW_CRON_SECRET unset, every call is refused (the existing cron route
// compares against `Bearer undefined` in that case).

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { drain } from '@/lib/hw/jobs/runner';

export const dynamic = 'force-dynamic';

function authorised(req: NextRequest): boolean {
  const secret = process.env.HW_CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = req.headers.get('authorization') ?? '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const summary = await drain(`cron:${hostname()}:${process.pid}`, 50_000);
  return NextResponse.json(summary, { status: summary.errors.length ? 500 : 200 });
}
