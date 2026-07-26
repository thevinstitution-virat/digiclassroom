// src/app/api/super-admin/practest/import/route.ts
// Bulk question import (super_admin, platform-global). Two phases:
//   POST { mode:'validate', csv }  → parse + structural validate + DB de-dupe → preview
//   POST { mode:'commit',   csv }  → re-validate + insert NEW rows as DRAFT (never auto-approve)
//
// Server is authoritative — the client preview is convenience only; commit re-parses.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { practestQuestionBank as Q } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { parseAndValidate, type RowResult } from '@/lib/practest/import'
import { deriveLegacyFromOptions } from '@/lib/practest/options'

const MAX_ROWS = 2000

const normText = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Mark rows that already exist in the DB (same subject + class + question text) as duplicates. */
async function flagDbDuplicates(rows: RowResult[]): Promise<void> {
  const news = rows.filter((r) => r.status === 'new' && r.question)
  if (!news.length) return

  const subjects = [...new Set(news.map((r) => r.question!.subject).filter(Boolean) as string[])]
  const classes = [...new Set(news.map((r) => r.question!.class_level).filter((c): c is number => typeof c === 'number'))]
  if (!subjects.length || !classes.length) return

  const existing = await db
    .select({ subject: Q.subject, classLevel: Q.classLevel, questionText: Q.questionText })
    .from(Q)
    .where(and(inArray(Q.subject, subjects), inArray(Q.classLevel, classes)))

  const seen = new Set(existing.map((e) => `${normText(e.subject)}#${e.classLevel}#${normText(e.questionText)}`))
  for (const r of news) {
    const key = `${normText(r.question!.subject)}#${r.question!.class_level}#${normText(r.question!.question_text)}`
    if (seen.has(key)) {
      r.status = 'duplicate'
      r.errors = ['Already exists in the question bank']
    }
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  let body: { mode?: string; csv?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const mode = body.mode === 'commit' ? 'commit' : 'validate'
  const csv = typeof body.csv === 'string' ? body.csv : ''
  if (!csv.trim()) {
    return NextResponse.json({ success: false, error: 'No CSV content provided' }, { status: 400 })
  }

  try {
    const parsed = parseAndValidate(csv)
    if (parsed.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows found (need a header row + at least one question)' }, { status: 400 })
    }
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json({ success: false, error: `Too many rows (${parsed.rows.length}). Max ${MAX_ROWS} per import.` }, { status: 400 })
    }

    await flagDbDuplicates(parsed.rows)

    const summary = {
      total: parsed.rows.length,
      valid: parsed.rows.filter((r) => r.status === 'new').length,
      errors: parsed.rows.filter((r) => r.status === 'error').length,
      duplicates: parsed.rows.filter((r) => r.status === 'duplicate').length,
    }

    if (mode === 'validate') {
      return NextResponse.json({ success: true, mode, summary, rows: parsed.rows })
    }

    // ── commit ──────────────────────────────────────────────────────────────
    const toInsert = parsed.rows.filter((r) => r.status === 'new' && r.question)
    if (!toInsert.length) {
      return NextResponse.json({ success: true, mode, inserted: 0, skipped: summary.errors + summary.duplicates, summary })
    }

    const values = toInsert.map((r) => {
      const qn = r.question!
      const legacy = deriveLegacyFromOptions(qn.options)
      return {
        id: crypto.randomUUID(),
        organizationId: null, // platform-global
        questionText: qn.question_text,
        questionType: qn.type ?? 'MCQ',
        optionA: legacy.optionA, optionB: legacy.optionB, optionC: legacy.optionC, optionD: legacy.optionD,
        correctOption: legacy.correctOption,
        explanation: qn.explanation ?? null,
        maxMarks: qn.max_marks ?? 1,
        board: qn.board ?? null,
        classLevel: qn.class_level ?? null,
        subject: qn.subject ?? null,
        chapter: qn.chapter ?? null,
        topic: qn.topic ?? null,
        subtopic: qn.subtopic ?? null,
        difficultyLevel: qn.difficulty ?? 'MEDIUM',
        bloomLevel: qn.bloom ?? 'UNDERSTAND',
        casaBook: qn.casa_book ?? null,
        casaEdition: qn.casa_edition ?? null,
        casaPage: qn.casa_page ?? null,
        casaAnchor: qn.casa_anchor ?? null,
        validationStatus: 'DRAFT' as const,
      }
    })

    // Insert in chunks to keep statements bounded.
    let inserted = 0
    for (let i = 0; i < values.length; i += 200) {
      const chunk = values.slice(i, i + 200)
      await db.insert(Q).values(chunk)
      inserted += chunk.length
    }

    return NextResponse.json({
      success: true,
      mode,
      inserted,
      skipped: summary.errors + summary.duplicates,
      summary,
      note: 'Imported as DRAFT. Review and approve them in the Questions tab before students can see them.',
    })
  } catch (e) {
    console.error('[practest/import POST]', e)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}
