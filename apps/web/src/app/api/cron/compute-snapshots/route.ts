import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  enrollments,
  learningEvents,
  studentEngagementSnapshots,
  studentYearlyGrowth,
  studentVideoProgress,
  batches,
  videoAssets,
} from '@/db/schema';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { computeEngagementScore, computeRiskScore } from '@/lib/analytics';

const CHUNK_SIZE = 200;

// FIX #3 — ISO week Monday (not Sunday).
// A Sunday run and a Monday run must hash to the same weekOf key.
function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const backDays = dow === 0 ? 6 : dow - 1; // distance to preceding Monday
  d.setUTCDate(d.getUTCDate() - backDays);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  // FIX #1 — auth guard (already correct in scaffold; kept verbatim)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const weekOfDate = isoWeekMonday(today); // FIX #3 — Date object for Drizzle
  const weekOf = weekOfDate.toISOString().split('T')[0]; // string for JSON response only
  const isBackfill = req.nextUrl.searchParams.get('backfill') === 'true';

  // 28-day lookback window for event queries
  const windowStart = new Date(today);
  windowStart.setUTCDate(today.getUTCDate() - 28);

  try {
    // ── STEP 1: fetch ALL active enrollments (lean select — no event data yet) ──
    const allEnrollments = await db
      .select({
        userId: enrollments.userId,
        batchId: enrollments.batchId,
        orgId: enrollments.orgId, // FIX #6 — needed for snapshot insert
      })
      .from(enrollments)
      .where(eq(enrollments.status, 'active'));

    let snapshotsProcessed = 0;

    // ── STEP 2: process in chunks ──────────────────────────────────────────────
    // FIX #5 — never pull all enrollments' events in one query.
    // Each chunk fetches its own slice of learningEvents + videoProgress.
    for (let i = 0; i < allEnrollments.length; i += CHUNK_SIZE) {
      const chunk = allEnrollments.slice(i, i + CHUNK_SIZE);
      const userIds = [...new Set(chunk.map((e) => e.userId))];
      const batchIds = [...new Set(chunk.map((e) => e.batchId))];

      // Learning events for this chunk only, within the 28-day window
      const events = await db
        .select({
          userId: learningEvents.userId,
          batchId: learningEvents.batchId,
          eventType: learningEvents.eventType,
          metadata: learningEvents.metadata,
          createdAt: learningEvents.createdAt,
        })
        .from(learningEvents)
        .where(
          and(
            inArray(learningEvents.userId, userIds),
            inArray(learningEvents.batchId, batchIds),
            gte(learningEvents.createdAt, windowStart)
          )
        );

      // Video progress (completionPercentage) for this chunk
      const progressRows = await db
        .select({
          userId: studentVideoProgress.userId,
          videoId: studentVideoProgress.videoId,
          completionPercentage: studentVideoProgress.completionPercentage,
        })
        .from(studentVideoProgress)
        .where(inArray(studentVideoProgress.userId, userIds));

      // Total videos per batch (for quizParticipationRate denominator proxy)
      const batchVideoCount = await db
        .select({
          levelId: batches.levelId,
          batchId: batches.id,
          count: sql<number>`COUNT(${videoAssets.id})`.as('count'),
        })
        .from(batches)
        .innerJoin(videoAssets, eq(videoAssets.levelId, batches.levelId))
        .where(inArray(batches.id, batchIds))
        .groupBy(batches.id, batches.levelId);

      const videoCountByBatch = Object.fromEntries(
        batchVideoCount.map((r) => [r.batchId, r.count ?? 0])
      );

      // ── per-enrollment metrics ───────────────────────────────────────────────
      const rows = chunk.map((enrollment) => {
        const userBatchEvents = events.filter(
          (e) =>
            e.userId === enrollment.userId &&
            e.batchId === enrollment.batchId
        );

        // videosWatched — distinct video_complete events
        const completedVideoIds = new Set(
          userBatchEvents
            .filter((e) => e.eventType === 'video_complete')
            .map((e) => (e.metadata as Record<string, unknown> | null)?.videoId as string | undefined)
            .filter(Boolean)
        );
        const videosWatched = completedVideoIds.size;

        // quizzesTaken
        const quizSubmitEvents = userBatchEvents.filter(
          (e) => e.eventType === 'quiz_submit'
        );
        const quizzesTaken = quizSubmitEvents.length;

        // avgQuizScore — from metadata.score (0–100); default 0 if absent
        const scores = quizSubmitEvents
          .map((e) => {
            const m = e.metadata as Record<string, unknown> | null;
            return typeof m?.score === 'number' ? m.score : null;
          })
          .filter((s): s is number => s !== null);
        const avgQuizScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;

        // minutesActive — distinct calendar minutes with any event
        const activeMinuteKeys = new Set(
          userBatchEvents.map((e) => {
            const d = new Date(e.createdAt);
            return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
          })
        );
        const minutesActive = activeMinuteKeys.size;

        // streakDays — consecutive days ending today with ≥1 event
        const activeDaySet = new Set(
          userBatchEvents.map((e) =>
            new Date(e.createdAt).toISOString().split('T')[0]
          )
        );
        let streakDays = 0;
        const cursor = new Date(today);
        while (activeDaySet.has(cursor.toISOString().split('T')[0])) {
          streakDays++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        }

        // daysSinceLastActive
        const sortedEvents = [...userBatchEvents].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const daysSinceLastActive =
          sortedEvents.length > 0
            ? Math.floor(
                (today.getTime() - new Date(sortedEvents[0].createdAt).getTime()) /
                  86_400_000
              )
            : 28;

        // completionPct — avg completion % across enrolled videos from studentVideoProgress
        const userProgress = progressRows.filter(
          (p) => p.userId === enrollment.userId
        );
        const totalPct = userProgress.reduce(
          (sum, p) => sum + Number(p.completionPercentage ?? 0),
          0
        );
        const completionPct =
          userProgress.length > 0
            ? Math.min(100, totalPct / userProgress.length)
            : 0;

        // quizParticipationRate — quizzesTaken / total batch videos (proxy)
        const batchTotal = videoCountByBatch[enrollment.batchId] ?? 1;
        const quizParticipationRate = Math.min(
          100,
          (quizzesTaken / batchTotal) * 100
        );

        const studyConsistencyScore = Math.min(100, (streakDays / 28) * 100);
        const interactionDepth = Math.min(100, userBatchEvents.length * 2);

        const engagementScore = computeEngagementScore({
          completionPct,
          quizParticipationRate,
          studyConsistencyScore,
          interactionDepth,
        });
        const riskScore = computeRiskScore(engagementScore, daysSinceLastActive);

        return {
          id: crypto.randomUUID(),
          userId: enrollment.userId,
          batchId: enrollment.batchId,
          orgId: enrollment.orgId,        // FIX #6
          weekOf: weekOfDate,
          engagementScore: engagementScore.toFixed(2),
          riskScore: riskScore.toFixed(2),
          videosWatched,                  // FIX #2
          quizzesTaken,                   // FIX #2
          avgQuizScore: avgQuizScore.toFixed(2), // FIX #2
          minutesActive,                  // FIX #2
          streakDays,                     // FIX #2
        };
      });

      if (rows.length > 0) {
        await db
          .insert(studentEngagementSnapshots)
          .values(rows)
          .onDuplicateKeyUpdate({
            // FIX #2 — upsert ALL computed columns, not just scores
            set: {
              engagementScore: sql`VALUES(engagement_score)`,
              riskScore: sql`VALUES(risk_score)`,
              videosWatched: sql`VALUES(videos_watched)`,
              quizzesTaken: sql`VALUES(quizzes_taken)`,
              avgQuizScore: sql`VALUES(avg_quiz_score)`,
              minutesActive: sql`VALUES(minutes_active)`,
              streakDays: sql`VALUES(streak_days)`,
            },
          });
        snapshotsProcessed += rows.length;
      }
    }

    // ── STEP 3: yearly growth — FIRST Sunday of January only ─────────────────
    // FIX #4 — getUTCDate() <= 7 constrains to the first week of the month.
    // Without this, every January Sunday overwrites the snapshot.
    const isFirstJanuarySunday =
      today.getUTCMonth() === 0 &&
      today.getUTCDay() === 0 &&
      today.getUTCDate() <= 7;

    if (isFirstJanuarySunday || isBackfill) {
      const year = today.getUTCFullYear() - (isFirstJanuarySunday ? 1 : 0);
      const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
      const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

      // Fetch all users who had any learning event last year
      const yearEvents = await db
        .select({
          userId: learningEvents.userId,
          eventType: learningEvents.eventType,
          metadata: learningEvents.metadata,
          createdAt: learningEvents.createdAt,
        })
        .from(learningEvents)
        .where(
          and(
            gte(learningEvents.createdAt, yearStart),
            sql`${learningEvents.createdAt} <= ${yearEnd}`
          )
        );

      const userIds = [...new Set(yearEvents.map((e) => e.userId))];

      // Yearly enrollment counts
      const yearEnrollments = await db
        .select({ userId: enrollments.userId, batchId: enrollments.batchId })
        .from(enrollments)
        .where(inArray(enrollments.userId, userIds));

      const enrollmentsByUser = new Map<string, number>();
      for (const e of yearEnrollments) {
        enrollmentsByUser.set(e.userId, (enrollmentsByUser.get(e.userId) ?? 0) + 1);
      }

      const growthRows = userIds.map((userId) => {
        const userYearEvents = yearEvents.filter((e) => e.userId === userId);

        const activeMinuteKeys = new Set(
          userYearEvents.map((e) => {
            const d = new Date(e.createdAt);
            return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
          })
        );

        const quizSubmits = userYearEvents.filter((e) => e.eventType === 'quiz_submit');
        const scores = quizSubmits
          .map((e) => {
            const m = e.metadata as Record<string, unknown> | null;
            return typeof m?.score === 'number' ? m.score : null;
          })
          .filter((s): s is number => s !== null);
        const avgQuizScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;

        return {
          id: crypto.randomUUID(),
          userId,
          year,
          totalMinutes: activeMinuteKeys.size,
          coursesEnrolled: enrollmentsByUser.get(userId) ?? 0,
          coursesCompleted: 0, // requires completion threshold logic — Phase 25C candidate
          avgQuizScore: avgQuizScore.toFixed(2),
          certificatesEarned: 0, // certificates table not yet implemented
          computedAt: new Date(),
        };
      });

      if (growthRows.length > 0) {
        // Chunk yearly growth inserts too — same safety reason
        for (let i = 0; i < growthRows.length; i += CHUNK_SIZE) {
          const chunk = growthRows.slice(i, i + CHUNK_SIZE);
          await db
            .insert(studentYearlyGrowth)
            .values(chunk)
            .onDuplicateKeyUpdate({
              set: {
                totalMinutes: sql`VALUES(total_minutes)`,
                coursesEnrolled: sql`VALUES(courses_enrolled)`,
                coursesCompleted: sql`VALUES(courses_completed)`,
                avgQuizScore: sql`VALUES(avg_quiz_score)`,
                certificatesEarned: sql`VALUES(certificates_earned)`,
                computedAt: sql`VALUES(computed_at)`,
              },
            });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      weekOf,
      snapshotsProcessed,
      yearlyGrowthRan: isFirstJanuarySunday || isBackfill,
    });
  } catch (err) {
    console.error('[cron/compute-snapshots]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
