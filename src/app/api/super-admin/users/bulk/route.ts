// src/app/api/super-admin/users/bulk/route.ts
// Bulk user operations (super_admin only). Rewritten to perform REAL DB writes
// via Drizzle (the previous version logged TODOs and faked success).

import { NextRequest, NextResponse } from 'next/server'
import { BulkUserAction } from '@/types/user-management'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { user } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { sendEmail, emailLayout } from '@/lib/email/send-email'

const VALID_ROLES = ['super_admin', 'admin', 'teacher', 'student', 'parent']

export async function POST(request: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  const currentUserId = guard.ctx.userId

  try {
    const { userIds, action, payload }: BulkUserAction = await request.json()

    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No users selected' }, { status: 400 })
    }
    // Never let a bulk op hit the actor's own account.
    const ids = userIds.filter((id) => id !== currentUserId)
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Cannot perform bulk actions on your own account' }, { status: 400 })
    }

    let affected = 0

    switch (action) {
      case 'changeRole': {
        if (!payload?.role || !VALID_ROLES.includes(payload.role)) {
          return NextResponse.json({ success: false, error: 'A valid role is required' }, { status: 400 })
        }
        // SECURITY: super_admin (platform owner) is never assignable in bulk.
        if (payload.role === 'super_admin') {
          return NextResponse.json({ success: false, error: 'super_admin cannot be assigned' }, { status: 403 })
        }
        await db.update(user).set({ role: payload.role }).where(inArray(user.id, ids))
        affected = ids.length
        break
      }

      case 'changeStatus': {
        // No dedicated status column — map to email-verification (active = verified).
        if (!payload?.status) {
          return NextResponse.json({ success: false, error: 'A status is required' }, { status: 400 })
        }
        await db.update(user).set({ emailVerified: payload.status === 'active' }).where(inArray(user.id, ids))
        affected = ids.length
        break
      }

      case 'delete': {
        // SECURITY: never delete super_admin (platform owner) accounts — skip them.
        const protectedRows = await db.select({ id: user.id }).from(user)
          .where(and(inArray(user.id, ids), eq(user.role, 'super_admin')))
        const protectedIds = new Set(protectedRows.map((r) => r.id))
        const deletable = ids.filter((id) => !protectedIds.has(id))
        if (deletable.length) await db.delete(user).where(inArray(user.id, deletable))
        affected = deletable.length
        break
      }

      case 'sendEmail': {
        const rows = await db.select({ email: user.email }).from(user).where(inArray(user.id, ids))
        const message = payload?.message || 'You have a new notification from DigiClassroom Pro.'
        const results = await Promise.all(
          rows.map((r) =>
            sendEmail({
              to: r.email,
              subject: 'A message from DigiClassroom Pro',
              html: emailLayout({ heading: 'DigiClassroom Pro', body: message }),
            })
          )
        )
        affected = results.filter((r) => r.ok).length
        break
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: {
        totalProcessed: ids.length,
        successful: affected,
        failed: ids.length - affected,
        results: { successful: ids, failed: [] },
      },
    })
  } catch (error) {
    console.error('[users/bulk] failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform bulk action', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
