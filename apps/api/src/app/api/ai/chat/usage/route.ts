// GET /api/ai/chat/usage — today's tutor questions per tier (Basic / Prime) against the student's plan limit, for the
// toggle in the tutor's input. While TUTOR_TIERS_ENABLED is off it answers { tiersEnabled: false } without reading
// usage, so it never touches the prime_asked column before migration 017 is applied.

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service'
import { tutorTiersEnabled } from '@/lib/ai/tutor-tiers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
  if (!tutorTiersEnabled()) return NextResponse.json({ tiersEnabled: false })
  try {
    const { used, limits } = await subscriptionValidationService.tutorTierUsage(userId)
    return NextResponse.json({
      tiersEnabled: true,
      basic: { used: used.basic, limit: limits.basic, left: Math.max(0, limits.basic - used.basic) },
      prime: { used: used.prime, limit: limits.prime, left: Math.max(0, limits.prime - used.prime) },
    })
  } catch (e) {
    console.error('[tutor] usage failed:', e)
    return NextResponse.json({ error: 'Usage is not available right now.' }, { status: 500 })
  }
}
