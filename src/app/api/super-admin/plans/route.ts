// src/app/api/super-admin/plans/route.ts
// Subscription plan management (super_admin). GET list (all) + POST create.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { subscriptionPlans as P } from '@/db/schema'
import { asc } from 'drizzle-orm'

type Row = typeof P.$inferSelect

export function toApi(r: Row) {
  return {
    id: r.id,
    plan_name: r.planName,
    plan_code: r.planCode,
    plan_type: r.planType,
    board: r.board,
    class_level: r.classLevel ?? null,
    class_access_type: r.classAccessType,
    included_subjects: (r.includedSubjects as string[] | null) ?? null,
    monthly_price: Number(r.monthlyPrice ?? 0),
    quarterly_price: r.quarterlyPrice != null ? Number(r.quarterlyPrice) : null,
    yearly_price: r.yearlyPrice != null ? Number(r.yearlyPrice) : null,
    daily_question_limit: r.dailyQuestionLimit ?? 0,
    features: (r.features as string[] | null) ?? [],
    display_name: r.displayName,
    description: r.description ?? '',
    highlight_text: r.highlightText ?? '',
    display_order: r.displayOrder ?? 0,
    is_active: !!r.isActive,
    is_featured: !!r.isFeatured,
  }
}

const BOARDS = ['CBSE', 'ICSE', 'STATE_BOARD', 'ALL', 'State']
const PLAN_TYPES = ['free_trial', 'board_access', 'class_access', 'subject_bundle', 'full_access']
const CLASS_ACCESS = ['single', 'all']

export function toDb(b: Record<string, unknown>) {
  const s = (k: string) => (b[k] === undefined ? undefined : (b[k] as string))
  const n = (k: string) => (b[k] != null && b[k] !== '' ? Number(b[k]) : undefined)
  const bool = (k: string) => (b[k] != null ? !!b[k] : undefined)
  const enumOr = (k: string, allowed: string[], fallback?: string) => {
    const v = b[k] as string | undefined
    if (v === undefined) return undefined
    return allowed.includes(v) ? v : fallback
  }
  return {
    planName: s('plan_name'),
    planCode: s('plan_code'),
    planType: enumOr('plan_type', PLAN_TYPES, 'class_access') as any,
    board: enumOr('board', BOARDS, 'ALL') as any,
    classLevel: n('class_level'),
    classAccessType: enumOr('class_access_type', CLASS_ACCESS, 'single') as any,
    includedSubjects: Array.isArray(b.included_subjects) ? (b.included_subjects as string[]) : undefined,
    monthlyPrice: b.monthly_price != null ? String(Number(b.monthly_price)) : undefined,
    quarterlyPrice: b.quarterly_price != null && b.quarterly_price !== '' ? String(Number(b.quarterly_price)) : undefined,
    yearlyPrice: b.yearly_price != null && b.yearly_price !== '' ? String(Number(b.yearly_price)) : undefined,
    dailyQuestionLimit: n('daily_question_limit'),
    features: Array.isArray(b.features) ? (b.features as string[]) : undefined,
    displayName: s('display_name'),
    description: s('description'),
    highlightText: s('highlight_text'),
    displayOrder: n('display_order'),
    isActive: bool('is_active'),
    isFeatured: bool('is_featured'),
  }
}

export async function GET() {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  try {
    const rows = await db.select().from(P).orderBy(asc(P.displayOrder))
    return NextResponse.json({ success: true, plans: rows.map(toApi) })
  } catch (e) {
    console.error('[super-admin/plans GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load plans' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  try {
    const body = await req.json()
    if (!body.plan_name || !body.plan_code || !body.display_name) {
      return NextResponse.json({ success: false, error: 'plan_name, plan_code and display_name are required' }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const values = toDb(body)
    await db.insert(P).values({
      ...values,
      id,
      planName: values.planName ?? body.plan_name,
      planCode: values.planCode ?? body.plan_code,
      displayName: values.displayName ?? body.display_name,
      planType: values.planType ?? 'class_access',
      board: values.board ?? 'ALL',
      monthlyPrice: values.monthlyPrice ?? '0',
    })
    return NextResponse.json({ success: true, id })
  } catch (e: any) {
    console.error('[super-admin/plans POST]', e)
    if (e?.message?.includes('Duplicate')) {
      return NextResponse.json({ success: false, error: 'A plan with that code or name already exists' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: 'Failed to create plan' }, { status: 500 })
  }
}
