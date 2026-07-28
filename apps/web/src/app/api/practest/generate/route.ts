// src/app/api/practest/generate/route.ts
// Phase 2b: org-scoped, double-locked.
//   Lock 1: withOrgContext({ requireOrg: true })
//   Lock 2: practestQueries(orgId) factory — all DB ops are org-scoped
//
// Shuffle-safe (lib/practest/options.ts): question order AND option order are
// shuffled with Fisher–Yates, but each option carries a STABLE id, so scoring
// (by id) can never desync. Correctness (isCorrect) is NEVER sent to the client.
//
//   POST — generate a new practice test session
//   GET  — poll the status of an existing session (or report no active session)

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth/with-tenant-context';
import type { TenantContext } from '@/lib/db/tenant-scope';
import { practestQueries } from '@/lib/db/practest-queries';
import { presentOptions } from '@/lib/practest/options';
import { selectQuestions } from '@/lib/practest/selection';
import { practestDailyLimit } from '@/lib/practest/limits';
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service';

const SECONDS_PER_QUESTION = 90;

export const POST = withTenantContext(
  async (req: NextRequest, _ctx: unknown, orgContext: TenantContext) => {
    const { userId, orgId } = orgContext;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const configurationId = (body.configurationId ?? body.use_configuration_id) as string | undefined;

    try {
      const q = practestQueries(orgId);

      // ── Daily practice-test limit (plan-aware; trial = 5/day) ──────────────
      const sub = await subscriptionValidationService.getUserSubscription(userId);
      const dailyLimit = practestDailyLimit(sub?.plan_code);
      if (dailyLimit <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Start your free trial to create practice tests.',
            needsUpgrade: true,
            limit: 0,
            used: 0,
          },
          { status: 403 },
        );
      }
      const usedToday = await q.countTodaySessions(userId);
      if (usedToday >= dailyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `You've used all ${dailyLimit} practice tests for today. Your limit resets tomorrow.`,
            needsUpgrade: sub?.plan_code === 'FREE_TRIAL',
            limit: dailyLimit,
            used: usedToday,
          },
          { status: 429 },
        );
      }

      // If a test-series blueprint is referenced, use ITS scope as the defaults.
      const cfg = configurationId ? await q.getFullConfigById(configurationId) : null;
      const cfgTopics = (cfg?.topics as string[] | null) ?? null;

      // Accept both the new (subject/grade/questionCount) and legacy
      // (class_level/total_questions/topics[]) field names; fall back to the blueprint.
      const gradeRaw = (body.grade ?? body.class_level ?? cfg?.classLevel) as number | string | undefined;
      const board = (body.board as string | undefined) ?? cfg?.board ?? undefined;
      const difficulty = body.difficulty as string | undefined;
      const topic =
        (body.topic as string | undefined) ??
        (Array.isArray(body.topics) ? (body.topics[0] as string | undefined) : undefined) ??
        (cfgTopics && cfgTopics.length ? cfgTopics[0] : undefined);
      const chapters = Array.isArray(body.chapters)
        ? (body.chapters as unknown[]).map(String).filter(Boolean)
        : [];

      // Multi-subject (mixed tests): subjects[] wins; else a single subject (body or blueprint).
      const subjects =
        Array.isArray(body.subjects) && body.subjects.length
          ? (body.subjects as unknown[]).map(String).filter(Boolean)
          : (body.subject as string | undefined)
            ? [body.subject as string]
            : cfg?.subject
              ? [cfg.subject]
              : [];

      const questionCount = Math.max(
        1,
        Math.min(100, Number(body.questionCount ?? body.total_questions ?? cfg?.totalQuestions ?? 10)),
      );
      const randomizeOptions = cfg ? cfg.randomizeOptions !== false : true;
      const durationSeconds = cfg?.durationMinutes
        ? cfg.durationMinutes * 60
        : questionCount * SECONDS_PER_QUESTION;

      if (!subjects.length || !gradeRaw) {
        return NextResponse.json(
          {
            success: false,
            error: 'At least one subject and a class are required (or reference a configured test series)',
          },
          { status: 400 },
        );
      }

      const gradeNum = Number(gradeRaw);
      const distribution =
        (body.difficulty_distribution as Record<string, number> | undefined) ??
        ((cfg?.difficultyDistribution as Record<string, number> | null) ?? null);

      const selected = await selectQuestions(
        {
          subjects,
          questionCount,
          distribution,
          difficulty,
          base: { grade: gradeNum, board: board ?? undefined, topic: topic ?? undefined, chapters },
        },
        (filter) => q.getQuestions(filter),
      );

      if (selected.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No approved questions available for the selected criteria' },
          { status: 404 },
        );
      }

      const selectedIds = selected.map((s) => s.id);

      const sessionId = await q.createSession({
        userId,
        configurationId: configurationId ?? undefined,
        selectedQuestions: selectedIds,
      });

      return NextResponse.json(
        {
          success: true,
          sessionId,
          questions: selected.map((qq) => ({
            id: qq.id,
            questionText: qq.question_text,
            questionType: qq.question_type ?? 'MCQ',
            // Shuffled options, each with a stable id — isCorrect deliberately excluded.
            options: presentOptions(qq.options_array, randomizeOptions),
            subject: qq.subject,
            grade: qq.grade,
            difficulty: qq.difficulty,
            topic: qq.topic,
            maxMarks: qq.max_marks ?? 1,
          })),
          totalQuestions: selected.length,
          durationSeconds,
          status: 'in_progress',
        },
        { status: 201 },
      );
    } catch (err) {
      console.error('[practest/generate POST]', err);
      return NextResponse.json(
        { success: false, error: 'Failed to generate practice test' },
        { status: 500 },
      );
    }
  },
);

// ── GET /api/practest/generate?sessionId= ────────────────────────────────────
// With sessionId: return that session's status. Without: report no active session
// (used by the client on mount — must not 400).

export const GET = withTenantContext(
  async (req: NextRequest, _ctx: unknown, orgContext: TenantContext) => {
    const { userId, orgId } = orgContext;
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ success: true, activeSessions: 0, sessions: [] });
    }

    try {
      const q = practestQueries(orgId);
      const session = await q.getSessionById(sessionId);

      if (!session) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }

      if (
        session.user_id !== userId &&
        !orgContext.isPlatformBypass &&
        orgContext.orgRole !== 'owner' &&
        orgContext.orgRole !== 'org_admin'
      ) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        sessionId: session.id,
        status: session.status,
        score: session.score,
        startedAt: session.started_at,
        completedAt: session.completed_at,
      });
    } catch (err) {
      console.error('[practest/generate GET]', err);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch session status' },
        { status: 500 },
      );
    }
  },
);
