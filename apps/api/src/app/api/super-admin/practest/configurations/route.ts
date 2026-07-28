// src/app/api/super-admin/practest/configurations/route.ts
// Test-series (blueprint) authoring — list (GET) + create (POST). super_admin only.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestTestConfigurations as C } from '@/db/schema'
import { desc } from 'drizzle-orm'

type Row = typeof C.$inferSelect

export function toApi(r: Row) {
  return {
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? '',
    board: r.board ?? '',
    class_level: r.classLevel ?? null,
    subject: r.subject ?? '',
    chapters: (r.chapters as string[] | null) ?? [],
    topics: (r.topics as string[] | null) ?? [],
    total_questions: r.totalQuestions ?? 10,
    duration_minutes: r.durationMinutes ?? 20,
    max_marks: r.maxMarks ?? null,
    negative_marking: r.negativeMarking ?? 0,
    partial_marking: !!r.partialMarking,
    difficulty_distribution: (r.difficultyDistribution as Record<string, number> | null) ?? null,
    randomize_questions: !!r.randomizeQuestions,
    randomize_options: !!r.randomizeOptions,
    allow_review: !!r.allowReview,
    show_results_immediately: !!r.showResultsImmediately,
    instructions: r.instructions ?? '',
    is_active: !!r.isActive,
    is_public: !!r.isPublic,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }
}

export function toDb(b: Record<string, unknown>) {
  const s = (k: string) => (b[k] === undefined ? undefined : (b[k] as string))
  const n = (k: string) => (b[k] != null && b[k] !== '' ? Number(b[k]) : undefined)
  const bool = (k: string) => (b[k] != null ? !!b[k] : undefined)
  const arr = (k: string) => (Array.isArray(b[k]) ? (b[k] as string[]) : undefined)
  return {
    name: s('name'),
    description: s('description'),
    board: s('board'),
    classLevel: n('class_level'),
    subject: s('subject'),
    chapters: arr('chapters'),
    topics: arr('topics'),
    totalQuestions: n('total_questions'),
    durationMinutes: n('duration_minutes'),
    maxMarks: n('max_marks'),
    negativeMarking: n('negative_marking'),
    partialMarking: bool('partial_marking'),
    difficultyDistribution: (b.difficulty_distribution as Record<string, number> | undefined) ?? undefined,
    randomizeQuestions: bool('randomize_questions'),
    randomizeOptions: bool('randomize_options'),
    allowReview: bool('allow_review'),
    showResultsImmediately: bool('show_results_immediately'),
    instructions: s('instructions'),
    isActive: bool('is_active'),
    isPublic: bool('is_public'),
  }
}

export async function GET() {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  try {
    const rows = await db.select().from(C).orderBy(desc(C.createdAt))
    return NextResponse.json({ success: true, configurations: rows.map(toApi) })
  } catch (e) {
    console.error('[practest/configurations GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load test series' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  try {
    const body = await req.json()
    if (!body.name || !body.subject || !body.class_level) {
      return NextResponse.json({ success: false, error: 'name, subject and class_level are required' }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const values = toDb(body)
    await db.insert(C).values({
      ...values,
      id,
      organizationId: null,
      name: values.name ?? body.name,
      subject: values.subject ?? body.subject,
      totalQuestions: values.totalQuestions ?? 10,
      durationMinutes: values.durationMinutes ?? 20,
    })
    return NextResponse.json({ success: true, id })
  } catch (e) {
    console.error('[practest/configurations POST]', e)
    return NextResponse.json({ success: false, error: 'Failed to create test series' }, { status: 500 })
  }
}
