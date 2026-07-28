// src/app/api/practest/configurations/route.ts
// Published test series a student can launch (org-owned + platform-global, public + active).

import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/auth/with-tenant-context'
import type { TenantContext } from '@/lib/db/tenant-scope'
import { practestQueries } from '@/lib/db/practest-queries'

export const GET = withTenantContext(
  async (_req: NextRequest, _ctx: unknown, orgContext: TenantContext) => {
    try {
      const q = practestQueries(orgContext.orgId)
      const configurations = await q.listPublicConfigurations()
      return NextResponse.json({ success: true, configurations })
    } catch (err) {
      console.error('[practest/configurations GET]', err)
      return NextResponse.json({ success: false, error: 'Failed to load test series' }, { status: 500 })
    }
  },
)
