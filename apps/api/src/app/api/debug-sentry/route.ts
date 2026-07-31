import { NextResponse } from 'next/server'

// Deliberately throws so error tracking can be verified end-to-end. Reported via
// the instrumentation onRequestError hook. Safe to remove once GlitchTip is
// confirmed.
export const dynamic = 'force-dynamic'

export function GET() {
  throw new Error('GlitchTip test error — dgcl-backend (safe to ignore)')
  // eslint-disable-next-line no-unreachable
  return NextResponse.json({ ok: true })
}
