// src/app/api/practest/curriculum/route.ts
// Real curriculum tree (subjects → chapters → topics) for a grade/board, sourced
// from APPROVED questions in this org's pool. Taxonomy-as-data: the generator only
// offers values that actually have questions, eliminating "typo → no questions" gaps.

import { NextRequest, NextResponse } from 'next/server'
import { withOrgContext } from '@/lib/auth/with-org-context'
import type { OrgContext } from '@/lib/auth/get-org-context'
import { practestQueries } from '@/lib/db/practest-queries'

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    try {
      const gradeRaw = req.nextUrl.searchParams.get('grade')
      const board = req.nextUrl.searchParams.get('board')
      const q = practestQueries(orgContext.orgId)
      const rows = await q.getCurriculum({
        grade: gradeRaw ? Number(gradeRaw) : undefined,
        board: board || undefined,
      })

      const subjects = [...new Set(rows.map((r) => r.subject).filter(Boolean) as string[])].sort()
      const chaptersBySubject: Record<string, Set<string>> = {}
      const topicsByChapter: Record<string, Set<string>> = {}
      for (const r of rows) {
        if (r.subject && r.chapter) (chaptersBySubject[r.subject] ??= new Set()).add(r.chapter)
        if (r.chapter && r.topic) (topicsByChapter[r.chapter] ??= new Set()).add(r.topic)
      }
      const flatten = (m: Record<string, Set<string>>) =>
        Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()]))

      return NextResponse.json({
        success: true,
        subjects,
        chapters: flatten(chaptersBySubject),
        topics: flatten(topicsByChapter),
      })
    } catch (err) {
      console.error('[practest/curriculum GET]', err)
      return NextResponse.json({ success: false, error: 'Failed to load curriculum' }, { status: 500 })
    }
  },
  { requireOrg: true },
)
