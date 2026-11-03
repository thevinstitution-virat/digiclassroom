// Monthly cost projection for Handwritten Assignments (docs/hw-eval/cost-phase1.md).
//
// The unit costs are MEASURED (per-step costs from eval runs, see collectUnitCosts); everything
// else is an assumption and is a parameter with a default. Nothing in here calls a provider.
//
// Per student per month:
//   answers            = assignments x questions
//   read answers       = answers x (pen + paper)            (typed answers need no reading)
//   reading            = read answers x sum_lang share x tier-1 cost(lang)
//   escalation         = read answers x sum_lang share x escalation rate(lang) x escalation cost(lang)
//   AI-marked answers  = answers x (1 - one-mark share x exact-match share [code marking])
//                                x (1 - duplicate rate [reuse of identical answers])
//   marking            = AI-marked answers x marking cost
//   keys               = answers / students per class x keyed share x key cost x (1 - key reuse rate [shared library])
// Per teacher = students per teacher x per student. Per guardian = children per guardian x per student.

import type { ItemRow } from './runner';
import { stepTable } from './cost-table';

export type Lang = 'en' | 'hi' | 'mixed';

/** The same measured tokens priced at the price table's standard and batch rates (₹). */
export interface StdBatch { standard: number; batch: number }

export interface UnitCosts {
  /** ₹ per answer, tier-1 read, answers read ten to a call (the shape of a submission). */
  reading: Record<string, Partial<Record<Lang, StdBatch>>>;
  /** ₹ per ESCALATED answer. Sarvam is priced per page. */
  escalation: Record<string, Partial<Record<Lang, StdBatch>> | { perPage: number }>;
  /** ₹ per answer that goes to the AI. */
  marking: Record<string, StdBatch>;
  /** ₹ per key built (writer + verifier; the embedding is not included, see notes). */
  keys: Record<string, StdBatch>;
  /** Run ids the numbers come from. */
  runs: string[];
  notes: string[];
}

export interface Assumptions {
  assignmentsPerMonth: number;
  questionsPerAssignment: number;
  penShare: number;
  paperShare: number;
  typedShare: number;
  hindiShare: number;
  /** Share of read answers that are English / mixed among non-Hindi ones. */
  mixedShareOfNonHindi: number;
  escalationEn: number;
  escalationHi: number;
  oneMarkShare: number;
  /** ASSUMPTION (not in the brief): share of one-mark answers that equal an accepted answer after normalising. */
  exactMatchShareOfOneMark: number;
  duplicateRate: number;
  keyReuseRate: number;
  shadowMode: boolean;
  /** ASSUMPTION: students who share one answer key (a class). */
  studentsPerClass: number;
  /** ASSUMPTION: share of questions that need a key built (the rest carry the teacher's own scheme). */
  keyedShare: number;
  studentsPerTeacher: number;
  childrenPerGuardian: number;
  /** Pages per answer sent to a per-page reader. */
  pagesPerAnswer: number;
}

export const DEFAULTS: Assumptions = {
  assignmentsPerMonth: 8,
  questionsPerAssignment: 10,
  penShare: 0.4,
  paperShare: 0.5,
  typedShare: 0.1,
  hindiShare: 0.3,
  mixedShareOfNonHindi: 0,
  escalationEn: 0.15,
  escalationHi: 0.2,
  oneMarkShare: 0.3,
  exactMatchShareOfOneMark: 0.5,
  duplicateRate: 0.1,
  keyReuseRate: 0.7,
  shadowMode: false,
  studentsPerClass: 40,
  keyedShare: 1,
  studentsPerTeacher: 120,
  childrenPerGuardian: 1,
  pagesPerAnswer: 1,
};

export interface Flags {
  /** Homework batch: tier-1 reads (Gemini) and marking at batch rates; escalation stays synchronous, as in production. */
  batch: boolean;
  sharedKeys: boolean;
  codeMarking: boolean;
  dedupe: boolean;
}
export const NO_FLAGS: Flags = { batch: false, sharedKeys: false, codeMarking: false, dedupe: false };
export const ALL_FLAGS: Flags = { batch: true, sharedKeys: true, codeMarking: true, dedupe: true };

/** What a profile id means for pricing: which rate card each step uses. */
export interface Combo {
  reading: string;
  escalation: string;
  marking: string;
  keys: string;
}

/** Profiles whose definition is "run through the batch API". */
const BATCH_PROFILES = new Set(['R1', 'R2', 'E1', 'E-gemini', 'K1']);
/** Escalation always runs synchronously in production today, so the homework-batch flag does not batch it. */

export interface Projection {
  combo: Combo;
  flags: Flags;
  perStudent: { reading: number; escalation: number; marking: number; keys: number; total: number };
  perTeacher: number;
  perGuardian: number;
  /** Answers marked by the AI per student per month, after code marking and reuse. */
  aiMarkedAnswers: number;
  notes: string[];
}

const pick = (sb: StdBatch | undefined, batch: boolean, what: string): number => {
  if (!sb) throw new Error(`no measured cost for ${what}`);
  return batch ? sb.batch : sb.standard;
};

export function project(unit: UnitCosts, combo: Combo, flags: Flags, a: Assumptions = DEFAULTS, hindiReadingFallback = 'R1'): Projection {
  const notes: string[] = [];
  if (Math.abs(a.penShare + a.paperShare + a.typedShare - 1) > 1e-6) throw new Error('pen + paper + typed shares must add up to 1');
  const answers = a.assignmentsPerMonth * a.questionsPerAssignment;
  const readAnswers = answers * (a.penShare + a.paperShare);
  const langShare: Record<Lang, number> = { en: (1 - a.hindiShare) * (1 - a.mixedShareOfNonHindi), hi: a.hindiShare, mixed: (1 - a.hindiShare) * a.mixedShareOfNonHindi };

  // Reading, tier 1. A profile that is English-only (R-luna) reads Hindi with the fallback profile.
  const readCost = (lang: Lang): number => {
    const own = unit.reading[combo.reading]?.[lang];
    const id = own ? combo.reading : hindiReadingFallback;
    if (!own) notes.push(`${combo.reading} has no ${lang} measurement; ${lang} answers are read with ${hindiReadingFallback}`);
    // R1/R2 are batch profiles. Under the homework-batch flag every Gemini read is batched; gpt-6-luna reads stay standard.
    const batch = BATCH_PROFILES.has(id) || (flags.batch && id !== 'R-luna');
    return pick(unit.reading[id]?.[lang], batch, `reading ${id} ${lang}`);
  };
  let reading = 0;
  let escalation = 0;
  for (const lang of ['en', 'hi', 'mixed'] as const) {
    if (!langShare[lang]) continue;
    reading += readAnswers * langShare[lang] * readCost(lang);
    const rate = lang === 'hi' ? a.escalationHi : a.escalationEn;
    const e = unit.escalation[combo.escalation];
    if (!e) throw new Error(`no measured cost for escalation ${combo.escalation}`);
    const per = 'perPage' in e ? e.perPage * a.pagesPerAnswer : pick(e[lang] ?? e.en, BATCH_PROFILES.has(combo.escalation), `escalation ${combo.escalation} ${lang}`);
    escalation += readAnswers * langShare[lang] * rate * per;
  }

  // Marking.
  const codeShare = flags.codeMarking ? a.oneMarkShare * a.exactMatchShareOfOneMark : 0;
  const aiMarked = answers * (1 - codeShare) * (1 - (flags.dedupe ? a.duplicateRate : 0));
  // Homework marking is batched under the flag, whatever the model; the M profiles themselves are standard.
  const marking = aiMarked * pick(unit.marking[combo.marking], flags.batch, `marking ${combo.marking}`);

  // Keys: one per question, shared by the class, mostly reused across tenants when the library is on.
  const keysBuilt = (answers / a.studentsPerClass) * a.keyedShare * (1 - (flags.sharedKeys ? a.keyReuseRate : 0));
  const keys = keysBuilt * pick(unit.keys[combo.keys], BATCH_PROFILES.has(combo.keys), `keys ${combo.keys}`);

  if (a.shadowMode) notes.push('shadow mode is on in the assumptions, but its cost is not modelled here: it re-runs the candidate on a sampled share of answers');
  const total = reading + escalation + marking + keys;
  return {
    combo, flags, aiMarkedAnswers: aiMarked, notes: [...new Set(notes)],
    perStudent: { reading, escalation, marking, keys, total },
    perTeacher: total * a.studentsPerTeacher,
    perGuardian: total * a.childrenPerGuardian,
  };
}

// ── Collecting measured unit costs from eval runs ───────────────────────────────────────────

export interface RunInfo {
  runId: string;
  mode: 'read' | 'key' | 'mark' | 'e2e';
  dataset: string;
  profiles: string | null;
  forceEscalation: boolean;
  readGroup: number;
  languageFilter: string | null;
  /** The run's --label. A run labelled "explicit caching OFF" measures the flag's effect and is not a unit cost. */
  label?: string | null;
  status: string;
  rows: ItemRow[];
}

const profileIds = (r: RunInfo) => (r.profiles ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Per-answer / per-key unit costs from the runs given. A run counts only if it completed with no
 * failed rows. Reading is taken from `read` runs with ten answers to a call; escalation from runs
 * that escalated every answer; marking from `mark` runs; keys from `key` runs.
 */
export function collectUnitCosts(runs: readonly RunInfo[], inrPerUsdNote = ''): UnitCosts {
  const out: UnitCosts = { reading: {}, escalation: {}, marking: {}, keys: {}, runs: [], notes: inrPerUsdNote ? [inrPerUsdNote] : [] };
  // Where several runs measure the same thing, the one with more answers behind it wins (ties: the later one listed).
  const weight = new Map<string, number>();
  const wins = (key: string, n: number) => { if ((weight.get(key) ?? -1) > n) return false; weight.set(key, n); return true; };
  const stdBatch = (rows: ItemRow[], step: string, answers: number): StdBatch | null => {
    const t = stepTable(rows, answers).find((s) => s.step === step);
    return t ? { standard: t.tableStandardInr / answers, batch: t.tableBatchInr / answers } : null;
  };
  for (const r of runs) {
    if (r.status !== 'completed' || r.rows.some((x) => x.status === 'failed')) continue;
    if (r.label && /explicit caching OFF/i.test(r.label)) continue;
    const ids = profileIds(r);
    const answers = r.rows.filter((x) => x.status === 'ok').length;
    if (!answers) continue;
    const lang = (r.languageFilter ?? 'all') as Lang | 'all';
    if (r.mode === 'read' && r.readGroup === 10) {
      const reading = ids.find((i) => /^R/.test(i));
      const esc = ids.find((i) => /^E/.test(i));
      const t1 = stdBatch(r.rows, 'read_tier1', answers);
      if (reading && t1 && !r.forceEscalation && lang !== 'all' && wins(`R|${reading}|${lang}`, answers)) { (out.reading[reading] ??= {})[lang] = t1; out.runs.push(r.runId); }
      const t2 = stdBatch(r.rows, 'read_escalation', answers);
      if (esc && t2 && r.forceEscalation && lang !== 'all' && wins(`E|${esc}|${lang}`, answers)) {
        const slot = out.escalation[esc] as Partial<Record<Lang, StdBatch>> | undefined;
        (out.escalation[esc] = { ...(slot ?? {}), [lang]: t2 }); out.runs.push(r.runId);
      }
    }
    if (r.mode === 'mark') {
      const m = ids.find((i) => /^M/.test(i));
      const g = stdBatch(r.rows, 'grade', answers);
      if (m && g && wins(`M|${m}`, answers)) { out.marking[m] = g; out.runs.push(r.runId); }
    }
    if (r.mode === 'key') {
      const k = ids.find((i) => /^K/.test(i));
      const rows = r.rows.filter((x) => x.calls?.length);
      const t = stepTable(rows, rows.length).filter((s) => s.step === 'key_writer' || s.step === 'key_verifier');
      if (k && t.length) {
        out.keys[k] = { standard: t.reduce((s, x) => s + x.tableStandardInr, 0) / rows.length, batch: t.reduce((s, x) => s + x.tableBatchInr, 0) / rows.length };
        out.runs.push(r.runId);
      }
    }
  }
  out.runs = [...new Set(out.runs)];
  return out;
}

export const COMBO_AXES = {
  reading: ['R0', 'R1', 'R2', 'R-luna'],
  escalation: ['E0', 'E1', 'E-gemini', 'E-sarvam'],
  marking: ['M0', 'M1', 'M2'],
  keys: ['K0', 'K1'],
} as const;

export function allCombos(): Combo[] {
  const out: Combo[] = [];
  for (const reading of COMBO_AXES.reading) for (const escalation of COMBO_AXES.escalation) for (const marking of COMBO_AXES.marking) for (const keys of COMBO_AXES.keys) out.push({ reading, escalation, marking, keys });
  return out;
}
