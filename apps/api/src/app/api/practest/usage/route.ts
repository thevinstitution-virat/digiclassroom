// src/app/api/practest/usage/route.ts
// Today's practice-test usage vs. the plan's daily limit (trial = 5/day).

import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/auth/with-tenant-context'
import type { TenantContext } from '@/lib/db/tenant-scope'
import { practestQueries } from '@/lib/db/practest-queries'
import { practestDailyLimit } from '@/lib/practest/limits'
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service'

export const GET = withTenantContext(
  async (_req: NextRequest, _ctx: unknown, orgContext: TenantContext) => {
    try {
      const sub = await subscriptionValidationService.getUserSubscription(orgContext.userId)
      const limit = practestDailyLimit(sub?.plan_code)
      const q = practestQueries(orgContext.orgId)
      const used = limit > 0 ? await q.countTodaySessions(orgContext.userId) : 0

      return NextResponse.json({
        success: true,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        planName: sub?.plan_name ?? null,
        planCode: sub?.plan_code ?? null,
        isTrial: sub?.subscription_status === 'trial',
        needsUpgrade: limit <= 0,
      })
    } catch (err) {
      console.error('[practest/usage GET]', err)
      return NextResponse.json({ success: false, error: 'Failed to load usage' }, { status: 500 })
    }
  },
)
