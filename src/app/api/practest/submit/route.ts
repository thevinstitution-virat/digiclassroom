// src/app/api/practest/submit/route.ts
// Org-scoped, double-locked. Server-authoritative scoring (never trusts a client score).
//
// Shuffle-safe: the client submits the OPTION ID it received (options were shuffled
// for display, but the id is stable). scoreAnswer() matches by id against the
// canonical options straight from the DB, so display order is irrelevant and the
// answer can never desync. Legacy letter/text submissions still score correctly.
//
//   POST — evaluate a single answer (returns correctness + explanation)
//   PUT  — complete the session: recompute the whole score + analytics server-side

import { NextRequest, NextResponse } from 'next/server';
import { withOrgContext } from '@/lib/auth/with-org-context';
import type { OrgContext } from '@/lib/auth/get-org-context';
import { practestQueries } from '@/lib/db/practest-queries';
import { scoreAnswer } from '@/lib/practest/options';
import { db } from '@/db';
import { practestAttemptEvents } from '@/db/schema';

export const POST = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    const { userId, orgId } = orgContext;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const sessionId = (body.sessionId ?? body.session_id) as string | undefined;
    const questionId = (body.questionId ?? body.question_id) as string | undefined;
    const answer = body.answer as string | string[] | undefined;

    if (!sessionId || !questionId || answer === undefined) {
      return NextResponse.json(
        { success: false, error: 'sessionId, questionId, and answer are required' },
        { status: 400 },
      );
    }

    try {
      const q = practestQueries(orgId);

      const session = await q.getSessionById(sessionId);
      if (!session || session.user_id !== userId) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }
      if (session.status !== 'in_progress') {
        return NextResponse.json({ success: false, error: `Session is already ${session.status}` }, { status: 409 });
      }

      const question = await q.getQuestionById(questionId);
      if (!question) {
        return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
      }

      let selectedIds: string[] = [];
      try {
        selectedIds = JSON.parse(session.selected_questions);
      } catch {
        return NextResponse.json({ success: false, error: 'Malformed session data' }, { status: 500 });
      }
      if (!selectedIds.includes(questionId)) {
        return NextResponse.json({ success: false, error: 'Question is not part of this session' }, { status: 400 });
      }

      const score = scoreAnswer(question.options_array, answer);

      return NextResponse.json({
        success: true,
        questionId,
        isCorrect: score.isCorrect,
        correctOptionIds: score.correctOptionIds,
        correctAnswer: score.correctText,
        explanation: question.explanation ?? null,
        submitted: answer,
      });
    } catch (err) {
      console.error('[practest/submit POST]', err);
      return NextResponse.json({ success: false, error: 'Failed to submit answer' }, { status: 500 });
    }
  },
  { requireOrg: true },
);

// ── PUT /api/practest/submit ──────────────────────────────────────────────────
// Complete a session. Recomputes everything server-side from the answers map.

export const PUT = withOrgContext(
  async (req: NextRequest, _ctx: unknown, orgContext: OrgContext) => {
    const { userId, orgId } = orgContext;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const sessionId = (body.sessionId ?? body.session_id) as string | undefined;
    const answers = (body.answers ?? {}) as Record<string, string | string[]>;
    const times = (body.times ?? {}) as Record<string, number>;

    if (!sessionId || typeof answers !== 'object') {
      return NextResponse.json({ success: false, error: 'sessionId and answers map are required' }, { status: 400 });
    }

    try {
      const q = practestQueries(orgId);

      const session = await q.getSessionById(sessionId);
      if (!session || session.user_id !== userId) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }
      if (session.status !== 'in_progress') {
        return NextResponse.json({ success: false, error: `Session is already ${session.status}` }, { status: 409 });
      }

      // Score every question that belongs to the session (not just answered ones),
      // so unanswered questions count toward the max and are recorded as skipped.
      let selectedIds: string[] = [];
      try {
        selectedIds = JSON.parse(session.selected_questions);
      } catch {
        selectedIds = Object.keys(answers);
      }

      let negativeMarking = 0;
      if (session.configuration_id) {
        const cfg = await q.getConfigById(session.configuration_id);
        if (cfg) negativeMarking = cfg.negative_marking ?? 0;
      }

      let correct = 0;
      let total = 0;
      let totalScore = 0;
      let maxPossibleScore = 0;
      const questionResults: Array<{
        questionId: string; questionText: string | null; yourAnswerText: string;
        correctAnswerText: string; isCorrect: boolean; marksAwarded: number; maxMarks: number;
        difficulty: string | null; topic: string | null; explanation: string | null;
        timeSpentSeconds: number | null;
      }> = [];
      const events: (typeof practestAttemptEvents.$inferInsert)[] = [];

      for (const questionId of selectedIds) {
        const question = await q.getQuestionById(questionId);
        if (!question) continue;

        total++;
        const maxMarks = question.max_marks ?? 1;
        maxPossibleScore += maxMarks;

        const submitted = answers[questionId];
        const skipped =
          submitted == null ||
          (Array.isArray(submitted) ? submitted.length === 0 : String(submitted).trim() === '');

        const score = scoreAnswer(question.options_array, skipped ? null : submitted);
        const isCorrect = score.isCorrect;

        let marksAwarded = 0;
        if (isCorrect) {
          marksAwarded = maxMarks;
          correct++;
        } else if (!skipped) {
          marksAwarded = -negativeMarking;
        }
        totalScore += marksAwarded;

        const yourAnswerText = skipped
          ? ''
          : question.options_array.find((o) => o.id === String(submitted))?.text ?? String(submitted);

        questionResults.push({
          questionId,
          questionText: question.question_text,
          yourAnswerText,
          correctAnswerText: score.correctText,
          isCorrect,
          marksAwarded,
          maxMarks,
          difficulty: question.difficulty,
          topic: question.topic,
          explanation: question.explanation,
          timeSpentSeconds: times?.[questionId] ?? null,
        });

        events.push({
          id: crypto.randomUUID(),
          organizationId: orgId === 'system' ? null : orgId,
          sessionId,
          questionId,
          userId,
          selectedAnswer: skipped ? null : String(submitted),
          isCorrect,
          marksAwarded,
          timeSpentSeconds: times?.[questionId] ?? null,
        });

        if (!skipped) await q.bumpQuestionStats(questionId, isCorrect);
      }

      if (events.length) await db.insert(practestAttemptEvents).values(events);

      totalScore = Math.round(totalScore);
      const percentage =
        maxPossibleScore > 0 ? Math.round((Math.max(0, totalScore) / maxPossibleScore) * 100) : 0;

      await q.completeSession(sessionId, { totalScore, maxPossibleScore, percentage });

      // Topic + difficulty breakdowns (derived from this session's results).
      const topicPerformance = aggregate(questionResults, (r) => r.topic || 'General');
      const difficultyPerformance = aggregate(questionResults, (r) => r.difficulty || 'MEDIUM');

      return NextResponse.json({
        success: true,
        sessionId,
        score: percentage,
        totalScore,
        maxPossibleScore,
        percentage,
        correct,
        total,
        negativeMarking,
        questionResults,
        topicPerformance,
        difficultyPerformance,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[practest/submit PUT]', err);
      return NextResponse.json({ success: false, error: 'Failed to complete test session' }, { status: 500 });
    }
  },
  { requireOrg: true },
);

function aggregate(
  results: Array<{ isCorrect: boolean; [k: string]: unknown }>,
  keyFn: (r: any) => string,
): Array<{ key: string; attempted: number; correct: number; accuracy: number }> {
  const map = new Map<string, { attempted: number; correct: number }>();
  for (const r of results) {
    const k = keyFn(r);
    const cur = map.get(k) ?? { attempted: 0, correct: 0 };
    cur.attempted++;
    if (r.isCorrect) cur.correct++;
    map.set(k, cur);
  }
  return [...map.entries()].map(([key, v]) => ({
    key,
    attempted: v.attempted,
    correct: v.correct,
    accuracy: v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
  }));
}
