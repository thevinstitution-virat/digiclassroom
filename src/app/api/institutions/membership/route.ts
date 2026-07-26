// src/app/api/institutions/membership/route.ts
// GET — the current user's institution membership + any pending join request.
// Used by onboarding to lock the institution step for invited/enrolled students.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { db } from '@/db'
import { organization, member, institutionJoinRequests } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [m] = await db
      .select({ orgId: member.organizationId, role: member.role, name: organization.name })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, userId))
      .limit(1)

    const [pending] = await db
      .select({ id: institutionJoinRequests.id, orgId: institutionJoinRequests.organizationId, name: organization.name, status: institutionJoinRequests.status })
      .from(institutionJoinRequests)
      .innerJoin(organization, eq(organization.id, institutionJoinRequests.organizationId))
      .where(and(eq(institutionJoinRequests.userId, userId), eq(institutionJoinRequests.status, 'pending')))
      .limit(1)

    return NextResponse.json({
      success: true,
      member: m ? { organizationId: m.orgId, name: m.name, role: m.role } : null,
      pendingRequest: pending ? { id: pending.id, organizationId: pending.orgId, name: pending.name } : null,
    })
  } catch (e) {
    console.error('[institutions/membership GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load membership' }, { status: 500 })
  }
}
