// src/app/api/super-admin/practest/questions/route.ts
// Super-admin question bank: list (GET) + create (POST). Platform-wide (super_admin only).

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestQuestionBank as Q } from '@/db/schema'
import { and, eq, like, or, desc, sql, type SQL } from 'drizzle-orm'

type Row = typeof Q.$inferSelect

// DB row → the snake_case shape the admin components (PractestQuestion) expect.
export function toApi(r: Row) {
  return {
    id: r.id,
    question_text: r.questionText ?? '',
    question_type: r.questionType ?? 'MCQ',
    option_a: r.optionA ?? '', option_b: r.optionB ?? '', option_c: r.optionC ?? '', option_d: r.optionD ?? '',
    correct_option: r.correctOption ?? 'A',
    model_answer: r.modelAnswer ?? '',
    explanation: r.explanation ?? '',
    max_marks: r.maxMarks ?? 1,
    time_limit_seconds: r.timeLimitSeconds ?? 120,
    has_math_content: !!r.hasMathContent, has_chemical_formulas: !!r.hasChemicalFormulas, has_diagrams: !!r.hasDiagrams,
    board: r.board ?? 'CBSE',
    class_level: r.classLevel ?? 0,
    subject: r.subject ?? '',
    chapter: r.chapter ?? '',
    topic: r.topic ?? '',
    subtopic: r.subtopic ?? '',
    difficulty_level: r.difficultyLevel ?? 'MEDIUM',
    bloom_level: r.bloomLevel ?? 'UNDERSTAND',
    usage_count: r.usageCount ?? 0,
    correct_attempts: r.correctAttempts ?? 0,
    total_attempts: r.totalAttempts ?? 0,
    average_time_seconds: r.averageTimeSeconds ?? 0,
    validation_status: r.validationStatus ?? 'DRAFT',
    casa_book: r.casaBook ?? '',
    casa_edition: r.casaEdition ?? '',
    casa_page: r.casaPage ?? null,
    casa_anchor: r.casaAnchor ?? '',
    casa_verified: !!r.casaVerified,
    organization_id: r.organizationId ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }
}

// snake_case form body → Drizzle insert/update values.
export function toDb(b: Record<string, unknown>) {
  const s = (k: string) => (b[k] === undefined ? undefined : (b[k] as string))
  return {
    questionText: s('question_text'),
    questionType: s('question_type'),
    optionA: s('option_a'), optionB: s('option_b'), optionC: s('option_c'), optionD: s('option_d'),
    correctOption: s('correct_option'),
    modelAnswer: s('model_answer'),
    explanation: s('explanation'),
    maxMarks: b.max_marks != null ? Number(b.max_marks) : undefined,
    timeLimitSeconds: b.time_limit_seconds != null ? Number(b.time_limit_seconds) : undefined,
    hasMathContent: b.has_math_content != null ? !!b.has_math_content : undefined,
    hasChemicalFormulas: b.has_chemical_formulas != null ? !!b.has_chemical_formulas : undefined,
    hasDiagrams: b.has_diagrams != null ? !!b.has_diagrams : undefined,
    board: s('board'),
    classLevel: b.class_level != null ? Number(b.class_level) : undefined,
    subject: s('subject'),
    chapter: s('chapter'),
    topic: s('topic'),
    subtopic: s('subtopic'),
    difficultyLevel: s('difficulty_level'),
    bloomLevel: s('bloom_level'),
    validationStatus: s('validation_status'),
    casaBook: s('casa_book'),
    casaEdition: s('casa_edition'),
    casaPage: (b.casa_page != null && b.casa_page !== '') ? Number(b.casa_page) : undefined,
    casaAnchor: s('casa_anchor'),
    casaVerified: b.casa_verified != null ? !!b.casa_verified : undefined,
  }
}

export async function GET(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20')))
  const offset = (page - 1) * limit
  const search = (sp.get('search') || '').trim()
  const board = sp.get('board'); const subject = sp.get('subject')
  const cls = sp.get('class'); const status = sp.get('status'); const difficulty = sp.get('difficulty')

  try {
    const conds: SQL[] = []
    if (search) { const v = `%${search}%`; conds.push(or(like(Q.questionText, v), like(Q.subject, v), like(Q.chapter, v))!) }
    if (board && board !== 'ALL') conds.push(eq(Q.board, board))
    if (subject) conds.push(eq(Q.subject, subject))
    if (cls && cls !== 'ALL') conds.push(eq(Q.classLevel, Number(cls)))
    if (status && status !== 'ALL') conds.push(eq(Q.validationStatus, status))
    if (difficulty && difficulty !== 'ALL') conds.push(eq(Q.difficultyLevel, difficulty))
    const where = conds.length ? and(...conds) : undefined

    const [c] = await db.select({ n: sql<number>`count(*)` }).from(Q).where(where)
    const rows = await db.select().from(Q).where(where).orderBy(desc(Q.createdAt)).limit(limit).offset(offset)

    return NextResponse.json({ success: true, questions: rows.map(toApi), total: Number(c?.n ?? 0), page, limit })
  } catch (e) {
    console.error('[practest/questions GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load questions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  try {
    const body = await req.json()
    if (!body.question_text || !body.subject) {
      return NextResponse.json({ success: false, error: 'question_text and subject are required' }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const values = toDb(body)
    await db.insert(Q).values({
      ...values,
      id,
      organizationId: null, // super_admin creates platform-global questions
      questionText: values.questionText ?? body.question_text,
      subject: values.subject ?? body.subject,
      validationStatus: values.validationStatus ?? 'DRAFT',
    })
    return NextResponse.json({ success: true, id })
  } catch (e) {
    console.error('[practest/questions POST]', e)
    return NextResponse.json({ success: false, error: 'Failed to create question' }, { status: 500 })
  }
}
