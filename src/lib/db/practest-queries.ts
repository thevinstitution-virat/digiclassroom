// src/lib/db/practest-queries.ts
//
// Phase 0a reconciliation: rewritten on Drizzle ORM against the REAL schema
// (practest_question_bank / practest_test_sessions). The previous version used
// raw SQL referencing columns that don't exist in the live table
// (grade/options/correct_answer/difficulty, started_at/score/completed_at),
// which broke the student flow at runtime. Drizzle makes column drift impossible.
//
// The factory still returns the same function names + row shapes the API routes
// expect (snake_case, `options` JSON string, `correct_answer` letter, `grade`,
// `score`, `started_at`…), so the routes are unchanged — they just work now.
//
// Org scoping (unchanged contract):
//   - orgId set  → org-owned questions PLUS platform-global (NULL org) questions
//   - orgId null → super_admin platform-wide view (everything)

import { db } from '@/db';
import { practestQuestionBank, practestTestSessions, practestTestConfigurations } from '@/db/schema';
import { and, or, eq, isNull, inArray, gte, desc, sql, type SQL } from 'drizzle-orm';
import { normalizeOptions, type NormalizedOption } from '@/lib/practest/options';

// ── Route-facing row shapes (kept stable so routes don't change) ───────────────
export interface QuestionRow {
  id: string;
  organization_id: string | null;
  subject: string | null;
  grade: number | null;          // ← class_level
  board: string | null;
  question_text: string | null;
  question_type: string | null;
  options: string;               // JSON string of { A,B,C,D } (legacy shape, kept for back-compat)
  options_array: NormalizedOption[]; // canonical [{id,text,isCorrect}] — the answer key
  correct_answer: string;        // correct_option letter, e.g. 'A'
  correct_text: string;          // text of the correct option (robust matching)
  explanation: string | null;
  max_marks: number | null;
  topic: string | null;
  chapter: string | null;
  difficulty: string | null;     // no column yet (Phase 0b) — always null
  created_at: Date | null;
}

export interface SessionRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  configuration_id: string | null;
  selected_questions: string;    // JSON string
  score: number | null;          // ← total_score
  status: string | null;
  started_at: Date | null;       // ← start_time
  completed_at: Date | null;     // ← end_time
}

interface GetQuestionsOptions {
  grade?: number;
  subject?: string;
  subjects?: string[];           // multi-subject (mixed tests) — takes precedence over `subject`
  board?: string;
  difficulty?: string;
  topic?: string;
  chapters?: string[];           // optional chapter narrowing
  limit?: number;
}

const Q = practestQuestionBank;
const S = practestTestSessions;

function mapQuestion(r: typeof Q.$inferSelect): QuestionRow {
  const opts: Record<string, string | null> = { A: r.optionA, B: r.optionB, C: r.optionC, D: r.optionD };
  const correct = r.correctOption ?? '';
  // Canonical, shuffle-safe option array (derived from legacy columns today; will
  // transparently use the `options` JSON column once present — see lib/practest/options.ts).
  const optionsArray = normalizeOptions(r as unknown as Parameters<typeof normalizeOptions>[0]);
  return {
    id: r.id,
    organization_id: r.organizationId ?? null,
    subject: r.subject ?? null,
    grade: r.classLevel ?? null,
    board: r.board ?? null,
    question_text: r.questionText ?? null,
    question_type: r.questionType ?? null,
    options: JSON.stringify(opts),
    options_array: optionsArray,
    correct_answer: correct,
    correct_text: (opts[correct] ?? '') as string,
    explanation: r.explanation ?? null,
    max_marks: r.maxMarks ?? null,
    topic: r.topic ?? null,
    chapter: r.chapter ?? null,
    difficulty: r.difficultyLevel ?? null,
    created_at: r.createdAt ?? null,
  };
}

function mapSession(r: typeof S.$inferSelect): SessionRow {
  return {
    id: r.id,
    organization_id: r.organizationId ?? null,
    user_id: r.userId ?? null,
    configuration_id: r.configurationId ?? null,
    selected_questions: JSON.stringify(r.selectedQuestions ?? []),
    score: r.totalScore ?? null,
    status: r.status ?? null,
    started_at: r.startTime ?? null,
    completed_at: r.endTime ?? null,
  };
}

export function practestQueries(orgId: string | null) {
  // Org filter: org-owned + platform-global (NULL); super_admin (null) sees all.
  // orgId set → org-owned + platform-global; orgId null → platform-global ONLY
  // (individual B2C students). Never "everything" — that would leak cross-org content.
  const qOrg = (): SQL | undefined =>
    orgId ? or(eq(Q.organizationId, orgId), isNull(Q.organizationId)) : isNull(Q.organizationId);
  const sOrg = (): SQL | undefined =>
    orgId ? or(eq(S.organizationId, orgId), isNull(S.organizationId)) : isNull(S.organizationId);

  async function getQuestions(opts: GetQuestionsOptions = {}): Promise<QuestionRow[]> {
    const conds: SQL[] = [];
    const f = qOrg(); if (f) conds.push(f);
    // Students only ever see approved questions.
    conds.push(eq(Q.validationStatus, 'APPROVED'));
    if (opts.grade !== undefined) conds.push(eq(Q.classLevel, opts.grade));
    if (opts.subjects && opts.subjects.length) conds.push(inArray(Q.subject, opts.subjects));
    else if (opts.subject) conds.push(eq(Q.subject, opts.subject));
    if (opts.board) conds.push(eq(Q.board, opts.board));
    if (opts.topic) conds.push(eq(Q.topic, opts.topic));
    if (opts.chapters && opts.chapters.length) conds.push(inArray(Q.chapter, opts.chapters));
    if (opts.difficulty) conds.push(eq(Q.difficultyLevel, opts.difficulty));

    const rows = await db
      .select().from(Q)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(Q.createdAt))
      .limit(opts.limit ?? 50);
    return rows.map(mapQuestion);
  }

  async function getQuestionById(questionId: string): Promise<QuestionRow | null> {
    const f = qOrg();
    const where = f ? and(eq(Q.id, questionId), f) : eq(Q.id, questionId);
    const [row] = await db.select().from(Q).where(where).limit(1);
    return row ? mapQuestion(row) : null;
  }

  async function createQuestion(data: {
    subject: string; grade: number; board: string; questionText: string;
    options: Record<string, string> | string[]; correctAnswer: string;
    explanation?: string; topic?: string; chapter?: string;
    questionType?: string; validationStatus?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const o = Array.isArray(data.options)
      ? { A: data.options[0], B: data.options[1], C: data.options[2], D: data.options[3] }
      : data.options;
    await db.insert(Q).values({
      id,
      organizationId: orgId,
      questionText: data.questionText,
      questionType: data.questionType ?? 'MCQ',
      optionA: o.A ?? null, optionB: o.B ?? null, optionC: o.C ?? null, optionD: o.D ?? null,
      correctOption: data.correctAnswer,
      explanation: data.explanation ?? null,
      board: data.board,
      classLevel: data.grade,
      subject: data.subject,
      chapter: data.chapter ?? null,
      topic: data.topic ?? null,
      validationStatus: data.validationStatus ?? 'DRAFT',
    });
    return id;
  }

  async function deleteQuestion(questionId: string): Promise<boolean> {
    // Non-super_admin can only delete their own org's questions.
    const where = orgId
      ? and(eq(Q.id, questionId), eq(Q.organizationId, orgId))
      : eq(Q.id, questionId);
    await db.delete(Q).where(where);
    return true;
  }

  async function getSessionsByUser(userId: string): Promise<SessionRow[]> {
    const f = sOrg();
    const where = f ? and(eq(S.userId, userId), f) : eq(S.userId, userId);
    const rows = await db.select().from(S).where(where).orderBy(desc(S.startTime));
    return rows.map(mapSession);
  }

  async function getSessionById(sessionId: string): Promise<SessionRow | null> {
    const f = sOrg();
    const where = f ? and(eq(S.id, sessionId), f) : eq(S.id, sessionId);
    const [row] = await db.select().from(S).where(where).limit(1);
    return row ? mapSession(row) : null;
  }

  // Count practice tests this user created TODAY (for the daily-test limit).
  async function countTodaySessions(userId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const conds: SQL[] = [eq(S.userId, userId), gte(S.createdAt, start)];
    const f = sOrg();
    if (f) conds.push(f);
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(S).where(and(...conds));
    return Number(row?.n ?? 0);
  }

  async function createSession(data: {
    userId: string; configurationId?: string; selectedQuestions: string[];
  }): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(S).values({
      id,
      organizationId: orgId,
      userId: data.userId,
      configurationId: data.configurationId ?? null,
      selectedQuestions: data.selectedQuestions,
      maxPossibleScore: data.selectedQuestions.length,
      status: 'in_progress',
      startTime: new Date(),
    });
    return id;
  }

  async function completeSession(
    sessionId: string,
    result: { totalScore: number; maxPossibleScore: number; percentage: number },
  ): Promise<boolean> {
    const where = orgId
      ? and(eq(S.id, sessionId), eq(S.organizationId, orgId))
      : eq(S.id, sessionId);
    await db.update(S)
      .set({
        totalScore: result.totalScore,
        maxPossibleScore: result.maxPossibleScore,
        percentage: result.percentage,
        status: 'completed',
        endTime: new Date(),
      })
      .where(where);
    return true;
  }

  // Scoring scheme from the test configuration (negative / partial marking).
  async function getConfigById(
    configId: string,
  ): Promise<{ negative_marking: number; partial_marking: boolean } | null> {
    const [row] = await db
      .select({
        negativeMarking: practestTestConfigurations.negativeMarking,
        partialMarking: practestTestConfigurations.partialMarking,
      })
      .from(practestTestConfigurations)
      .where(eq(practestTestConfigurations.id, configId))
      .limit(1);
    if (!row) return null;
    return { negative_marking: row.negativeMarking ?? 0, partial_marking: !!row.partialMarking };
  }

  // Full configuration row (org-scoped) — used by generate to honor a test-series blueprint.
  async function getFullConfigById(configId: string) {
    const C = practestTestConfigurations;
    const orgFilter = orgId ? or(eq(C.organizationId, orgId), isNull(C.organizationId)) : isNull(C.organizationId);
    const where = and(eq(C.id, configId), orgFilter);
    const [row] = await db.select().from(C).where(where).limit(1);
    return row ?? null;
  }

  // Published test series visible to students (org-owned + platform-global).
  async function listPublicConfigurations() {
    const C = practestTestConfigurations;
    const conds: SQL[] = [eq(C.isPublic, true), eq(C.isActive, true)];
    conds.push(orgId ? or(eq(C.organizationId, orgId), isNull(C.organizationId))! : isNull(C.organizationId));
    const rows = await db.select().from(C).where(and(...conds)).orderBy(desc(C.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? 'Untitled series',
      description: r.description ?? '',
      board: r.board ?? null,
      classLevel: r.classLevel ?? null,
      subject: r.subject ?? null,
      totalQuestions: r.totalQuestions ?? 10,
      durationMinutes: r.durationMinutes ?? 20,
    }));
  }

  // Real curriculum (taxonomy-as-data) — distinct subject/chapter/topic that actually
  // have APPROVED questions. Drives the generator so it can only offer real options.
  async function getCurriculum(opts: { grade?: number; board?: string } = {}) {
    const conds: SQL[] = [eq(Q.validationStatus, 'APPROVED')];
    const f = qOrg(); if (f) conds.push(f);
    if (opts.grade !== undefined) conds.push(eq(Q.classLevel, opts.grade));
    if (opts.board) conds.push(eq(Q.board, opts.board));
    const rows = await db
      .selectDistinct({ subject: Q.subject, chapter: Q.chapter, topic: Q.topic })
      .from(Q)
      .where(and(...conds))
      .limit(5000);
    return rows;
  }

  // Interim question-stats pipeline (Phase 1 replaces this with append-only events).
  async function bumpQuestionStats(questionId: string, isCorrect: boolean): Promise<void> {
    await db.update(Q)
      .set({
        usageCount: sql`coalesce(${Q.usageCount}, 0) + 1`,
        totalAttempts: sql`coalesce(${Q.totalAttempts}, 0) + 1`,
        correctAttempts: sql`coalesce(${Q.correctAttempts}, 0) + ${isCorrect ? 1 : 0}`,
      })
      .where(eq(Q.id, questionId));
  }

  return {
    getQuestions, getQuestionById, createQuestion, deleteQuestion,
    getSessionsByUser, getSessionById, createSession, completeSession,
    getConfigById, getFullConfigById, listPublicConfigurations, getCurriculum,
    countTodaySessions, bumpQuestionStats,
  };
}
