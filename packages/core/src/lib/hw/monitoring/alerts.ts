// Alerts and automatic demotion (roadmap 5.4). Runs after each roll-up. For every group it adds up the last 7 Indian-time days on the
// marking setup that is running now, and:
//   - raises an alert (once; it stays open while it holds and is cleared when it stops) for each limit that is over, when the sample is at
//     least HW_MONITOR_MIN_ANSWERS;
//   - for the two marking-quality alerts, takes a group that is 'eligible' for this setup to 'not_yet' (registry autoDemote: event row,
//     audit row, reason) while HW_MONITOR_AUTODEMOTE is on;
//   - emails the platform owner(s) about every newly raised alert, once.
// A group that was promoted is judged only on the days since it was last promoted, so promoting again after a fix is not undone at once by
// the older days still in the window.

import { sql } from 'drizzle-orm';
import { db, type Exec } from '../db';
import { getHwConfig } from '../config';
import { runningConfig, autoDemote } from '../eligibility/registry';
import { parseGroupKey, groupLabel } from '../eligibility/group';
import { emailLayout, sendEmail } from '@/lib/email/send-email';
import { defaultAppUrl } from '../eval-tools/invite-content';
import { findAlerts, lastSevenDays, sumRows, type AlertCode, type AlertFinding, type DailyRow, type Thresholds } from './rules';

const MONITOR_TZ = 'Asia/Kolkata';
const istDay = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: MONITOR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export function thresholdsFromConfig(): Thresholds {
  const c = getHwConfig();
  return {
    minAnswers: c.HW_MONITOR_MIN_ANSWERS, maxOverrideRate: c.HW_MONITOR_MAX_OVERRIDE_RATE, maxLargeOverrideRate: c.HW_MONITOR_MAX_LARGE_OVERRIDE_RATE,
    maxTranscriptFixRate: c.HW_MONITOR_MAX_TRANSCRIPT_FIX_RATE, maxFailedJobRate: c.HW_MONITOR_MAX_FAILED_JOB_RATE, maxCostRatio: c.HW_MONITOR_MAX_COST_RATIO,
  };
}

export interface AlertDeps {
  send: typeof sendEmail;
  now: () => Date;
  appUrl: () => string;
  /** Who is told: the platform owners' addresses. */
  recipients: () => Promise<string[]>;
}
const realDeps: AlertDeps = { send: sendEmail, now: () => new Date(), appUrl: defaultAppUrl, recipients: () => superAdminEmails(db) };

export interface AlertRun {
  raised: Array<AlertFinding & { groupKey: string; demoted: boolean }>;
  cleared: number;
  demoted: string[];
  emailed: number;
  emailError?: string;
}

export const DAILY_COLUMNS = sql.raw(`day::text AS day, group_key, answers_marked, suggestions_shown, accepted_unchanged, accepted_edited, marked_by_hand, marked_by_rule,
  overrides, large_overrides, override_abs_sum::float AS override_abs_sum, transcript_fixes, misread_taps, instruction_flags, instruction_not_taps,
  jobs_failed, jobs_total, batch_fallbacks, actual_cost_paise::float AS actual_cost_paise, projected_paise_per_answer::float AS projected_paise_per_answer`);

export type DailyRowWithKey = DailyRow & { day: string; group_key: string };

export async function superAdminEmails(x: Exec): Promise<string[]> {
  const r = await x.execute<{ email: string }>(sql`SELECT email FROM "user" WHERE role = 'super_admin' AND email IS NOT NULL AND email <> '' ORDER BY email`);
  return r.rows.map((x2) => x2.email);
}

export async function runAlerts(opts: { today?: string; deps?: Partial<AlertDeps> } = {}): Promise<AlertRun> {
  const deps = { ...realDeps, ...opts.deps };
  const result: AlertRun = { raised: [], cleared: 0, demoted: [], emailed: 0 };
  let hash: string;
  try { hash = runningConfig().hash; } catch { return result; } // no grade model, nothing is being marked
  const th = thresholdsFromConfig();
  const today = opts.today ?? istDay(deps.now());
  const window = lastSevenDays(today);

  const rows = (await db.execute<DailyRowWithKey>(sql`
    SELECT ${DAILY_COLUMNS} FROM hw_monitor_group_daily WHERE day >= ${window[0]}::date AND day <= ${today}::date AND config_hash = ${hash}`)).rows;
  const elig = (await db.execute<{ group_key: string; status: string; config_hash: string | null; decided_at: Date }>(sql`
    SELECT group_key, status, config_hash, decided_at FROM hw_eligibility`)).rows;
  const eligOf = new Map(elig.map((e) => [e.group_key, e]));

  const byGroup = new Map<string, DailyRowWithKey[]>();
  for (const r of rows) byGroup.set(r.group_key, [...(byGroup.get(r.group_key) ?? []), r]);

  const open = (await db.execute<{ id: string; group_key: string; code: AlertCode }>(sql`SELECT id, group_key, code FROM hw_monitor_alert WHERE cleared_at IS NULL`)).rows;
  const stillOpen = new Set<string>();
  const newlyRaised: string[] = [];

  for (const [groupKey, groupRows] of byGroup) {
    const e = eligOf.get(groupKey);
    const promoted = e && e.status === 'eligible' && e.config_hash === hash;
    const since = promoted ? istDay(new Date(e.decided_at)) : window[0];
    const counted = groupRows.filter((r) => r.day >= since);
    const findings = findAlerts(sumRows(counted), th);
    const alertIds = new Map<AlertCode, string>();
    for (const f of findings) {
      stillOpen.add(`${groupKey}|${f.code}`);
      const existing = open.find((o) => o.group_key === groupKey && o.code === f.code);
      let alertId = existing?.id ?? null;
      if (existing) {
        await db.execute(sql`UPDATE hw_monitor_alert SET value = ${f.value}, threshold = ${f.threshold}, sample_size = ${f.sample}, config_hash = ${hash} WHERE id = ${existing.id}`);
      } else {
        const ins = await db.execute<{ id: string }>(sql`
          INSERT INTO hw_monitor_alert (group_key, code, severity, value, threshold, sample_size, config_hash, raised_at)
          VALUES (${groupKey}, ${f.code}, ${f.severity}, ${f.value}, ${f.threshold}, ${f.sample}, ${hash}, ${deps.now()}) RETURNING id`);
        alertId = ins.rows[0].id;
        newlyRaised.push(alertId);
      }
      if (alertId) alertIds.set(f.code, alertId);
    }
    // One demotion per group, giving every marking-quality reason; each of those alerts is marked as a cause.
    const causes = findings.filter((f) => f.severity === 'demote');
    let demoted = false;
    if (causes.length && promoted && getHwConfig().HW_MONITOR_AUTODEMOTE) {
      demoted = await autoDemote({ groupKey, reason: `Automatic: ${causes.map((c) => c.message).join(' ')}` });
      if (demoted) {
        result.demoted.push(groupKey);
        for (const c of causes) await db.execute(sql`UPDATE hw_monitor_alert SET demoted = true WHERE id = ${alertIds.get(c.code)!}`);
      }
    }
    for (const f of findings) result.raised.push({ ...f, groupKey, demoted: demoted && f.severity === 'demote' });
  }

  for (const o of open) {
    if (stillOpen.has(`${o.group_key}|${o.code}`)) continue;
    await db.execute(sql`UPDATE hw_monitor_alert SET cleared_at = ${deps.now()} WHERE id = ${o.id}`);
    result.cleared++;
  }

  await emailNew(deps, result);
  return result;
}

/** One email to the platform owner(s) for every alert that has not been emailed yet. Failing to send leaves them to be tried on the next run. */
async function emailNew(deps: AlertDeps, result: AlertRun): Promise<void> {
  const pending = (await db.execute<{ id: string; group_key: string; code: string; severity: string; value: number; threshold: number; sample_size: number; demoted: boolean }>(sql`
    SELECT id, group_key, code, severity, value::float AS value, threshold::float AS threshold, sample_size, demoted FROM hw_monitor_alert WHERE emailed_at IS NULL AND cleared_at IS NULL ORDER BY raised_at`)).rows;
  if (!pending.length) return;
  const to = await deps.recipients();
  if (!to.length) { result.emailError = 'no platform owner has an email address'; return; }
  const findings = result.raised;
  const lines = pending.map((p) => {
    const parts = parseGroupKey(p.group_key);
    const label = parts ? groupLabel(parts) : p.group_key;
    const f = findings.find((x) => x.groupKey === p.group_key && x.code === p.code);
    return `<li><strong>${esc(label)}</strong>: ${esc(f?.message ?? `${p.code} is over its limit`)}${p.demoted ? ' <strong>It was taken out of “eligible” automatically; AI suggestions are off for it until it is promoted again.</strong>' : ''}</li>`;
  });
  const anyDemoted = pending.some((p) => p.demoted);
  const html = emailLayout({
    heading: anyDemoted ? 'A marking group was taken out of “eligible”' : 'Marking monitor alert',
    body: `<ul>${lines.join('')}</ul>`,
    ctaLabel: 'Open the monitoring tab',
    ctaUrl: `${deps.appUrl().replace(/\/$/, '')}/dashboard/super-admin/evaluation`,
  });
  const subject = anyDemoted ? 'Virat Evaluator: a group was demoted automatically' : 'Virat Evaluator: monitor alert';
  let ok = 0;
  let firstError: string | undefined;
  for (const addr of to) {
    const sent = await deps.send({ to: addr, subject, html }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    if (sent.ok) ok++; else firstError ??= sent.error ?? 'not sent';
  }
  if (ok > 0) {
    await db.execute(sql`UPDATE hw_monitor_alert SET emailed_at = ${deps.now()} WHERE id IN (${sql.join(pending.map((p) => sql`${p.id}`), sql`, `)})`);
    result.emailed = ok;
  } else {
    result.emailError = firstError;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
