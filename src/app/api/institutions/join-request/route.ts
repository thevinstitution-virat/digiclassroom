// src/app/api/institutions/join-request/route.ts
// POST — a signed-in (B2C) student requests to join an institution. Creates a
// PENDING request that the institution admin approves. No org membership required.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { db } from '@/db'
import { organization, member, institutionJoinRequests } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { institutionId?: string; message?: string; requestedClass?: number; requestedBoard?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const institutionId = body.institutionId
  if (!institutionId) {
    return NextResponse.json({ success: false, error: 'institutionId is required' }, { status: 400 })
  }

  try {
    // Institution must exist.
    const [org] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, institutionId)).limit(1)
    if (!org) return NextResponse.json({ success: false, error: 'Institution not found' }, { status: 404 })

    // Already a member?
    const [existingMember] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, institutionId)))
      .limit(1)
    if (existingMember) {
      return NextResponse.json({ success: true, status: 'member', message: 'You are already a member of this institution.' })
    }

    // Already a pending request?
    const [existingReq] = await db
      .select({ id: institutionJoinRequests.id })
      .from(institutionJoinRequests)
      .where(and(
        eq(institutionJoinRequests.userId, userId),
        eq(institutionJoinRequests.organizationId, institutionId),
        eq(institutionJoinRequests.status, 'pending'),
      ))
      .limit(1)
    if (existingReq) {
      return NextResponse.json({ success: true, status: 'pending', message: 'Your request is already pending approval.' })
    }

    await db.insert(institutionJoinRequests).values({
      id: crypto.randomUUID(),
      userId,
      organizationId: institutionId,
      status: 'pending',
      message: body.message ?? null,
      requestedClass: typeof body.requestedClass === 'number' ? body.requestedClass : null,
      requestedBoard: body.requestedBoard ?? null,
    })

    return NextResponse.json({ success: true, status: 'pending', message: 'Request sent — your institution admin will review it.' })
  } catch (e) {
    console.error('[institutions/join-request POST]', e)
    return NextResponse.json({ success: false, error: 'Failed to submit request' }, { status: 500 })
  }
}
