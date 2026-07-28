/**
 * Topic Weakness Service
 *
 * Aggregates a student's weak topics from two independent signals:
 *
 *   1. QUIZ ACCURACY — practest_attempt_events (append-only, one row per answered
 *      question, carries is_correct + user_id) joined to practest_question_bank
 *      for the topic dimension (subject/chapter/topic, schema.ts:378-383).
 *      This is the stronger signal: it reflects measured incorrectness.
 *
 *   2. DOUBT FREQUENCY — tutor_topic_events (this feature's new table). Repeatedly
 *      asking about a topic is weaker evidence than getting it wrong, but it is
 *      the only signal available for topics the student has never been quizzed on.
 *
 * Read-only. Never throws to callers: a prompt-personalisation feature must not be
 * able to break a chat request, so every failure path returns an empty list.
 */

import { executeQuery } from '@/lib/db/connection';
import { logger } from '@/lib/logger';

export interface WeakTopic {
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  /** Quiz attempts on this topic (0 when the signal is doubt-only). */
  attempts: number;
  /** Incorrect quiz answers on this topic. */
  incorrect: number;
  /** incorrect / attempts, or null when never quizzed. */
  accuracy: number | null;
  /** Tutor doubts logged against this topic. */
  doubtCount: number;
  /** Composite 0-1 score; higher = weaker. See computeWeaknessScore. */
  score: number;
  /** Which signals contributed, for explainability in logs/prompts. */
  sources: Array<'quiz' | 'doubts'>;
}

/** Only consider recent history — a topic failed six months ago may since be mastered. */
const LOOKBACK_DAYS = 90;

/** Board values accepted by tutor_topic_events.board (mirrors user_notes.board). */
const BOARD_ENUM = ['CBSE', 'ICSE', 'STATE_BOARD'] as const;

/**
 * Normalise a board value to the column's ENUM, or null when unmappable.
 * The tutor profile carries board in mixed forms ('CBSE', 'cbse', 'State Board'),
 * and an unmatched board must degrade to NULL rather than fail the INSERT.
 */
function toBoardEnum(board?: string | null): string | null {
  if (!board) return null;
  const normalised = board.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (BOARD_ENUM as readonly string[]).includes(normalised) ? normalised : null;
}

export interface TutorTopicEventInput {
  userId: string;
  organizationId?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  board?: string | null;
  classLevel?: string | number | null;
  /** Active tutor persona (menuIntent id). */
  agentId?: string | null;
}

/**
 * Log one tutor interaction as a topic event.
 *
 * Fire-and-forget by design — callers should NOT await this on the request path.
 * Analytics must never add latency to, or be able to fail, a student's question.
 * Every error is swallowed and logged.
 */
export async function logTutorTopicEvent(input: TutorTopicEventInput): Promise<void> {
  if (!input.userId) return;

  try {
    await executeQuery(
      `INSERT INTO tutor_topic_events
         (organization_id, user_id, subject, chapter, topic, board, class_level, event_type, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'doubt_asked', ?)`,
      [
        input.organizationId ?? null,
        input.userId,
        input.subject ?? null,
        input.chapter ?? null,
        input.topic ?? null,
        toBoardEnum(input.board),
        // Column is VARCHAR(20); coerce numbers so a numeric classLevel is stored
        // consistently with the 'Class 10' strings the tutor session also produces.
        input.classLevel != null ? String(input.classLevel) : null,
        input.agentId ?? null,
      ]
    );
  } catch (error) {
    // Includes the case where 010_tutor_topic_events.sql has not been applied yet.
    logger.warn(
      '⚠️ [TopicWeakness] Failed to log tutor topic event — ignored',
      { userId: input.userId },
      error
    );
  }
}

/**
 * Below this many quiz attempts, accuracy is too noisy to rank on its own
 * (1 wrong answer out of 1 is not 100% weakness).
 */
const MIN_ATTEMPTS_FOR_ACCURACY = 3;

/**
 * Composite score.
 *
 * Quiz incorrectness dominates (weight 0.75) because it is measured rather than
 * inferred; doubt frequency contributes the remainder (0.25), normalised against a
 * soft ceiling so one obsessively-asked topic cannot crowd out genuine quiz failures.
 *
 * Topics with fewer than MIN_ATTEMPTS_FOR_ACCURACY attempts fall back to the doubt
 * signal alone rather than trusting a tiny denominator.
 */
function computeWeaknessScore(attempts: number, incorrect: number, doubtCount: number): number {
  const DOUBT_CEILING = 8;
  const doubtComponent = Math.min(doubtCount / DOUBT_CEILING, 1);

  if (attempts >= MIN_ATTEMPTS_FOR_ACCURACY) {
    const errorRate = incorrect / attempts;
    return 0.75 * errorRate + 0.25 * doubtComponent;
  }

  // Doubt-only (or too-few-attempts) topics are capped below a well-evidenced
  // quiz failure so they rank underneath it.
  return 0.5 * doubtComponent;
}

/**
 * Top weak topics for a student, strongest evidence first.
 *
 * @param userId  student id (better-auth user id)
 * @param limit   how many topics to return
 * @param subject optional filter — pass the current tutor subject to keep
 *                suggestions on-topic for this session
 */
export async function getTopWeakTopics(
  userId: string,
  limit = 3,
  subject?: string | null
): Promise<WeakTopic[]> {
  if (!userId) return [];

  try {
    const subjectFilter = subject ? 'AND qb.subject = ?' : '';
    const quizParams: unknown[] = [userId, LOOKBACK_DAYS];
    if (subject) quizParams.push(subject);

    // SIGNAL 1: quiz accuracy per topic.
    const quizRows = (await executeQuery(
      `SELECT
         qb.subject                AS subject,
         qb.chapter                AS chapter,
         qb.topic                  AS topic,
         COUNT(*)                  AS attempts,
         SUM(CASE WHEN pae.is_correct = 0 THEN 1 ELSE 0 END) AS incorrect
       FROM practest_attempt_events pae
       JOIN practest_question_bank qb ON qb.id = pae.question_id
       WHERE pae.user_id = ?
         AND pae.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND qb.topic IS NOT NULL
         ${subjectFilter}
       GROUP BY qb.subject, qb.chapter, qb.topic
       HAVING incorrect > 0
       ORDER BY incorrect DESC
       LIMIT 50`,
      quizParams
    )) as Array<Record<string, any>>;

    const doubtSubjectFilter = subject ? 'AND tte.subject = ?' : '';
    const doubtParams: unknown[] = [userId, LOOKBACK_DAYS];
    if (subject) doubtParams.push(subject);

    // SIGNAL 2: doubt frequency per topic.
    const doubtRows = (await executeQuery(
      `SELECT
         tte.subject AS subject,
         tte.chapter AS chapter,
         tte.topic   AS topic,
         COUNT(*)    AS doubt_count
       FROM tutor_topic_events tte
       WHERE tte.user_id = ?
         AND tte.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND tte.event_type = 'doubt_asked'
         AND (tte.topic IS NOT NULL OR tte.chapter IS NOT NULL)
         ${doubtSubjectFilter}
       GROUP BY tte.subject, tte.chapter, tte.topic
       ORDER BY doubt_count DESC
       LIMIT 50`,
      doubtParams
    )) as Array<Record<string, any>>;

    // Merge on subject|chapter|topic. Topic may be null on the doubt side (the
    // tutor knows the chapter far more often than the exact topic), so the key
    // falls back to chapter — that is why chapter participates in the key at all.
    const keyOf = (r: Record<string, any>) =>
      [r.subject ?? '', r.chapter ?? '', r.topic ?? ''].join('|').toLowerCase();

    const merged = new Map<string, WeakTopic>();

    for (const r of quizRows) {
      const attempts = Number(r.attempts) || 0;
      const incorrect = Number(r.incorrect) || 0;
      merged.set(keyOf(r), {
        subject: r.subject ?? null,
        chapter: r.chapter ?? null,
        topic: r.topic ?? null,
        attempts,
        incorrect,
        accuracy: attempts > 0 ? incorrect / attempts : null,
        doubtCount: 0,
        score: 0,
        sources: ['quiz'],
      });
    }

    for (const r of doubtRows) {
      const key = keyOf(r);
      const doubtCount = Number(r.doubt_count) || 0;
      const existing = merged.get(key);
      if (existing) {
        existing.doubtCount = doubtCount;
        existing.sources.push('doubts');
      } else {
        merged.set(key, {
          subject: r.subject ?? null,
          chapter: r.chapter ?? null,
          topic: r.topic ?? null,
          attempts: 0,
          incorrect: 0,
          accuracy: null,
          doubtCount,
          score: 0,
          sources: ['doubts'],
        });
      }
    }

    const ranked = [...merged.values()]
      .map((t) => ({ ...t, score: computeWeaknessScore(t.attempts, t.incorrect, t.doubtCount) }))
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return ranked;
  } catch (error) {
    // Deliberately swallowed: this powers prompt personalisation, and a missing
    // table or slow query must never fail the student's chat request. Notably
    // tutor_topic_events will not exist until 010_tutor_topic_events.sql is
    // applied, and this path must degrade cleanly until then.
    logger.warn(
      { err: error, userId },
      '⚠️ [TopicWeakness] Aggregation failed — continuing without personalisation'
    );
    return [];
  }
}

/**
 * Render weak topics as a prompt fragment for the "Ace Your Exams" persona.
 * Returns '' when there is nothing to say, so the caller can concatenate blindly.
 */
export function buildWeakTopicsDirective(weakTopics: WeakTopic[]): string {
  if (!weakTopics.length) return '';

  const lines = weakTopics.map((t, i) => {
    const label = [t.topic, t.chapter, t.subject].filter(Boolean).join(' — ') || 'Unnamed topic';
    const evidence: string[] = [];
    if (t.attempts > 0) {
      evidence.push(`got ${t.incorrect} of ${t.attempts} quiz questions wrong`);
    }
    if (t.doubtCount > 0) {
      evidence.push(`asked about it ${t.doubtCount} time${t.doubtCount === 1 ? '' : 's'}`);
    }
    return `${i + 1}. ${label} (${evidence.join('; ')})`;
  });

  return [
    `**THIS STUDENT'S WEAKEST TOPICS (from their own quiz results and questions, last ${LOOKBACK_DAYS} days)**`,
    ...lines,
    ``,
    `Ground your exam advice in these specific topics rather than giving generic strategy.`,
    `Prioritise them in any study plan or revision order you propose, weakest first, and`,
    `say briefly WHY each one is prioritised so the student can see the reasoning.`,
    `Do NOT claim to know their marks, rank, or overall performance — you only know the`,
    `topic-level signal listed above. If the student asks about something else, help with`,
    `that first and fold these in only where genuinely relevant.`,
  ].join('\n');
}
