import { NextResponse } from 'next/server'

// Root liveness endpoint for the headless API app. Actual functionality lives
// under /api/*. Returns 200 so platform health checks on `/` succeed.
export function GET() {
  return NextResponse.json({ service: 'digiclassroom-api', status: 'ok' })
}
