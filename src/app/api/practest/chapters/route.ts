// src/app/api/practest/chapters/route.ts
// Phase 2b: Was returning hardcoded static mock data with no auth at all.
// Double-lock applied:
//   Lock 1: withOrgContext({ requireOrg: true })
//   Lock 2: Derives available subjects/chapters from this org's materials
//           (falls back to NCERT standard chapter list if no materials ingested yet)
//
// Why this matters: returning a static chapter list leaks curriculum structure
// regardless of what the org has actually uploaded. Now the list reflects
// what this org's students can actually be tested on.

import { NextRequest, NextResponse } from 'next/server';
import { withOrgContext } from '@/lib/auth/with-org-context';
import type { OrgContext } from '@/lib/auth/get-org-context';
import { db } from '@/db';
import { materials } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

// NCERT standard subject list — used as fallback when org has no materials yet
// This is public curriculum data, not org-specific content
const NCERT_SUBJECTS_BY_GRADE: Record<number, string[]> = {
  6:  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
  7:  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
  8:  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
  9:  ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
  10: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
  11: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Economics', 'Accountancy', 'Business Studies'],
  12: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Economics', 'Accountancy', 'Business Studies'],
};

// ── GET /api/practest/chapters ────────────────────────────────────────────────
// Returns available subjects and grades for this org.
// ?grade=10 filters to a specific grade.

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    const { orgId, isPlatformBypass } = orgContext;
    const { searchParams } = req.nextUrl;
    const gradeParam = searchParams.get('grade');
    const grade = gradeParam ? parseInt(gradeParam, 10) : undefined;

    try {
      // ── Lock 2: derive chapter list from org's own ingested materials ──────
      const conditions = [];

      if (!isPlatformBypass) {
        conditions.push(eq(materials.organizationId, orgId));
      }
      if (grade !== undefined && !isNaN(grade)) {
        conditions.push(eq(materials.class, grade));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Aggregate available subjects and grades from this org's materials
      const orgSubjects = await db
        .select({
          grade:   materials.class,
          subject: materials.subject,
          count:   sql<number>`count(*)`,
        })
        .from(materials)
        .where(where)
        .groupBy(materials.class, materials.subject)
        .orderBy(materials.class, materials.subject);

      // If org has ingested materials, return their actual subjects
      if (orgSubjects.length > 0) {
        // Group by grade
        const byGrade: Record<number, { subject: string; materialCount: number }[]> = {};
        for (const row of orgSubjects) {
          if (!row.grade) continue;
          if (!byGrade[row.grade]) byGrade[row.grade] = [];
          byGrade[row.grade].push({
            subject:       row.subject ?? 'Unknown',
            materialCount: Number(row.count),
          });
        }

        return NextResponse.json({
          source: 'org_materials',
          grades: Object.entries(byGrade).map(([g, subjects]) => ({
            grade:    parseInt(g, 10),
            subjects,
          })),
        });
      }

      // ── Fallback: NCERT standard subjects (public curriculum data) ─────────
      // Org has no materials yet — return the standard NCERT list so the UI
      // isn't empty. Students can still be tested on platform-global questions.
      const grades = grade
        ? [grade]
        : Object.keys(NCERT_SUBJECTS_BY_GRADE).map(Number);

      return NextResponse.json({
        source: 'ncert_standard',
        note:   'No materials ingested yet — showing standard NCERT curriculum',
        grades: grades.map((g) => ({
          grade:    g,
          subjects: (NCERT_SUBJECTS_BY_GRADE[g] ?? []).map((s) => ({
            subject:       s,
            materialCount: 0,
          })),
        })),
      });

    } catch (err) {
      console.error('[practest/chapters GET]', err);
      return NextResponse.json(
        { error: 'Failed to fetch chapter data' },
        { status: 500 },
      );
    }
  },
  { requireOrg: true },
);
