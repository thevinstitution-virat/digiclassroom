// src/app/api/plans/route.ts
// GET — active subscription plans for the pricing page (single source of truth:
// whatever super_admin defines in /dashboard/super-admin/plans drives this).

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { db } from '@/db'
import { subscriptionPlans as P } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await db.select().from(P).where(eq(P.isActive, true)).orderBy(asc(P.displayOrder))
    const plans = rows.map((r) => ({
      id: r.id,
      plan_code: r.planCode,
      name: r.displayName || r.planName,
      price: Number(r.monthlyPrice ?? 0),
      period: r.planCode === 'FREE_TRIAL' ? '7 days' : 'month',
      daily_questions: r.dailyQuestionLimit ?? 0,
      class_access: r.classAccessType === 'all' ? 'All classes' : '1 class',
      board_access: r.board === 'ALL' ? '1 board' : (r.board ?? '1 board'),
      features: (r.features as string[] | null) ?? [],
      description: r.description ?? '',
      highlight: r.highlightText ?? '',
      is_featured: !!r.isFeatured,
      display_order: r.displayOrder ?? 0,
    }))
    return NextResponse.json({ success: true, plans })
  } catch (e) {
    console.error('[plans GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load plans' }, { status: 500 })
  }
}
