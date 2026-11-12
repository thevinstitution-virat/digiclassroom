// The super admin's AI usage view (Evaluation → AI usage): what is running now (provider batches, queued work, exam booklets waiting) and what
// the Virat Evaluator's AI has used: tokens and cost by day, by institution, by kind of work and by model. Everything comes from the job rows
// (hw_ai_job: provider-reported tokens, cost at the price table or the provider's own figure) and the monthly roll-up; nothing is estimated
// here. Other AI in the app (Varta, Gyankosh chat, embeddings) is not booked on these rows and is not shown.

import { sql } from 'drizzle-orm';
import { db } from './db';
import { getHwConfig } from './config';
import { parsePriceTable } from './cost/pricing';
import { requireSuperAdmin, type EvalActor } from './eval-tools/access';
import { EXAM_ORG_ID } from './exams/space';
import { PRACTICE_ORG_ID } from './practice/rules';

const SPACE_LABEL: Record<string, string> = { [EXAM_ORG_ID]: 'Exam packages', [PRACTICE_ORG_ID]: 'InkBuddy (self-practice)' };
const n = (v: unknown) => Number(v ?? 0);

export interface UsageTotals { tokensIn: number; tokensCached: number; tokensOut: number; costPaise: number; jobs: number; batchJobs: number; batchCostPaise: number }
const totalsOf = (r: Record<string, unknown>): UsageTotals => ({
  tokensIn: n(r.tokens_in), tokensCached: n(r.tokens_cached), tokensOut: n(r.tokens_out), costPaise: n(r.cost), jobs: n(r.jobs), batchJobs: n(r.batch_jobs), batchCostPaise: n(r.batch_cost),
});
const SUMS = sql`COALESCE(sum(j.tokens_in), 0) AS tokens_in, COALESCE(sum(j.tokens_cached), 0) AS tokens_cached, COALESCE(sum(j.tokens_out), 0) AS tokens_out,
  COALESCE(sum(j.cost_estimate_paise), 0) AS cost, count(*) AS jobs, count(*) FILTER (WHERE j.batch_ref IS NOT NULL) AS batch_jobs,
  COALESCE(sum(j.cost_estimate_paise) FILTER (WHERE j.batch_ref IS NOT NULL), 0) AS batch_cost`;

export async function aiUsageDashboard(a: EvalActor, opts: { days?: number } = {}) {
  requireSuperAdmin(a);
  const days = Math.min(90, Math.max(7, Math.round(opts.days ?? 30)));
  const since = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - (${days - 1} * interval '1 day')) AT TIME ZONE 'Asia/Kolkata'`;
  const orgName = sql`COALESCE(o.name, j.organization_id)`;

  const [batches, queue, exams, daily, byOrg, byKind, byModel, today, month] = await Promise.all([
    db.execute(sql`
      SELECT j.kind, j.organization_id, ${orgName} AS org_name, count(*) AS jobs, count(DISTINCT j.batch_ref) AS batches, min(j.created_at) AS oldest, max(j.model) AS model
        FROM hw_ai_job j LEFT JOIN organization o ON o.id = j.organization_id
       WHERE j.status = 'batch_pending' GROUP BY j.kind, j.organization_id, o.name ORDER BY min(j.created_at)`),
    db.execute(sql`SELECT status, kind, count(*) AS jobs FROM hw_ai_job WHERE status IN ('queued', 'running') GROUP BY status, kind`),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE status = 'uploaded') AS uploaded, count(*) FILTER (WHERE status = 'evaluating') AS evaluating,
             count(*) FILTER (WHERE status IN ('uploaded', 'evaluating') AND evaluation_mode = 'batch' AND ready_by IS NOT NULL) AS on_batch,
             min(ready_by) FILTER (WHERE status IN ('uploaded', 'evaluating')) AS next_ready_by
        FROM hw_exam_attempt WHERE status IN ('uploaded', 'evaluating')`),
    db.execute(sql`
      SELECT to_char((j.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, ${SUMS}
        FROM hw_ai_job j WHERE j.created_at >= ${since} GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT j.organization_id, ${orgName} AS org_name, ${SUMS}
        FROM hw_ai_job j LEFT JOIN organization o ON o.id = j.organization_id
       WHERE j.created_at >= ${since} GROUP BY j.organization_id, o.name ORDER BY sum(j.cost_estimate_paise) DESC NULLS LAST, count(*) DESC LIMIT 50`),
    db.execute(sql`SELECT j.kind, ${SUMS} FROM hw_ai_job j WHERE j.created_at >= ${since} GROUP BY j.kind ORDER BY j.kind`),
    db.execute(sql`SELECT COALESCE(j.model, 'none') AS model, ${SUMS} FROM hw_ai_job j WHERE j.created_at >= ${since} GROUP BY 1 ORDER BY sum(j.cost_estimate_paise) DESC NULLS LAST`),
    db.execute(sql`SELECT ${SUMS} FROM hw_ai_job j WHERE j.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`),
    // the monthly roll-up also counts calls that belong to no job (shadow marking), so it can be a little higher than the jobs
    db.execute(sql`
      SELECT COALESCE(sum(tokens_in), 0) AS tokens_in, COALESCE(sum(tokens_cached), 0) AS tokens_cached, COALESCE(sum(tokens_out), 0) AS tokens_out,
             COALESCE(sum(cost_paise), 0) AS cost, COALESCE(sum(pages_read), 0) AS pages, COALESCE(sum(answers_graded), 0) AS answers
        FROM hw_ai_usage_monthly WHERE month = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')::date`),
  ]);

  // every day of the window, empty ones too, so the chart has no gaps
  const byDay = new Map(daily.rows.map((r) => [String(r.day), totalsOf(r)]));
  const dayList: { day: string; totals: UsageTotals }[] = [];
  const end = new Date(Date.now() + 5.5 * 3600_000);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    dayList.push({ day: d, totals: byDay.get(d) ?? totalsOf({}) });
  }
  const price = parsePriceTable(getHwConfig().HW_PRICE_TABLE_JSON);
  const m = month.rows[0] ?? {};
  const e = exams.rows[0] ?? {};
  return {
    days,
    generatedAt: new Date(),
    /** Costs are 0 when no price table is set and the provider gave no cost: say so rather than show a false zero. */
    priceProblem: 'problem' in price ? price.problem : null,
    now: {
      batches: batches.rows.map((r) => ({
        kind: String(r.kind), organizationId: String(r.organization_id), organization: SPACE_LABEL[String(r.organization_id)] ?? String(r.org_name),
        jobs: n(r.jobs), batches: n(r.batches), oldest: r.oldest as Date, model: (r.model as string | null) ?? null,
      })),
      queued: queue.rows.filter((r) => r.status === 'queued').reduce((s, r) => s + n(r.jobs), 0),
      running: queue.rows.filter((r) => r.status === 'running').reduce((s, r) => s + n(r.jobs), 0),
      exams: { uploaded: n(e.uploaded), evaluating: n(e.evaluating), onBatch: n(e.on_batch), nextReadyBy: (e.next_ready_by as Date | null) ?? null },
    },
    today: totalsOf(today.rows[0] ?? {}),
    month: { tokensIn: n(m.tokens_in), tokensCached: n(m.tokens_cached), tokensOut: n(m.tokens_out), costPaise: n(m.cost), pagesRead: n(m.pages), answersGraded: n(m.answers) },
    window: dayList.reduce((acc, d) => {
      for (const k of Object.keys(acc) as (keyof UsageTotals)[]) acc[k] += d.totals[k];
      return acc;
    }, totalsOf({})),
    daily: dayList,
    byOrganization: byOrg.rows.map((r) => ({ organizationId: String(r.organization_id), organization: SPACE_LABEL[String(r.organization_id)] ?? String(r.org_name), ...totalsOf(r) })),
    byKind: byKind.rows.map((r) => ({ kind: String(r.kind), ...totalsOf(r) })),
    byModel: byModel.rows.map((r) => ({ model: String(r.model), ...totalsOf(r) })),
  };
}
