// src/app/api/practest/configurations/route.ts
// Published test series a student can launch (org-owned + platform-global, public + active).

import { NextRequest, NextResponse } from 'next/server'
import { withOrgContext } from '@/lib/auth/with-org-context'
import type { OrgContext } from '@/lib/auth/get-org-context'
import { practestQueries } from '@/lib/db/practest-queries'

export const GET = withOrgContext(
  async (_req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    try {
      const q = practestQueries(orgContext.orgId)
      const configurations = await q.listPublicConfigurations()
      return NextResponse.json({ success: true, configurations })
    } catch (err) {
      console.error('[practest/configurations GET]', err)
      return NextResponse.json({ success: false, error: 'Failed to load test series' }, { status: 500 })
    }
  },
  { requireOrg: true },
)
