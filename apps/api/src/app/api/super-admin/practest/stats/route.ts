// src/app/api/super-admin/practest/stats/route.ts
// Real platform-wide Practest stats for the super-admin console (replaces the
// previous hardcoded mock in the admin page). super_admin only.

import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestQuestionBank, practestTestConfigurations, practestTestSessions } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'

export async function GET() {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  try {
    const count = async (q: Promise<{ c: number }[]>) => Number((await q)[0]?.c ?? 0)

    const [totalQuestions, approvedQuestions, pendingReview, totalTests, totalSessions, activeUsers] =
      await Promise.all([
        count(db.select({ c: sql<number>`count(*)` }).from(practestQuestionBank)),
        count(db.select({ c: sql<number>`count(*)` }).from(practestQuestionBank).where(eq(practestQuestionBank.validationStatus, 'APPROVED'))),
        count(db.select({ c: sql<number>`count(*)` }).from(practestQuestionBank).where(eq(practestQuestionBank.validationStatus, 'PENDING_REVIEW'))),
        count(db.select({ c: sql<number>`count(*)` }).from(practestTestConfigurations)),
        count(db.select({ c: sql<number>`count(*)` }).from(practestTestSessions)),
        count(db.select({ c: sql<number>`count(distinct ${practestTestSessions.userId})` }).from(practestTestSessions)),
      ])

    return NextResponse.json({
      success: true,
      stats: { totalQuestions, approvedQuestions, pendingReview, totalTests, totalSessions, activeUsers },
    })
  } catch (error) {
    console.error('[practest/stats]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load Practest stats', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
