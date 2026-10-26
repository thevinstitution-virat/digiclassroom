// src/app/api/super-admin/practest/import/route.ts
// Bulk question import (super_admin, platform-global). Two phases:
//   POST { mode:'validate', csv }  → parse + structural validate + DB de-dupe → preview
//   POST { mode:'commit',   csv }  → re-validate + insert NEW rows as DRAFT (never auto-approve)
//
// Server is authoritative — the client preview is convenience only; commit re-parses.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { parseAndValidate } from '@/lib/practest/import'
import { flagDbDuplicates, insertNewRowsAsDraft } from '@/lib/practest/commit'

const MAX_ROWS = 2000

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

    const inserted = await insertNewRowsAsDraft(toInsert)

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
