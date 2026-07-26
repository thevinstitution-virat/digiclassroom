// src/app/api/super-admin/join-requests/[id]/route.ts
// POST { action: 'approve' | 'reject' } — platform owner reviews any join request.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { institutionJoinRequests as IJR, member } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop()
  if (!id) return NextResponse.json({ success: false, error: 'Missing request id' }, { status: 400 })

  let body: { action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ success: false, error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  try {
    const [reqRow] = await db.select().from(IJR).where(eq(IJR.id, id)).limit(1)
    if (!reqRow) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Request already ${reqRow.status}` }, { status: 409 })
    }

    if (action === 'approve') {
      const [existing] = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.userId, reqRow.userId), eq(member.organizationId, reqRow.organizationId)))
        .limit(1)
      if (!existing) {
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: reqRow.organizationId,
          userId: reqRow.userId,
          role: 'member',
          createdAt: new Date(),
        })
      }
    }

    const session = await auth.api.getSession({ headers: await headers() })
    await db
      .update(IJR)
      .set({ status: action === 'approve' ? 'approved' : 'rejected', reviewedBy: session?.user?.id ?? 'super_admin', reviewedAt: new Date() })
      .where(eq(IJR.id, id))

    return NextResponse.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' })
  } catch (e) {
    console.error('[super-admin/join-requests/[id] POST]', e)
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 })
  }
}
