// src/app/api/institution/join-requests/route.ts
// GET — list student join requests for the admin's institution (default: pending).

import { NextRequest, NextResponse } from 'next/server'
import { withOrgContext, OrgRouteContext } from '@/lib/auth/with-org-context'
import { db } from '@/db'
import { institutionJoinRequests as IJR, user } from '@/db/schema'
import { and, eq, desc, type SQL } from 'drizzle-orm'

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgRouteContext) => {
    const status = req.nextUrl.searchParams.get('status') || 'pending'
    try {
      const conds: SQL[] = [eq(IJR.organizationId, orgContext.orgId)]
      if (status !== 'all') conds.push(eq(IJR.status, status))

      const rows = await db
        .select({
          id: IJR.id,
          userId: IJR.userId,
          status: IJR.status,
          message: IJR.message,
          requestedClass: IJR.requestedClass,
          requestedBoard: IJR.requestedBoard,
          createdAt: IJR.createdAt,
          userName: user.name,
          userEmail: user.email,
        })
        .from(IJR)
        .innerJoin(user, eq(user.id, IJR.userId))
        .where(and(...conds))
        .orderBy(desc(IJR.createdAt))

      return NextResponse.json({ success: true, requests: rows })
    } catch (e) {
      console.error('[institution/join-requests GET]', e)
      return NextResponse.json({ success: false, error: 'Failed to load join requests' }, { status: 500 })
    }
  },
  { requireOrg: true, orgRoles: ['owner', 'org_admin'] },
)
