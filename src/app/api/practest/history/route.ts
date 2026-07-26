// src/app/api/practest/history/route.ts
// Phase 2b: Previously used raw getSession with no org context.
// Double-lock applied:
//   Lock 1: withOrgContext({ requireOrg: true })
//   Lock 2: practestQueries(orgId).getSessionsByUser() — org-scoped session list

import { NextRequest, NextResponse } from 'next/server';
import { withOrgContext } from '@/lib/auth/with-org-context';
import type { OrgContext } from '@/lib/auth/get-org-context';
import { practestQueries } from '@/lib/db/practest-queries';

// ── GET /api/practest/history ─────────────────────────────────────────────────
// Returns the current user's test session history.
// org_admin / owner can optionally pass ?userId= to view another user's history.
// super_admin sees everything via practestQueries(null).

export const GET = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    const { userId, orgId, orgRole, isPlatformBypass } = orgContext;
    const { searchParams } = req.nextUrl;

    // Admins can query any user's history within their org
    const canQueryOthers =
      isPlatformBypass ||
      orgRole === 'owner' ||
      orgRole === 'org_admin';

    const targetUserId = canQueryOthers
      ? (searchParams.get('userId') ?? userId)
      : userId;  // students and teachers only see their own history

    // super_admin gets an unscoped view (null orgId = see all orgs)
    const effectiveOrgId = isPlatformBypass ? null : orgId;

    try {
      // ── Lock 2: org-scoped session retrieval ──────────────────────────────
      const q = practestQueries(effectiveOrgId);
      const sessions = await q.getSessionsByUser(targetUserId);

      return NextResponse.json({
        sessions: sessions.map((s) => ({
          sessionId:   s.id,
          status:      s.status,
          score:       s.score,
          startedAt:   s.started_at,
          completedAt: s.completed_at,
          // selectedQuestions count — don't return the full array to the history list
          questionCount: (() => {
            try {
              return JSON.parse(s.selected_questions).length;
            } catch {
              return 0;
            }
          })(),
        })),
        total: sessions.length,
      });

    } catch (err) {
      console.error('[practest/history GET]', err);
      return NextResponse.json(
        { error: 'Failed to fetch test history' },
        { status: 500 },
      );
    }
  },
  { requireOrg: true },
);
