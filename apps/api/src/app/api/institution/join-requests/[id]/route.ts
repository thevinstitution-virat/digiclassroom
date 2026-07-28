// src/app/api/institution/join-requests/[id]/route.ts
// POST { action: 'approve' | 'reject' } — institution admin reviews a join request.
// On approve, the student is added to the institution (member row).

import { NextRequest, NextResponse } from 'next/server'
import { withOrgContext, OrgRouteContext } from '@/lib/auth/with-org-context'
import { db } from '@/db'
import { institutionJoinRequests as IJR, member } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export const POST = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgRouteContext) => {
    // /api/institution/join-requests/<id>
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
      // Scope to the admin's org so they can't act on another org's requests.
      const [reqRow] = await db
        .select()
        .from(IJR)
        .where(and(eq(IJR.id, id), eq(IJR.organizationId, orgContext.orgId)))
        .limit(1)

      if (!reqRow) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
      if (reqRow.status !== 'pending') {
        return NextResponse.json({ success: false, error: `Request already ${reqRow.status}` }, { status: 409 })
      }

      if (action === 'approve') {
        // Add as a member (idempotent).
        const [existing] = await db
          .select({ id: member.id })
          .from(member)
          .where(and(eq(member.userId, reqRow.userId), eq(member.organizationId, orgContext.orgId)))
          .limit(1)
        if (!existing) {
          await db.insert(member).values({
            id: crypto.randomUUID(),
            organizationId: orgContext.orgId,
            userId: reqRow.userId,
            role: 'member',
            createdAt: new Date(),
          })
        }
      }

      await db
        .update(IJR)
        .set({ status: action === 'approve' ? 'approved' : 'rejected', reviewedBy: orgContext.userId, reviewedAt: new Date() })
        .where(eq(IJR.id, id))

      return NextResponse.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' })
    } catch (e) {
      console.error('[institution/join-requests/[id] POST]', e)
      return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 })
    }
  },
  { requireOrg: true, orgRoles: ['owner', 'org_admin'] },
)
