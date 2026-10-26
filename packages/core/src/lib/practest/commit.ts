// src/lib/practest/commit.ts
//
// The two server-side steps both question imports share (CSV upload: practest/import; the book's own MCQs from the
// library hub: practest/import-library): flag rows that already exist, and insert the new ones as DRAFT.

import { db } from '@/db'
import { practestQuestionBank as Q } from '@/db/schema'
import { and, inArray } from 'drizzle-orm'
import type { RowResult } from './import'
import { deriveLegacyFromOptions } from './options'

const normText = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Mark rows that already exist in the DB (same subject + class + question text) as duplicates. */
export async function flagDbDuplicates(rows: RowResult[]): Promise<void> {
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

/** Insert the `new` rows as platform-global DRAFT questions, in chunks. Returns how many were inserted. */
export async function insertNewRowsAsDraft(rows: RowResult[]): Promise<number> {
  const toInsert = rows.filter((r) => r.status === 'new' && r.question)
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
  let inserted = 0
  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200)
    await db.insert(Q).values(chunk)
    inserted += chunk.length
  }
  return inserted
}
