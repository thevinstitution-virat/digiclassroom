import { NextResponse } from 'next/server'
import { connectionManager } from '@/lib/ai/rag/connection-manager'

export const runtime = 'nodejs'

// Public AI-stack health probe. The HTTP status code carries the operational
// signal (200 healthy / 206 degraded / 503 unhealthy) for uptime monitors; the
// body is intentionally minimal. Node/platform versions, per-subsystem topology,
// capability/feature enumeration, internal error strings and config-hint
// recommendations are NOT disclosed to anonymous callers (info-disclosure fix).
async function probe() {
  await connectionManager.initialize()
  const health = await connectionManager.performHealthCheck()
  const statusCode = health.status === 'unhealthy' ? 503 : health.status === 'degraded' ? 206 : 200
  return NextResponse.json(
    { status: health.status, service: 'ai', timestamp: new Date().toISOString() },
    { status: statusCode },
  )
}

export async function GET() {
  try {
    return await probe()
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', service: 'ai', timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}

// POST kept for manual re-checks; same minimal payload as GET.
export async function POST() {
  return GET()
}
