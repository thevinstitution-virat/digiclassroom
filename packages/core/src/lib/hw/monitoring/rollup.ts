// Daily roll-up per institution and GROUP (roadmap 5.4) into hw_monitor_group_daily (migration 026). Like the older roll-up in
// shadow/monitor.ts it is recomputed from the product's own tables, never incremented, so running it twice is safe and a late correction is
// picked up the next time the day is rolled up. Days are Indian Standard Time. Stated plainly:
//   - an answer re-marked on a later day counts on the day of its latest mark;
//   - misread taps carry no time, so they count on the day the work was handed in;
//   - a job counts on the day it finished; the cost of a reading job is shared equally over the handwritten answers of its submission;
//   - config_hash is the marking setup running when the day is rolled up (see the header of migration 026).

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getHwConfig } from '../config';
import { EXACT_MATCH_MODEL, BLANK_MODEL } from '../grader/exact-match';
import { FALLBACK_PREFIX } from '../jobs/homework-batch';
import { runningConfig } from '../eligibility/registry';
import { parseProjection } from './rules';

// Same zone as shadow/monitor.ts (not imported from there: that file calls this one).
const MONITOR_TZ = 'Asia/Kolkata';

/** The group key's subject part, in SQL: the same normalisation as eligibility/group.ts normaliseSubject. */
const SUBJECT_SQL = sql.raw(`lower(btrim(regexp_replace(replace(a.subject, '|', ' '), '\\s+', ' ', 'g')))`);

type Key = string; // org|subject|type|lang|source

type Parts = { org: string; subject: string; type: string; lang: string; src: string }
const keyOf = (p: Parts): Key => `${p.org}|${p.subject}|${p.type}|${p.lang}|${p.src}`;

export interface GroupCounts {
  answers: number; shown: number; unchanged: number; edited: number; byHand: number; byRule: number;
  overrides: number; large: number; absSum: number; transcriptFixes: number; misreadTaps: number;
  instructionFlags: number; instructionNotTaps: number; jobsFailed: number; jobsTotal: number; batchFallbacks: number; costPaise: number;
}
const zero = (): GroupCounts => ({ answers: 0, shown: 0, unchanged: 0, edited: 0, byHand: 0, byRule: 0, overrides: 0, large: 0, absSum: 0, transcriptFixes: 0, misreadTaps: 0, instructionFlags: 0, instructionNotTaps: 0, jobsFailed: 0, jobsTotal: 0, batchFallbacks: 0, costPaise: 0 });

type Row<T> = Parts & T;

/** Pure merge of the query results into one record per key. */
export function mergeGroups(parts: {
  grades: Row<{ n: number; shown: number; unchanged: number; edited: number; by_hand: number; by_rule: number; overrides: number; large: number; abs_sum: string | number }>[];
  fixes: Row<{ n: number }>[];
  misreads: Row<{ n: number }>[];
  flags: Row<{ flagged: number; dismissed: number }>[];
  jobs: Row<{ total: number; failed: number; fallbacks: number; cost: string | number }>[];
  readCost: Row<{ cost: string | number }>[];
}): Map<Key, { p: Parts; c: GroupCounts }> {
  const m = new Map<Key, { p: Parts; c: GroupCounts }>();
  const at = (p: Parts) => {
    const k = keyOf(p);
    let e = m.get(k);
    if (!e) { e = { p: { org: p.org, subject: p.subject, type: p.type, lang: p.lang, src: p.src }, c: zero() }; m.set(k, e); }
    return e.c;
  };
  for (const g of parts.grades) Object.assign(at(g), { answers: Number(g.n), shown: Number(g.shown), unchanged: Number(g.unchanged), edited: Number(g.edited), byHand: Number(g.by_hand), byRule: Number(g.by_rule), overrides: Number(g.overrides), large: Number(g.large), absSum: Number(g.abs_sum) });
  for (const f of parts.fixes) at(f).transcriptFixes += Number(f.n);
  for (const f of parts.misreads) at(f).misreadTaps += Number(f.n);
  for (const f of parts.flags) { const c = at(f); c.instructionFlags += Number(f.flagged); c.instructionNotTaps += Number(f.dismissed); }
  for (const j of parts.jobs) { const c = at(j); c.jobsTotal += Number(j.total); c.jobsFailed += Number(j.failed); c.batchFallbacks += Number(j.fallbacks); c.costPaise += Number(j.cost); }
  for (const r of parts.readCost) at(r).costPaise += Number(r.cost);
  return m;
}

/** Recompute one day (YYYY-MM-DD, IST) for every institution and group. Returns the number of rows written. */
export async function rollupGroupDay(day: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`bad day ${day}`);
  const local = (col: unknown) => sql`((${col}) AT TIME ZONE ${MONITOR_TZ})::date = ${day}::date`;
  const rule = sql`${EXACT_MATCH_MODEL}, ${BLANK_MODEL}`;

  const grades = await db.execute<Row<{ n: number; shown: number; unchanged: number; edited: number; by_hand: number; by_rule: number; overrides: number; large: number; abs_sum: string }>>(sql`
    WITH g AS (
      SELECT g.organization_id AS org, ${SUBJECT_SQL} AS subject, q.type, q.language_hint AS lang, q.scheme_source AS src,
             g.marks, g.source, q.marks AS q_marks, own.model AS own_model,
             (SELECT ag.suggested_marks FROM hw_ai_grade ag
               WHERE ag.answer_id = g.answer_id AND ag.created_at <= g.graded_at AND ag.model NOT IN (${rule})
               ORDER BY ag.created_at DESC LIMIT 1) AS ai_marks
        FROM hw_grade g
        JOIN hw_answer an ON an.id = g.answer_id
        JOIN hw_question q ON q.id = an.question_id
        JOIN hw_assignment a ON a.id = q.assignment_id
        LEFT JOIN hw_ai_grade own ON own.id = g.ai_grade_id
       WHERE ${local(sql`g.graded_at`)}),
    c AS (SELECT *, coalesce(own_model IN (${rule}), false) AS by_rule,
                 CASE WHEN ai_marks IS NOT NULL THEN abs(marks - ai_marks) END AS delta FROM g)
    SELECT org, subject, type, lang, src, count(*)::int AS n,
           count(ai_marks)::int AS shown,
           count(*) FILTER (WHERE NOT by_rule AND source = 'accepted_ai')::int AS unchanged,
           count(*) FILTER (WHERE NOT by_rule AND source = 'edited_ai')::int AS edited,
           count(*) FILTER (WHERE NOT by_rule AND source NOT IN ('accepted_ai', 'edited_ai'))::int AS by_hand,
           count(*) FILTER (WHERE by_rule)::int AS by_rule,
           count(*) FILTER (WHERE delta > 0)::int AS overrides,
           count(*) FILTER (WHERE delta > 0 AND (delta > 1 OR delta > 0.2 * q_marks))::int AS large,
           coalesce(sum(delta) FILTER (WHERE delta > 0), 0)::text AS abs_sum
      FROM c GROUP BY org, subject, type, lang, src`);

  const fixes = await db.execute<Row<{ n: number }>>(sql`
    SELECT r.organization_id AS org, ${SUBJECT_SQL} AS subject, q.type, q.language_hint AS lang, q.scheme_source AS src, count(*)::int AS n
      FROM hw_transcript_revision r
      JOIN hw_answer an ON an.id = r.answer_id
      JOIN hw_question q ON q.id = an.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE r.source = 'teacher_edit' AND ${local(sql`r.created_at`)}
     GROUP BY 1, 2, 3, 4, 5`);

  const misreads = await db.execute<Row<{ n: number }>>(sql`
    SELECT an.organization_id AS org, ${SUBJECT_SQL} AS subject, q.type, q.language_hint AS lang, q.scheme_source AS src, count(*)::int AS n
      FROM hw_answer an
      JOIN hw_submission s ON s.id = an.submission_id
      JOIN hw_question q ON q.id = an.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE jsonb_array_length(an.student_flags) > 0 AND s.submitted_at IS NOT NULL AND ${local(sql`s.submitted_at`)}
     GROUP BY 1, 2, 3, 4, 5`);

  // "Not an instruction" taps count on the day of the tap; flags on the day the answer was marked.
  const flags = await db.execute<Row<{ flagged: number; dismissed: number }>>(sql`
    SELECT org, subject, type, lang, src, sum(flagged)::int AS flagged, sum(dismissed)::int AS dismissed FROM (
      SELECT f.organization_id AS org, ${SUBJECT_SQL} AS subject, q.type, q.language_hint AS lang, q.scheme_source AS src,
             (CASE WHEN ${local(sql`f.flagged_at`)} THEN 1 ELSE 0 END) AS flagged,
             (CASE WHEN f.dismissed_at IS NOT NULL AND ${local(sql`f.dismissed_at`)} THEN 1 ELSE 0 END) AS dismissed
        FROM hw_instruction_flag f
        JOIN hw_answer an ON an.id = f.answer_id
        JOIN hw_question q ON q.id = an.question_id
        JOIN hw_assignment a ON a.id = q.assignment_id
       WHERE ${local(sql`f.flagged_at`)} OR (f.dismissed_at IS NOT NULL AND ${local(sql`f.dismissed_at`)})) x
     GROUP BY org, subject, type, lang, src`);

  const jobs = await db.execute<Row<{ total: number; failed: number; fallbacks: number; cost: string }>>(sql`
    SELECT j.organization_id AS org, ${SUBJECT_SQL} AS subject, q.type, q.language_hint AS lang, q.scheme_source AS src,
           count(*)::int AS total, count(*) FILTER (WHERE j.status = 'failed')::int AS failed,
           count(*) FILTER (WHERE j.error LIKE ${FALLBACK_PREFIX + '%'} OR (CASE WHEN j.payload_ref LIKE '{%' THEN (j.payload_ref::jsonb ? 'fallbackReason') ELSE false END))::int AS fallbacks,
           coalesce(sum(j.cost_estimate_paise), 0)::text AS cost
      FROM hw_ai_job j
      JOIN hw_question q ON q.id = j.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE j.kind = 'grade' AND j.status IN ('done', 'failed') AND ${local(sql`j.finished_at`)}
     GROUP BY 1, 2, 3, 4, 5`);

  const readCost = await db.execute<Row<{ cost: string }>>(sql`
    SELECT j.organization_id AS org, ${SUBJECT_SQL} AS subject, q.type, q.language_hint AS lang, q.scheme_source AS src,
           coalesce(sum(j.cost_estimate_paise / n.cnt), 0)::text AS cost
      FROM hw_ai_job j
      JOIN LATERAL (SELECT count(*) AS cnt FROM hw_answer x WHERE x.submission_id = j.submission_id AND x.mode <> 'typed') n ON n.cnt > 0
      JOIN hw_answer an ON an.submission_id = j.submission_id AND an.mode <> 'typed'
      JOIN hw_question q ON q.id = an.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE j.kind = 'read' AND j.status IN ('done', 'failed') AND ${local(sql`j.finished_at`)}
     GROUP BY 1, 2, 3, 4, 5`);

  const merged = mergeGroups({ grades: grades.rows, fixes: fixes.rows, misreads: misreads.rows, flags: flags.rows, jobs: jobs.rows, readCost: readCost.rows });
  let hash: string | null = null;
  try { hash = runningConfig().hash; } catch { hash = null; }
  const projection = parseProjection(getHwConfig().HW_MONITOR_PROJECTED_PAISE_JSON);

  await db.transaction(async (tx) => {
    // Rows for this day that no longer have any activity are cleared, not left stale.
    await tx.execute(sql`DELETE FROM hw_monitor_group_daily WHERE day = ${day}::date`);
    for (const { p, c } of merged.values()) {
      if (!p.subject || p.subject.length > 100) continue;
      const projected = projection[p.type as keyof typeof projection] ?? null;
      await tx.execute(sql`
        INSERT INTO hw_monitor_group_daily (day, organization_id, group_key, subject, question_type, language, scheme_source, config_hash,
          answers_marked, suggestions_shown, accepted_unchanged, accepted_edited, marked_by_hand, marked_by_rule, overrides, large_overrides, override_abs_sum,
          transcript_fixes, misread_taps, instruction_flags, instruction_not_taps, jobs_failed, jobs_total, batch_fallbacks, actual_cost_paise, projected_paise_per_answer)
        VALUES (${day}::date, ${p.org}, ${`${p.subject}|${p.type}|${p.lang}|${p.src}`}, ${p.subject}, ${p.type}, ${p.lang}, ${p.src}, ${hash},
          ${c.answers}, ${c.shown}, ${c.unchanged}, ${c.edited}, ${c.byHand}, ${c.byRule}, ${c.overrides}, ${c.large}, ${c.absSum},
          ${c.transcriptFixes}, ${c.misreadTaps}, ${c.instructionFlags}, ${c.instructionNotTaps}, ${c.jobsFailed}, ${c.jobsTotal}, ${c.batchFallbacks}, ${c.costPaise}, ${projected})`);
    }
  });
  return merged.size;
}
