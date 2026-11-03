// What the Monitoring tab shows (roadmap 5.4): per group, today (Indian time) and the rolling 7 days; alerts; batch turnaround; quota burn per
// tenant. Two views over the same rows: the platform owner's (everything) and the institution admin's (their own institution only, aggregates
// only, and no figures for a group with fewer answers than HW_MONITOR_MIN_GROUP_SIZE).

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getHwConfig } from '../config';
import { requireRole } from '../access/guards';
import type { HwActor } from '../access/policy';
import { requireSuperAdmin, type EvalActor } from '../eval-tools/access';
import { groupLabel, parseGroupKey } from '../eligibility/group';
import { runningConfig } from '../eligibility/registry';
import { tenantUsage } from '../tenants';
import { DAILY_COLUMNS, thresholdsFromConfig, type DailyRowWithKey } from './alerts';
import { lastSevenDays, ratesOf, suppressedForInstitution, sumRows, type Counts, type Rates, type Thresholds } from './rules';

const MONITOR_TZ = 'Asia/Kolkata';
const istToday = (now = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: MONITOR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export interface Figures { counts: Counts; rates: Rates }
const figures = (rows: DailyRowWithKey[]): Figures => { const counts = sumRows(rows); return { counts, rates: ratesOf(counts) }; };

export interface GroupMonitor {
  groupKey: string;
  label: string;
  /** The registry's view: eligible only for the setup running now. */
  effective: 'eligible' | 'not_yet' | 'insufficient_data' | 'config_changed' | 'no_record';
  today: Figures;
  last7: Figures;
  /** The 7 days, oldest first, one entry per day (zeros when nothing happened). */
  byDay: Array<{ day: string } & Figures>;
  /** Batch turnaround of this group's marking jobs over the 7 days, in seconds. */
  turnaround: { n: number; p50: number | null; p90: number | null };
}

export interface MonitorAlert {
  id: string; groupKey: string; label: string; code: string; severity: 'warn' | 'demote'; value: number; threshold: number; sampleSize: number;
  raisedAt: Date; demoted: boolean; emailedAt: Date | null; clearedAt: Date | null;
}

export interface TenantBurn {
  organizationId: string; name: string; budgetPaise: number; usedPaise: number; fraction: number | null; warn: boolean; exhausted: boolean;
  /** Paise by month end at this month's pace (cost so far / days gone x days in the month); null when nothing has been spent. */
  projectedMonthPaise: number | null;
}

export interface SuperMonitor {
  days: string[];
  today: string;
  runningHash: string | null;
  thresholds: Thresholds;
  autoDemote: boolean;
  groups: GroupMonitor[];
  alerts: MonitorAlert[];
  tenants: TenantBurn[];
}

async function dailyRows(window: string[], orgId?: string): Promise<DailyRowWithKey[]> {
  const r = await db.execute<DailyRowWithKey>(sql`
    SELECT ${DAILY_COLUMNS} FROM hw_monitor_group_daily
     WHERE day >= ${window[0]}::date AND day <= ${window[6]}::date ${orgId ? sql`AND organization_id = ${orgId}` : sql``}`);
  return r.rows;
}

/** Batch turnaround per group over the window: median and 90th percentile of the batch's own recorded seconds. */
async function turnaroundByGroup(since: string, orgId?: string): Promise<Map<string, { n: number; p50: number | null; p90: number | null }>> {
  const r = await db.execute<{ group_key: string; n: number; p50: number | null; p90: number | null }>(sql`
    SELECT lower(btrim(regexp_replace(replace(a.subject, '|', ' '), '\\s+', ' ', 'g'))) || '|' || q.type || '|' || q.language_hint || '|' || q.scheme_source AS group_key,
           count(*)::int AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY (j.payload_ref::jsonb->>'turnaroundSeconds')::float)::float AS p50,
           percentile_cont(0.9) WITHIN GROUP (ORDER BY (j.payload_ref::jsonb->>'turnaroundSeconds')::float)::float AS p90
      FROM hw_ai_job j
      JOIN hw_question q ON q.id = j.question_id
      JOIN hw_assignment a ON a.id = q.assignment_id
     WHERE j.kind = 'grade' AND j.created_at >= (${since}::date)::timestamp AT TIME ZONE ${MONITOR_TZ}
       AND j.payload_ref LIKE '{%' AND j.payload_ref::jsonb ? 'turnaroundSeconds' ${orgId ? sql`AND j.organization_id = ${orgId}` : sql``}
     GROUP BY 1`);
  return new Map(r.rows.map((x) => [x.group_key, { n: Number(x.n), p50: x.p50, p90: x.p90 }]));
}

async function effectiveOf(keys: string[]): Promise<Map<string, GroupMonitor['effective']>> {
  const out = new Map<string, GroupMonitor['effective']>();
  const rows = (await db.execute<{ group_key: string; status: string; config_hash: string | null }>(sql`SELECT group_key, status, config_hash FROM hw_eligibility`)).rows;
  let hash: string | null = null;
  try { hash = runningConfig().hash; } catch { hash = null; }
  for (const k of keys) {
    const r = rows.find((x) => x.group_key === k);
    out.set(k, !r ? 'no_record' : r.status === 'eligible' ? (r.config_hash === hash ? 'eligible' : 'config_changed') : (r.status as GroupMonitor['effective']));
  }
  return out;
}

function buildGroups(rows: DailyRowWithKey[], window: string[], today: string, turn: Map<string, { n: number; p50: number | null; p90: number | null }>, eff: Map<string, GroupMonitor['effective']>): GroupMonitor[] {
  const keys = [...new Set(rows.map((r) => r.group_key))].sort();
  return keys.map((k) => {
    const mine = rows.filter((r) => r.group_key === k);
    const parts = parseGroupKey(k);
    return {
      groupKey: k,
      label: parts ? groupLabel(parts) : k,
      effective: eff.get(k) ?? 'no_record',
      today: figures(mine.filter((r) => r.day === today)),
      last7: figures(mine),
      byDay: window.map((d) => ({ day: d, ...figures(mine.filter((r) => r.day === d)) })),
      turnaround: turn.get(k) ?? { n: 0, p50: null, p90: null },
    };
  });
}

async function burn(orgId?: string): Promise<TenantBurn[]> {
  const orgs = (await db.execute<{ id: string; name: string }>(sql`
    SELECT o.id, o.name FROM organization o
     WHERE ${orgId ? sql`o.id = ${orgId}` : sql`EXISTS (SELECT 1 FROM hw_tenant_quota q WHERE q.organization_id = o.id AND (q.monthly_budget_paise > 0 OR q.enabled))
        OR EXISTS (SELECT 1 FROM hw_ai_usage_monthly u WHERE u.organization_id = o.id)`}
     ORDER BY o.name LIMIT 1000`)).rows;
  const nowIst = new Date(Date.now() + 5.5 * 3_600_000);
  const dayOfMonth = Math.max(1e-6, nowIst.getUTCDate() - 1 + (nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes()) / 1440);
  const daysInMonth = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth() + 1, 0)).getUTCDate();
  const out: TenantBurn[] = [];
  for (const o of orgs) {
    const u = await tenantUsage(db, o.id);
    out.push({
      organizationId: o.id, name: o.name, budgetPaise: u.budgetPaise, usedPaise: u.costPaise, fraction: u.fraction, warn: u.warn, exhausted: u.exhausted,
      projectedMonthPaise: u.costPaise > 0 ? Math.round((u.costPaise / dayOfMonth) * daysInMonth) : null,
    });
  }
  return out;
}

export async function superMonitor(a: EvalActor, opts: { now?: Date } = {}): Promise<SuperMonitor> {
  requireSuperAdmin(a);
  const today = istToday(opts.now);
  const window = lastSevenDays(today);
  const rows = await dailyRows(window);
  const groups = buildGroups(rows, window, today, await turnaroundByGroup(window[0]), await effectiveOf([...new Set(rows.map((r) => r.group_key))]));
  const alertRows = (await db.execute<{ id: string; group_key: string; code: string; severity: 'warn' | 'demote'; value: number; threshold: number; sample_size: number; raised_at: Date; demoted: boolean; emailed_at: Date | null; cleared_at: Date | null }>(sql`
    SELECT id, group_key, code, severity, value::float AS value, threshold::float AS threshold, sample_size, raised_at, demoted, emailed_at, cleared_at
      FROM hw_monitor_alert WHERE cleared_at IS NULL OR raised_at > now() - interval '30 days' ORDER BY (cleared_at IS NULL) DESC, raised_at DESC LIMIT 200`)).rows;
  let hash: string | null = null;
  try { hash = runningConfig().hash; } catch { hash = null; }
  return {
    days: window, today, runningHash: hash, thresholds: thresholdsFromConfig(), autoDemote: getHwConfig().HW_MONITOR_AUTODEMOTE, groups,
    alerts: alertRows.map((r) => {
      const p = parseGroupKey(r.group_key);
      return { id: r.id, groupKey: r.group_key, label: p ? groupLabel(p) : r.group_key, code: r.code, severity: r.severity, value: r.value, threshold: r.threshold, sampleSize: r.sample_size, raisedAt: r.raised_at, demoted: r.demoted, emailedAt: r.emailed_at, clearedAt: r.cleared_at };
    }),
    tenants: await burn(),
  };
}

// ── Institution admin ───────────────────────────────────────────────────────

export type InstitutionGroup =
  | { groupKey: string; label: string; suppressed: true; minGroupSize: number }
  | { groupKey: string; label: string; suppressed: false; last7: Figures; /** null when today has fewer answers than the minimum (but some). */ today: Figures | null };

export interface InstitutionMonitor {
  days: string[];
  today: string;
  minGroupSize: number;
  groups: InstitutionGroup[];
  burn: TenantBurn | null;
}

/**
 * The same figures for one institution. Aggregates only: a group below the minimum size is shown by name with no figures at all (not even
 * counts), because a handful of answers is close to one student's work. Nothing here names a student, an answer or another institution.
 */
export async function institutionMonitor(actor: HwActor, opts: { now?: Date } = {}): Promise<InstitutionMonitor> {
  requireRole(actor, 'admin');
  const min = getHwConfig().HW_MONITOR_MIN_GROUP_SIZE;
  const today = istToday(opts.now);
  const window = lastSevenDays(today);
  const rows = await dailyRows(window, actor.orgId);
  const keys = [...new Set(rows.map((r) => r.group_key))].sort();
  const groups: InstitutionGroup[] = keys.map((k) => {
    const mine = rows.filter((r) => r.group_key === k);
    const parts = parseGroupKey(k);
    const label = parts ? groupLabel(parts) : k;
    const total = figures(mine);
    if (suppressedForInstitution(total.counts.answers, min)) return { groupKey: k, label, suppressed: true, minGroupSize: min };
    // Today is shown only if it, too, has at least the minimum number of answers (or none at all).
    const t = figures(mine.filter((r) => r.day === today));
    return { groupKey: k, label, suppressed: false, last7: total, today: t.counts.answers === 0 || !suppressedForInstitution(t.counts.answers, min) ? t : null };
  });
  const b = (await burn(actor.orgId))[0] ?? null;
  return { days: window, today, minGroupSize: min, groups, burn: b };
}
