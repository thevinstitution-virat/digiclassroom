import { NextResponse } from 'next/server'

// Public, unauthenticated liveness probe. Intentionally minimal: it must return
// 200 for uptime monitors and the AI-tutor connection check (which only reads
// `response.ok`), but must NOT enumerate internal subsystems, feature flags or
// environment state to anonymous callers — that was an information-disclosure
// finding. Operational detail lives behind the authenticated super-admin health
// surfaces, not here.
export async function GET() {
  return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() })
}
