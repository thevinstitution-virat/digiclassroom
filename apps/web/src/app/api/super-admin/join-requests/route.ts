// src/app/api/super-admin/join-requests/route.ts
// GET — ALL student join requests across every institution (platform owner view).

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { institutionJoinRequests as IJR, user, organization } from '@/db/schema'
import { and, eq, desc, type SQL } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  try {
    const conds: SQL[] = []
    if (status !== 'all') conds.push(eq(IJR.status, status))

    const rows = await db
      .select({
        id: IJR.id,
        userId: IJR.userId,
        status: IJR.status,
        requestedClass: IJR.requestedClass,
        requestedBoard: IJR.requestedBoard,
        message: IJR.message,
        createdAt: IJR.createdAt,
        userName: user.name,
        userEmail: user.email,
        organizationId: IJR.organizationId,
        organizationName: organization.name,
      })
      .from(IJR)
      .innerJoin(user, eq(user.id, IJR.userId))
      .innerJoin(organization, eq(organization.id, IJR.organizationId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(IJR.createdAt))

    return NextResponse.json({ success: true, requests: rows })
  } catch (e) {
    console.error('[super-admin/join-requests GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load join requests' }, { status: 500 })
  }
}
