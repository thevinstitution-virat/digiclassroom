// src/app/api/super-admin/practest/import-library/route.ts
// Import the book's own multiple-choice questions from the library hub (super_admin, platform-global). Like the CSV
// import, two phases, and the server is authoritative:
//   POST { mode:'validate', workId, chapterNo?, board?, classLevel?, subject? } → preview + what could not be read
//   POST { mode:'commit',   ... }                                              → insert NEW rows as DRAFT
//
// The questions come from `library.practice_item` (options printed as `Choices: a-d`) and the printed answers from
// `library.answer` (evaluator role). Each row's casa_anchor is the block's passage id. Needs LIBRARY_HUB_ENABLED and
// the library read URLs (lib/library/db.ts); answers 404 while the hub is off.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { libraryHubEnabled } from '@/lib/library/search'
import { mcqSources, publishedWork } from '@/lib/library/db'
import { scopeFromPlacements, toImportCsv, toPracticestRows, type PracticestScope } from '@/lib/library/practice-mcq'
import { parseAndValidate } from '@/lib/practest/import'
import { flagDbDuplicates, insertNewRowsAsDraft } from '@/lib/practest/commit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Body { mode?: string; workId?: string; chapterNo?: number; board?: string; classLevel?: number; subject?: string }

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response
  if (!libraryHubEnabled()) return NextResponse.json({ success: false, error: 'The library hub is not enabled (LIBRARY_HUB_ENABLED)' }, { status: 404 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const mode = body.mode === 'commit' ? 'commit' : 'validate'
  if (typeof body.workId !== 'string' || !UUID.test(body.workId)) {
    return NextResponse.json({ success: false, error: 'workId (a library work id) is required' }, { status: 400 })
  }
  if (body.chapterNo !== undefined && (!Number.isInteger(body.chapterNo) || body.chapterNo < 0)) {
    return NextResponse.json({ success: false, error: 'chapterNo must be a whole number' }, { status: 400 })
  }

  try {
    const work = await publishedWork(body.workId)
    if (!work) return NextResponse.json({ success: false, error: 'No published work with that id' }, { status: 404 })

    const fromPlacements = scopeFromPlacements(work.placements, work.medium)
    const scope: PracticestScope | null = {
      board: body.board?.trim() || fromPlacements?.board || '',
      classLevel: body.classLevel ?? fromPlacements?.classLevel ?? 0,
      subject: body.subject?.trim() || fromPlacements?.subject || '',
      language: work.medium === 'hi' ? 'Hindi' : 'English',
    }
    if (!scope.board || !scope.classLevel || !scope.subject) {
      return NextResponse.json({
        success: false,
        error: 'The work has no school placement to take board, class and subject from: pass board, classLevel and subject',
        placements: work.placements,
      }, { status: 400 })
    }

    const sources = await mcqSources(work.id, body.chapterNo ?? null)
    const { rows, problems } = toPracticestRows(sources, scope)
    const summaryBase = { questionsWithOptions: sources.length, readable: rows.length, notImported: problems.length }
    if (rows.length === 0) {
      return NextResponse.json({ success: true, mode, summary: { ...summaryBase, total: 0, valid: 0, errors: 0, duplicates: 0 }, rows: [], problems, inserted: 0 })
    }

    const parsed = parseAndValidate(toImportCsv(rows))
    await flagDbDuplicates(parsed.rows)
    const summary = {
      ...summaryBase,
      total: parsed.rows.length,
      valid: parsed.rows.filter((r) => r.status === 'new').length,
      errors: parsed.rows.filter((r) => r.status === 'error').length,
      duplicates: parsed.rows.filter((r) => r.status === 'duplicate').length,
    }
    if (mode === 'validate') return NextResponse.json({ success: true, mode, scope, summary, rows: parsed.rows, problems })

    const inserted = await insertNewRowsAsDraft(parsed.rows)
    return NextResponse.json({
      success: true, mode, scope, inserted, skipped: summary.errors + summary.duplicates, summary, problems,
      note: 'Imported as DRAFT. Review and approve them in the Questions tab before students can see them.',
    })
  } catch (e) {
    console.error('[practest/import-library POST]', e)
    return NextResponse.json({ success: false, error: 'Library import failed' }, { status: 500 })
  }
}
