// Monitoring arithmetic (roadmap 5.4), pure: adding daily rows into a window, the rates the screens show, which of them are alerts,
// and what an institution admin may see. No database in here, so every rule is unit-tested.

export interface Counts {
  answers: number;
  shown: number;
  unchanged: number;
  edited: number;
  byHand: number;
  byRule: number;
  overrides: number;
  large: number;
  absSum: number;
  transcriptFixes: number;
  misreadTaps: number;
  instructionFlags: number;
  instructionNotTaps: number;
  jobsFailed: number;
  jobsTotal: number;
  batchFallbacks: number;
  costPaise: number;
  /** Cost the configured projection allows for the same answers, over the rows that have a projection. */
  projectedPaise: number;
  /** Actual cost over the same rows (only rows with a projection), so the ratio compares like with like. */
  projectedBasisCostPaise: number;
}

export const ZERO_COUNTS: Counts = {
  answers: 0, shown: 0, unchanged: 0, edited: 0, byHand: 0, byRule: 0, overrides: 0, large: 0, absSum: 0, transcriptFixes: 0, misreadTaps: 0,
  instructionFlags: 0, instructionNotTaps: 0, jobsFailed: 0, jobsTotal: 0, batchFallbacks: 0, costPaise: 0, projectedPaise: 0, projectedBasisCostPaise: 0,
};

export type DailyRow = {
  answers_marked: number; suggestions_shown: number; accepted_unchanged: number; accepted_edited: number; marked_by_hand: number; marked_by_rule: number;
  overrides: number; large_overrides: number; override_abs_sum: number | string; transcript_fixes: number; misread_taps: number;
  instruction_flags: number; instruction_not_taps: number; jobs_failed: number; jobs_total: number; batch_fallbacks: number;
  actual_cost_paise: number | string; projected_paise_per_answer: number | string | null;
};

export function addRow(c: Counts, r: DailyRow): Counts {
  const projected = r.projected_paise_per_answer === null ? null : Number(r.projected_paise_per_answer);
  return {
    answers: c.answers + r.answers_marked, shown: c.shown + r.suggestions_shown, unchanged: c.unchanged + r.accepted_unchanged, edited: c.edited + r.accepted_edited,
    byHand: c.byHand + r.marked_by_hand, byRule: c.byRule + r.marked_by_rule, overrides: c.overrides + r.overrides, large: c.large + r.large_overrides,
    absSum: c.absSum + Number(r.override_abs_sum), transcriptFixes: c.transcriptFixes + r.transcript_fixes, misreadTaps: c.misreadTaps + r.misread_taps,
    instructionFlags: c.instructionFlags + r.instruction_flags, instructionNotTaps: c.instructionNotTaps + r.instruction_not_taps,
    jobsFailed: c.jobsFailed + r.jobs_failed, jobsTotal: c.jobsTotal + r.jobs_total, batchFallbacks: c.batchFallbacks + r.batch_fallbacks,
    costPaise: c.costPaise + Number(r.actual_cost_paise),
    projectedPaise: c.projectedPaise + (projected === null ? 0 : projected * r.answers_marked),
    projectedBasisCostPaise: c.projectedBasisCostPaise + (projected === null ? 0 : Number(r.actual_cost_paise)),
  };
}

export const sumRows = (rows: readonly DailyRow[]): Counts => rows.reduce(addRow, ZERO_COUNTS);

const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export interface Rates {
  /** Share of shown suggestions the teacher changed. */
  overrideRate: number | null;
  largeOverrideRate: number | null;
  /** Mean change in marks when the teacher changed a suggestion. */
  meanOverride: number | null;
  transcriptFixRate: number | null;
  misreadRate: number | null;
  instructionNotRate: number | null;
  failedJobRate: number | null;
  /** Actual paise per answer; null when there are no answers. */
  paisePerAnswer: number | null;
  /** Actual over projected, on the rows that have a projection; null when none does. */
  costRatio: number | null;
}

export function ratesOf(c: Counts): Rates {
  return {
    overrideRate: ratio(c.overrides, c.shown),
    largeOverrideRate: ratio(c.large, c.shown),
    meanOverride: ratio(c.absSum, c.overrides),
    transcriptFixRate: ratio(c.transcriptFixes, c.answers),
    misreadRate: ratio(c.misreadTaps, c.answers),
    instructionNotRate: ratio(c.instructionNotTaps, c.instructionFlags),
    failedJobRate: ratio(c.jobsFailed, c.jobsTotal),
    paisePerAnswer: ratio(c.costPaise, c.answers),
    costRatio: c.projectedPaise > 0 ? c.projectedBasisCostPaise / c.projectedPaise : null,
  };
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export type AlertCode = 'override_rate' | 'large_override_rate' | 'transcript_fix_rate' | 'failed_job_rate' | 'cost_over_projection';

export interface Thresholds {
  minAnswers: number;
  maxOverrideRate: number;
  maxLargeOverrideRate: number;
  maxTranscriptFixRate: number;
  maxFailedJobRate: number;
  maxCostRatio: number;
}

export interface AlertFinding {
  code: AlertCode;
  /** 'demote' alerts take a group out of 'eligible' when automatic demotion is on; 'warn' alerts only tell the owner. */
  severity: 'warn' | 'demote';
  value: number;
  threshold: number;
  /** The answers (or jobs) the rate is over. */
  sample: number;
  message: string;
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/**
 * Which alerts a group's last-7-days totals raise. A rate counts only when its own sample is at least minAnswers, and only when it is
 * strictly over its limit. Marking quality (changed and badly changed suggestions) demotes; everything else warns.
 */
export function findAlerts(c: Counts, th: Thresholds): AlertFinding[] {
  const r = ratesOf(c);
  const out: AlertFinding[] = [];
  if (c.shown >= th.minAnswers && r.overrideRate !== null && r.overrideRate > th.maxOverrideRate) {
    out.push({ code: 'override_rate', severity: 'demote', value: r.overrideRate, threshold: th.maxOverrideRate, sample: c.shown,
      message: `Teachers changed ${pct(r.overrideRate)} of the AI suggestions in the last 7 days (limit ${pct(th.maxOverrideRate)}, ${c.shown} suggestions).` });
  }
  if (c.shown >= th.minAnswers && r.largeOverrideRate !== null && r.largeOverrideRate > th.maxLargeOverrideRate) {
    out.push({ code: 'large_override_rate', severity: 'demote', value: r.largeOverrideRate, threshold: th.maxLargeOverrideRate, sample: c.shown,
      message: `Teachers made a large change to ${pct(r.largeOverrideRate)} of the AI suggestions in the last 7 days (limit ${pct(th.maxLargeOverrideRate)}, ${c.shown} suggestions).` });
  }
  if (c.answers >= th.minAnswers && r.transcriptFixRate !== null && r.transcriptFixRate > th.maxTranscriptFixRate) {
    out.push({ code: 'transcript_fix_rate', severity: 'warn', value: r.transcriptFixRate, threshold: th.maxTranscriptFixRate, sample: c.answers,
      message: `Teachers corrected the reading of ${pct(r.transcriptFixRate)} of the answers in the last 7 days (limit ${pct(th.maxTranscriptFixRate)}, ${c.answers} answers).` });
  }
  if (c.jobsTotal >= th.minAnswers && r.failedJobRate !== null && r.failedJobRate > th.maxFailedJobRate) {
    out.push({ code: 'failed_job_rate', severity: 'warn', value: r.failedJobRate, threshold: th.maxFailedJobRate, sample: c.jobsTotal,
      message: `${pct(r.failedJobRate)} of the marking jobs failed in the last 7 days (limit ${pct(th.maxFailedJobRate)}, ${c.jobsTotal} jobs).` });
  }
  if (c.answers >= th.minAnswers && r.costRatio !== null && r.costRatio > th.maxCostRatio) {
    out.push({ code: 'cost_over_projection', severity: 'warn', value: r.costRatio, threshold: th.maxCostRatio, sample: c.answers,
      message: `AI cost per answer is ${Math.round(r.costRatio * 100) / 100} times the projection in the last 7 days (limit ${th.maxCostRatio} times, ${c.answers} answers).` });
  }
  return out;
}

// ── What an institution admin may see ───────────────────────────────────────

/** Fields an institution admin never gets for a small group: the figures themselves, not only the rates. */
export function suppressedForInstitution(answers: number, minGroupSize: number): boolean {
  return answers < minGroupSize;
}

/** "2026-11-04" minus n days, as YYYY-MM-DD (calendar arithmetic on the date string; no time zone enters). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The 7 Indian-time days ending on `today`, oldest first. */
export const lastSevenDays = (today: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

/** Parse HW_MONITOR_PROJECTED_PAISE_JSON: {"short": 12, ...}. Anything malformed means "no projection" rather than an error in a background job. */
export function parseProjection(json: string | undefined): Partial<Record<'very_short' | 'short' | 'long' | 'essay', number>> {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const out: Partial<Record<'very_short' | 'short' | 'long' | 'essay', number>> = {};
    for (const k of ['very_short', 'short', 'long', 'essay'] as const) {
      const n = v[k];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return out;
  } catch { return {}; }
}
