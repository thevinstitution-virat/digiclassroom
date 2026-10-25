// Daily monitoring (stage1-design.md §9.5): per day, institution, subject and question type —
// answers given a final mark, how many had an AI suggestion, how often and by how much the
// teacher changed it, transcript corrections, and misread flags from students.
//
// Recomputed from the product's own tables (never incremented), so running it twice is safe
// and a late correction is picked up the next time the day is rolled up. Days are Indian
// Standard Time. Approximations, stated plainly:
//   - an answer re-marked on a later day counts on the day of its latest mark;
//   - misread flags carry no time, so they count on the day the work was handed in.

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { EXACT_MATCH_MODEL, BLANK_MODEL } from '../grader/exact-match';
import { fillShadowFinalMarks } from './shadow';

export const MONITOR_TZ = 'Asia/Kolkata';

export interface MonitorCounts {
  answersMarked: number;
  aiSuggested: number;
  overrides: number;
  overrideAbsSum: number;
  transcriptFixes: number;
  misreadFlags: number;
}

type Key = string; // org|subject|type
const keyOf = (r: { org: string; subject: string; type: string }) => `${r.org}|${r.subject}|${r.type}`;
const ZERO: MonitorCounts = { answersMarked: 0, aiSuggested: 0, overrides: 0, overrideAbsSum: 0, transcriptFixes: 0, misreadFlags: 0 };

/** Pure merge of the three sources into one row per key. */
export function mergeCounts(
  grades: { org: string; subject: string; type: string; marked: number; suggested: number; overrides: number; abs_sum: number | string }[],
  fixes: { org: string; subject: string; type: string; n: number }[],
  flags: { org: string; subject: string; type: string; n: number }[],
): Map<Key, MonitorCounts> {
  const m = new Map<Key, MonitorCounts>();
  const at = (k: Key) => m.get(k) ?? (m.set(k, { ...ZERO }), m.get(k)!);
  for (const g of grades) Object.assign(at(keyOf(g)), { answersMarked: Number(g.marked), aiSuggested: Number(g.suggested), overrides: Number(g.overrides), overrideAbsSum: Number(g.abs_sum) });
  for (const f of fixes) at(keyOf(f)).transcriptFixes = Number(f.n);
  for (const f of flags) at(keyOf(f)).misreadFlags = Number(f.n);
  return m;
}

/** Recompute one day (YYYY-MM-DD, IST). Returns the number of rows written. */
export async function rollupDay(day: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`bad day ${day}`);
  const local = (col: unknown) => sql`((${col}) AT TIME ZONE ${MONITOR_TZ})::date = ${day}::date`;

  const grades = await db.execute<{ org: string; subject: string; type: string; marked: number; suggested: number; overrides: number; abs_sum: string }>(sql`
    WITH g AS (
      SELECT g.organization_id AS org, a.subject, q.type, g.marks,
             (SELECT ag.suggested_marks FROM hw_ai_grade ag
               WHERE ag.answer_id = g.answer_id AND ag.created_at <= g.graded_at
                 AND ag.model NOT IN (${EXACT_MATCH_MODEL}, ${BLANK_MODEL})
               ORDER BY ag.created_at DESC LIMIT 1) AS ai_marks
        FROM hw_grade g
        JOIN hw_answer an ON an.id = g.answer_id
        JOIN hw_question q ON q.id = an.question_id
        JOIN hw_assignment a ON a.id = q.assignment_id
       WHERE ${local(sql`g.graded_at`)})
    SELECT org, subject, type, count(*)::int AS marked, count(ai_marks)::int AS suggested,
           count(*) FILTER (WHERE ai_marks IS NOT NULL AND ai_marks <> marks)::int AS overrides,
           coalesce(sum(abs(marks - ai_marks)) FILTER (WHERE ai_marks IS NOT NULL), 0)::text AS abs_sum
      FROM g GROUP BY org, subject, type`);

  const fixes = await db.execute<{ org: string; subject: string; type: string; n: number }>(sql`
    SELECT r.organization_id AS org, a.subject, q.type, count(*)::int AS n
      FROM hw_transcript_revision r
      JOIN hw_answer an ON an.id = r.answer_id
      JOIN hw_question q ON q.id = an.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE r.source = 'teacher_edit' AND ${local(sql`r.created_at`)}
     GROUP BY r.organization_id, a.subject, q.type`);

  const flags = await db.execute<{ org: string; subject: string; type: string; n: number }>(sql`
    SELECT an.organization_id AS org, a.subject, q.type, count(*)::int AS n
      FROM hw_answer an
      JOIN hw_submission s ON s.id = an.submission_id
      JOIN hw_question q ON q.id = an.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE jsonb_array_length(an.student_flags) > 0 AND s.submitted_at IS NOT NULL AND ${local(sql`s.submitted_at`)}
     GROUP BY an.organization_id, a.subject, q.type`);

  const merged = mergeCounts(grades.rows, fixes.rows, flags.rows);
  await db.transaction(async (tx) => {
    // Rows for this day that no longer have any activity are cleared, not left stale.
    await tx.execute(sql`DELETE FROM hw_eval_monitor_daily WHERE day = ${day}::date`);
    for (const [k, c] of merged) {
      const [org, subject, type] = k.split('|');
      await tx.execute(sql`
        INSERT INTO hw_eval_monitor_daily (day, organization_id, subject, question_type, answers_marked, ai_suggested, overrides, override_abs_sum, transcript_fixes, misread_flags)
        VALUES (${day}::date, ${org}, ${subject}, ${type}, ${c.answersMarked}, ${c.aiSuggested}, ${c.overrides}, ${c.overrideAbsSum}, ${c.transcriptFixes}, ${c.misreadFlags})`);
    }
  });
  return merged.size;
}

/** Today and yesterday in IST, as YYYY-MM-DD. */
export function recentDays(now = new Date()): string[] {
  const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: MONITOR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return [fmt(new Date(now.getTime() - 86_400_000)), fmt(now)];
}

const EVERY_MS = 15 * 60_000;
let lastRun = 0;

/** Called from the job runner on every pass; does real work at most every 15 minutes per process. */
export async function monitorTick(now = Date.now()): Promise<number> {
  if (now - lastRun < EVERY_MS) return 0;
  lastRun = now;
  let n = 0;
  for (const d of recentDays(new Date(now))) n += await rollupDay(d);
  n += await fillShadowFinalMarks();
  return n;
}

/** Tests only. */
export function _resetMonitorTick(): void { lastRun = 0; }
