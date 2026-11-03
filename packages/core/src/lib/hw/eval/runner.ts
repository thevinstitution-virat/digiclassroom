// Eval runner (stage1-design.md §7). Modes:
//   read  reading only, scored against the known transcript
//   key   build keys with the key service and check them
//   mark  mark the TRUTH transcript against the dataset's key
//   e2e   read, then mark the AI transcript; the truth transcript is marked in the same run,
//         so the effect of reading errors is a paired comparison
//
// Isolation: the reader, grader and key service are called as libraries through RunnerDeps.
// Nothing here touches a database; production tables are out of reach (see the grep test).
//
// Budget: before each call, projected cost + spent + in flight must stay within the cap;
// otherwise no new work starts, in-flight calls finish, and the run ends `budget_reached`.
// Resume: rows already written for an item × repeat are skipped (failed rows are retried).

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HwAiGradeItem } from '@/db/hw-schema';
import type { TokenUsage } from '../cost/pricing';
import type { GradeQuestion, GradeResult } from '../grader/types';
import type { KeyQuestionType, KeyRequest, KeyResult } from '../keys/types';
import { seededRandom } from './bootstrap';
import type { Dataset, EvalItem } from './dataset';
import { scoreReading, type ReadingItemScore } from './reading';

export type RunMode = 'read' | 'key' | 'mark' | 'e2e';
export type RowStatus = 'ok' | 'failed' | 'no_grounding' | 'skipped';
export type ReadRoute = 'tier1' | 'tier2' | 'needs_review';

/** Which part of the pipeline a call belongs to; the cost table is one row per step. */
export type CostStep = 'read_tier1' | 'read_escalation' | 'key_retrieval' | 'key_writer' | 'key_verifier' | 'grade';

export interface CallCost {
  model: string;
  usage: TokenUsage;
  costUsd?: number;
  step?: CostStep;
  /** Price this call at the provider's batch rate (tokens are the measured ones; see the profile's note). */
  batchPricing?: boolean;
  /** Images in the call, as sent. */
  images?: { count: number; bytes: number; pixels: number };
  /** Answers handled by this one call. */
  answers?: number;
  /** A call made only to measure (the paired truth-transcript mark of an e2e run, or the text-only twin used to split image tokens from text tokens); not part of the production cost per answer. */
  purpose?: 'eval_truth_mark' | 'measurement';
}

/** A call as recorded in a run: what was sent, what was used, what it cost. */
export interface LedgerCall extends CallCost {
  paise: number;
  /** 'reported' = the provider's own charge; 'table' = measured tokens at the price table's standard rates; 'table_batch' = measured tokens at its batch rates. */
  basis: 'reported' | 'table' | 'table_batch';
  /** The same measured tokens at the table's standard and batch rates, for comparing profiles. */
  tableStandardPaise?: number;
  tableBatchPaise?: number;
}

export interface RunnerDeps {
  /** The production route: tier 1, escalated to tier 2 when in doubt. Every call made is returned. */
  read(item: EvalItem): Promise<{ text: string; unclearCount: number; confidence: number; route: ReadRoute; calls: CallCost[] }>;
  /**
   * Several answers in ONE reader call, the way production reads a submission. Results are in item
   * order; calls are shared by the group. Used by `read` mode when readGroup > 1.
   */
  /** Counted by the harness: how many provider calls were retried after a transient error. */
  stats?: { retries: number };
  readGroup?(items: EvalItem[]): Promise<{ results: { text: string; unclearCount: number; confidence: number; route: ReadRoute }[]; calls: CallCost[] }>;
  /** Marks several answers to one question in one call, as production does. Exact-match/blank answers cost nothing. */
  grade(question: GradeQuestion, answers: { answerId: string; transcript: string }[]): Promise<{ results: GradeResult[]; calls: CallCost[] }>;
  buildKey(req: KeyRequest): Promise<KeyResult>;
  /**
   * Paise for a call: the provider's reported cost when it gives one, otherwise the price
   * table's estimate; null when neither exists (the run refuses to start without prices).
   */
  price(call: CallCost): number | null;
  /** The same call's measured tokens at the price table's standard or batch rates (ignores what the provider reported). */
  priceAs?(call: CallCost, batch: boolean): number | null;
}

export interface Estimates {
  read: { model: string; usage: TokenUsage };
  /** Per answer in a marking call. */
  grade: { model: string; usage: TokenUsage };
  /** Per key (embedding + writer + verifier). */
  key: { model: string; usage: TokenUsage }[];
}

export interface RunOptions {
  runId: string;
  runsRoot: string;
  mode: RunMode;
  repeat: number;
  budgetPaise: number;
  concurrency: number;
  gradeChunkSize: number;
  /** Answers per reader call in `read` mode (production sends every ink/photo answer of a submission together). Default 1. */
  readGroup?: number;
  seed: number;
  /** mark mode: every repeat shuffles the answers the same way (one grouping), so repeats measure run-to-run noise alone. Default: each repeat shuffles differently. */
  fixedGrouping?: boolean;
  estimates: Estimates;
  /** Recorded in run.json; computed by the caller (git commit, config hash, settings). */
  meta: Record<string, unknown>;
  /** Stop after this many tasks (tests and dry runs). */
  maxTasks?: number;
}

export interface PointResult {
  pointId: string; verdict: 'met' | 'partial' | 'missing'; marks: number; quote: string; confidence: number;
  /** Strict marking: what the model decided, the words it quoted, and whether they are in the answer (see HwAiGradeItem). */
  fact?: NonNullable<HwAiGradeItem['fact']>; claimed?: string; evidence?: boolean;
}
export interface MarkResult { total: number; points: PointResult[]; confidence: number; model: string; notes: string[] }

export interface ItemRow {
  itemId: string;
  questionId: string;
  repeat: number;
  mode: RunMode;
  status: RowStatus;
  reason?: string;
  stage?: 'read' | 'mark' | 'key';
  transcript?: string;
  readConfidence?: number;
  readRoute?: ReadRoute;
  reading?: ReadingItemScore;
  /** mark mode: on the truth transcript. e2e: on the AI transcript, with `markTruth` beside it. */
  mark?: MarkResult;
  markTruth?: MarkResult;
  key?: { status: KeyResult['status']; source?: string; reason?: string; points?: number; marksSum?: number; partial?: boolean; citations?: number; notes: string[] };
  tokens: TokenUsage;
  costPaise: number;
  latencyMs: number;
  /** Every provider call behind this row's cost (a chunk's or group's calls sit on its first row). */
  calls?: LedgerCall[];
}

export type RunStatus = 'running' | 'completed' | 'budget_reached' | 'aborted';

export interface RunRecord {
  runId: string;
  mode: RunMode;
  dataset: { ref: string; manifestSha256: string; items: number };
  repeat: number;
  budgetPaise: number;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  tokens: TokenUsage;
  costPaise: number;
  counts: Record<RowStatus, number>;
  failures: { itemId: string; repeat: number; stage: string; reason: string }[];
  meta: Record<string, unknown>;
}

// ── Mapping dataset items to library inputs ────────────────────────────────────────────

const KEY_TYPES: ReadonlySet<string> = new Set<KeyQuestionType>([
  'mcq', 'assertion_reason', 'very_short', 'short', 'long', 'essay', 'case_based', 'source_based', 'numerical', 'competency', 'reading',
]);

/** The grader's four production types; the eval's finer type stays in the prompt text. */
export function graderType(t: string): GradeQuestion['type'] {
  if (t === 'mcq' || t === 'assertion_reason' || t === 'very_short') return 'very_short';
  if (t === 'long' || t === 'essay') return t;
  return 'short';
}

export function gradeQuestionOf(it: EvalItem): GradeQuestion | string {
  if (!it.key) return 'item has no key';
  const missing = it.key.points.filter((p) => !p.text?.trim());
  if (missing.length) return `key points without text: ${missing.map((p) => p.id).join(', ')}`;
  const kind = (k?: string) => (k === 'format' ? 'structure' : k === 'key_point' || k === undefined ? 'key_point' : 'content');
  const single = it.key.points.length === 1 ? it.key.points[0] : null;
  return {
    id: it.question.id,
    type: graderType(it.questionType),
    subject: it.subject,
    prompt: it.question.passageText ? `${it.question.passageText}\n\n${it.question.text}` : it.question.text,
    marks: it.question.marks,
    modelAnswer: it.key.referenceAnswer ?? null,
    acceptedAnswers: single ? [single.text!, ...(single.acceptedAlternatives ?? [])] : [],
    rubricVersion: 1,
    rubric: it.key.points.map((p) => ({
      id: p.id,
      kind: kind(p.kind),
      description: p.acceptedAlternatives?.length ? `${p.text} (also accept: ${p.acceptedAlternatives.join('; ')})` : p.text!,
      marks: p.marks,
    })),
  };
}

export function keyRequestOf(it: EvalItem): KeyRequest | string {
  if (!KEY_TYPES.has(it.questionType)) return `question type ${it.questionType} is not keyable`;
  const ref = it.question.ref as { kind?: string; session?: string; subjectCode?: string; questionNo?: string } | undefined;
  return {
    questionText: it.question.text,
    questionType: it.questionType as KeyQuestionType,
    marks: it.question.marks,
    classLevel: it.class,
    subject: it.subject,
    medium: it.medium,
    passageText: it.question.passageText,
    officialRef: ref && (ref.kind === 'sqp' || ref.kind === 'past_paper') && ref.session && ref.subjectCode && ref.questionNo
      ? { kind: ref.kind, session: ref.session, subjectCode: ref.subjectCode, questionNo: ref.questionNo } : undefined,
  };
}

function markOf(r: GradeResult): MarkResult {
  return {
    total: r.suggestedMarks,
    confidence: r.confidence,
    model: r.model,
    notes: r.validationNotes,
    points: r.items.map((x) => ({ pointId: x.rubric_item_id, verdict: x.verdict, marks: x.marks, quote: x.quote, confidence: x.confidence, ...(x.fact ? { fact: x.fact, claimed: x.claimed, evidence: x.evidence } : {}) })),
  };
}

// ── Budget ─────────────────────────────────────────────────────────────────────────────

export class Budget {
  spent = 0;
  inFlight = 0;
  reached = false;
  constructor(readonly cap: number) {}
  /** Reserve a projected cost; false (and `reached`) when it would pass the cap. */
  reserve(p: number): boolean {
    if (this.reached || this.spent + this.inFlight + p > this.cap) { this.reached = true; return false; }
    this.inFlight += p;
    return true;
  }
  settle(reserved: number, actual: number): void {
    this.inFlight -= reserved;
    this.spent += actual;
  }
}

const OPTIONAL_USAGE = ['cacheWrite', 'thinking', 'inputImage', 'inputText'] as const;
const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => {
  const out: TokenUsage = { input: a.input + b.input, cached: a.cached + b.cached, output: a.output + b.output };
  for (const k of OPTIONAL_USAGE) if (a[k] !== undefined || b[k] !== undefined) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  return out;
};
const ZERO: TokenUsage = { input: 0, cached: 0, output: 0 };
const scale = (u: TokenUsage, n: number): TokenUsage => ({ input: u.input * n, cached: u.cached * n, output: u.output * n });

// ── Tasks ──────────────────────────────────────────────────────────────────────────────

interface Task { kind: 'read' | 'mark' | 'e2e' | 'key' | 'read_group'; repeat: number; items: EvalItem[]; projected: number }

function eligible(it: EvalItem, mode: RunMode): string | null {
  const hasMedia = !!(it.media.render || it.media.photo);
  if (mode === 'read') return !hasMedia ? 'no render or photo' : !it.truthTranscript ? 'no truth transcript' : null;
  if (mode === 'mark') return !it.truthTranscript ? 'no truth transcript' : typeof gradeQuestionOf(it) === 'string' ? (gradeQuestionOf(it) as string) : null;
  if (mode === 'e2e') return !hasMedia ? 'no render or photo' : !it.truthTranscript ? 'no truth transcript' : typeof gradeQuestionOf(it) === 'string' ? (gradeQuestionOf(it) as string) : null;
  return typeof keyRequestOf(it) === 'string' ? (keyRequestOf(it) as string) : null;
}

export function readRows(file: string): ItemRow[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as ItemRow);
}

/** The last row per item × repeat (a resumed run may retry a failed row). */
export function latestRows(rows: readonly ItemRow[]): ItemRow[] {
  const m = new Map<string, ItemRow>();
  for (const r of rows) m.set(`${r.itemId}#${r.repeat}`, r);
  return [...m.values()];
}

export function planTasks(ds: Dataset, o: Pick<RunOptions, 'mode' | 'repeat' | 'gradeChunkSize' | 'seed' | 'estimates' | 'readGroup' | 'fixedGrouping'>, done: ReadonlySet<string>, price: RunnerDeps['price']): { tasks: Task[]; skipped: ItemRow[] } {
  const skipped: ItemRow[] = [];
  const tasks: Task[] = [];
  const p = (model: string, u: TokenUsage) => {
    const x = price({ model, usage: u });
    if (x === null) throw new Error(`no price for ${model}: the budget cannot be enforced (set HW_PRICE_TABLE_JSON)`);
    return x;
  };
  for (let r = 0; r < o.repeat; r++) {
    const pending: EvalItem[] = [];
    for (const it of ds.items) {
      if (done.has(`${it.id}#${r}`)) continue;
      const why = eligible(it, o.mode);
      if (why) {
        skipped.push({ itemId: it.id, questionId: it.question.id, repeat: r, mode: o.mode, status: 'skipped', reason: why, tokens: ZERO, costPaise: 0, latencyMs: 0 });
        continue;
      }
      pending.push(it);
    }
    if (o.mode === 'read') {
      const g = Math.max(1, o.readGroup ?? 1);
      if (g === 1) {
        for (const it of pending) tasks.push({ kind: 'read', repeat: r, items: [it], projected: p(o.estimates.read.model, o.estimates.read.usage) });
      } else {
        for (let i = 0; i < pending.length; i += g) {
          const items = pending.slice(i, i + g);
          tasks.push({ kind: 'read_group', repeat: r, items, projected: items.length * p(o.estimates.read.model, o.estimates.read.usage) });
        }
      }
    } else if (o.mode === 'key') {
      // One key per question; every item of the question shares it.
      const byQ = new Map<string, EvalItem[]>();
      for (const it of pending) byQ.set(it.question.id, [...(byQ.get(it.question.id) ?? []), it]);
      for (const items of byQ.values()) tasks.push({ kind: 'key', repeat: r, items, projected: o.estimates.key.reduce((s, k) => s + p(k.model, k.usage), 0) });
    } else {
      // Answers to one question are marked together, in a shuffled order per repeat.
      const rnd = seededRandom(o.fixedGrouping ? o.seed : o.seed + r);
      const byQ = new Map<string, EvalItem[]>();
      for (const it of pending) byQ.set(it.question.id, [...(byQ.get(it.question.id) ?? []), it]);
      for (const items of byQ.values()) {
        const order = [...items];
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        for (let i = 0; i < order.length; i += o.gradeChunkSize) {
          const chunk = order.slice(i, i + o.gradeChunkSize);
          const markCost = p(o.estimates.grade.model, scale(o.estimates.grade.usage, chunk.length));
          const projected = o.mode === 'e2e' ? 2 * markCost + chunk.length * p(o.estimates.read.model, o.estimates.read.usage) : markCost;
          tasks.push({ kind: o.mode === 'e2e' ? 'e2e' : 'mark', repeat: r, items: chunk, projected });
        }
      }
    }
  }
  return { tasks, skipped };
}

// ── Running ────────────────────────────────────────────────────────────────────────────

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

export async function runEval(ds: Dataset, deps: RunnerDeps, o: RunOptions): Promise<RunRecord> {
  const dir = join(o.runsRoot, o.runId);
  mkdirSync(dir, { recursive: true });
  const itemsFile = join(dir, 'items.jsonl');
  const runFile = join(dir, 'run.json');
  const prior = existsSync(runFile) ? (JSON.parse(readFileSync(runFile, 'utf8')) as RunRecord) : null;
  if (prior && (prior.mode !== o.mode || prior.dataset.manifestSha256 !== ds.manifestSha256 || prior.repeat !== o.repeat)) {
    throw new Error(`cannot resume ${o.runId}: it was ${prior.mode} on ${prior.dataset.ref} ×${prior.repeat}`);
  }
  if (prior && JSON.stringify(prior.meta.configHash) !== JSON.stringify(o.meta.configHash)) {
    throw new Error(`cannot resume ${o.runId}: the configuration changed (config hash differs)`);
  }
  const existing = latestRows(readRows(itemsFile));
  const done = new Set(existing.filter((r) => r.status !== 'failed').map((r) => `${r.itemId}#${r.repeat}`));

  const record: RunRecord = {
    runId: o.runId, mode: o.mode, dataset: { ref: `${ds.name}@${ds.version}`, manifestSha256: ds.manifestSha256, items: ds.items.length },
    repeat: o.repeat, budgetPaise: o.budgetPaise, status: 'running', startedAt: prior?.startedAt ?? new Date().toISOString(),
    tokens: prior?.tokens ?? ZERO, costPaise: prior?.costPaise ?? 0, counts: { ok: 0, failed: 0, no_grounding: 0, skipped: 0 }, failures: [], meta: o.meta,
  };
  const budget = new Budget(o.budgetPaise);
  budget.spent = record.costPaise;
  const save = () => writeFileSync(runFile, JSON.stringify(record, null, 2));
  save();

  const { tasks, skipped } = planTasks(ds, o, done, deps.price);
  const write = (rows: ItemRow[]) => {
    if (!rows.length) return;
    appendFileSync(itemsFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    for (const r of rows) {
      record.tokens = addUsage(record.tokens, r.tokens);
      record.costPaise += r.costPaise;
    }
  };
  write(skipped.filter((s) => !existing.some((e) => e.itemId === s.itemId && e.repeat === s.repeat)));

  // A call that cannot be priced is recorded as a failure of pricing, never as free.
  const unpriced: string[] = [];
  const paise = (calls: CallCost[]) => calls.reduce((s, c) => {
    const p = deps.price(c);
    if (p === null) { unpriced.push(c.model); return s; }
    return s + p;
  }, 0);
  const usageOf = (calls: CallCost[]) => calls.reduce((u, c) => addUsage(u, c.usage), ZERO);
  const ledger = (calls: CallCost[]): LedgerCall[] => calls.map((c) => ({
    ...c,
    paise: deps.price(c) ?? 0,
    basis: c.batchPricing ? 'table_batch' as const : c.costUsd !== undefined ? 'reported' as const : 'table' as const,
    tableStandardPaise: deps.priceAs?.(c, false) ?? undefined,
    tableBatchPaise: deps.priceAs?.(c, true) ?? undefined,
  }));

  const base = (it: EvalItem, t: Task) => ({ itemId: it.id, questionId: it.question.id, repeat: t.repeat, mode: o.mode });

  async function runTask(t: Task): Promise<ItemRow[]> {
    const started = Date.now();
    if (t.kind === 'read') {
      const it = t.items[0];
      try {
        const r = await deps.read(it);
        return [{ ...base(it, t), status: 'ok', stage: 'read', transcript: r.text, readConfidence: r.confidence, readRoute: r.route, reading: scoreReading(r.text, it.truthTranscript!.text), tokens: usageOf(r.calls), costPaise: paise(r.calls), latencyMs: Date.now() - started, calls: ledger(r.calls) }];
      } catch (e) {
        return [{ ...base(it, t), status: 'failed', stage: 'read', reason: errText(e), tokens: ZERO, costPaise: 0, latencyMs: Date.now() - started }];
      }
    }
    if (t.kind === 'read_group') {
      try {
        const g = await deps.readGroup!(t.items);
        const calls = ledger(g.calls);
        // The group's calls are carried once, on its first item.
        return t.items.map((it, i) => ({
          ...base(it, t), status: 'ok' as const, stage: 'read' as const, transcript: g.results[i].text, readConfidence: g.results[i].confidence, readRoute: g.results[i].route,
          reading: scoreReading(g.results[i].text, it.truthTranscript!.text),
          tokens: i === 0 ? usageOf(g.calls) : ZERO, costPaise: i === 0 ? calls.reduce((s, c) => s + c.paise, 0) : 0, latencyMs: Date.now() - started, ...(i === 0 ? { calls } : {}),
        }));
      } catch (e) {
        return t.items.map((it) => ({ ...base(it, t), status: 'failed' as const, stage: 'read' as const, reason: errText(e), tokens: ZERO, costPaise: 0, latencyMs: Date.now() - started }));
      }
    }
    if (t.kind === 'key') {
      const req = keyRequestOf(t.items[0]) as KeyRequest;
      try {
        const k = await deps.buildKey(req);
        const calls: CallCost[] = k.calls.map((c) => ({ model: c.model, usage: c.usage, costUsd: c.costUsd, batchPricing: c.batchPricing, step: (c.role === 'embed' ? 'key_retrieval' : c.role === 'writer' ? 'key_writer' : 'key_verifier') as CostStep }));
        const summary: ItemRow['key'] = k.status === 'grounded'
          ? { status: k.status, source: k.source, points: k.key.valuePoints.length, marksSum: k.key.valuePoints.reduce((s, p) => s + p.marks, 0), partial: k.partial, citations: k.citations.length, notes: k.notes }
          : { status: k.status, reason: k.reason, notes: k.notes };
        const status: RowStatus = k.status === 'grounded' ? 'ok' : k.status === 'no_grounding' ? 'no_grounding' : 'failed';
        // Cost is carried once, on the question's first item.
        return t.items.map((it, i) => ({
          ...base(it, t), status, stage: 'key' as const, reason: k.status === 'grounded' ? undefined : `${k.reason}: ${k.detail}`, key: summary,
          tokens: i === 0 ? usageOf(calls) : ZERO, costPaise: i === 0 ? paise(calls) : 0, latencyMs: Date.now() - started, ...(i === 0 ? { calls: ledger(calls) } : {}),
        }));
      } catch (e) {
        return t.items.map((it) => ({ ...base(it, t), status: 'failed' as const, stage: 'key' as const, reason: errText(e), tokens: ZERO, costPaise: 0, latencyMs: Date.now() - started }));
      }
    }

    // mark / e2e
    const q = gradeQuestionOf(t.items[0]) as GradeQuestion;
    const rows = new Map<string, ItemRow>();
    const transcripts = new Map<string, string>();
    if (t.kind === 'e2e') {
      for (const it of t.items) {
        try {
          const r = await deps.read(it);
          transcripts.set(it.id, r.text);
          rows.set(it.id, { ...base(it, t), status: 'ok', transcript: r.text, readConfidence: r.confidence, readRoute: r.route, reading: scoreReading(r.text, it.truthTranscript!.text), tokens: usageOf(r.calls), costPaise: paise(r.calls), latencyMs: 0, calls: ledger(r.calls) });
        } catch (e) {
          rows.set(it.id, { ...base(it, t), status: 'failed', stage: 'read', reason: errText(e), tokens: ZERO, costPaise: 0, latencyMs: 0 });
        }
      }
    }
    const markInto = async (answers: { answerId: string; transcript: string }[], field: 'mark' | 'markTruth') => {
      if (!answers.length) return;
      try {
        const g = await deps.grade(q, answers);
        const each = { tokens: usageOf(g.calls), cost: paise(g.calls) };
        const byId = new Map(g.results.map((r) => [r.answerId, r]));
        answers.forEach((a, i) => {
          const it = t.items.find((x) => x.id === a.answerId)!;
          const row = rows.get(a.answerId) ?? { ...base(it, t), status: 'ok' as const, tokens: ZERO, costPaise: 0, latencyMs: 0 };
          const res = byId.get(a.answerId);
          if (!res) Object.assign(row, { status: 'failed', stage: 'mark', reason: 'no grade result for this answer' });
          else row[field] = markOf(res);
          // The chunk's cost is carried once, on its first answer.
          if (i === 0) { row.tokens = addUsage(row.tokens, each.tokens); row.costPaise += each.cost; row.calls = [...(row.calls ?? []), ...ledger(field === 'markTruth' ? g.calls.map((c) => ({ ...c, purpose: 'eval_truth_mark' as const })) : g.calls)]; }
          rows.set(a.answerId, row);
        });
      } catch (e) {
        for (const a of answers) {
          const it = t.items.find((x) => x.id === a.answerId)!;
          rows.set(a.answerId, { ...(rows.get(a.answerId) ?? { ...base(it, t), tokens: ZERO, costPaise: 0, latencyMs: 0 }), status: 'failed', stage: 'mark', reason: errText(e) });
        }
      }
    };
    if (t.kind === 'mark') {
      await markInto(t.items.map((it) => ({ answerId: it.id, transcript: it.truthTranscript!.text })), 'mark');
    } else {
      await markInto(t.items.filter((it) => transcripts.has(it.id)).map((it) => ({ answerId: it.id, transcript: transcripts.get(it.id)! })), 'mark');
      await markInto(t.items.map((it) => ({ answerId: it.id, transcript: it.truthTranscript!.text })), 'markTruth');
    }
    const ms = Date.now() - started;
    return t.items.map((it) => ({ ...rows.get(it.id)!, latencyMs: ms }));
  }

  // A small pool; the budget is checked before every task starts.
  const queue = o.maxTasks !== undefined ? tasks.slice(0, o.maxTasks) : [...tasks];
  let next = 0;
  const worker = async () => {
    while (next < queue.length && !budget.reached) {
      const t = queue[next++];
      if (!budget.reserve(t.projected)) break;
      const rows = await runTask(t);
      budget.settle(t.projected, rows.reduce((s, r) => s + r.costPaise, 0));
      write(rows);
      save();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency) }, worker));

  const all = latestRows(readRows(itemsFile));
  record.counts = { ok: 0, failed: 0, no_grounding: 0, skipped: 0 };
  for (const r of all) record.counts[r.status]++;
  record.failures = all.filter((r) => r.status === 'failed').map((r) => ({ itemId: r.itemId, repeat: r.repeat, stage: r.stage ?? o.mode, reason: r.reason ?? '' }));
  const finished = all.filter((r) => r.status !== 'failed').length;
  const expectedRows = ds.items.length * o.repeat;
  record.status = budget.reached ? 'budget_reached' : o.maxTasks !== undefined && finished < expectedRows ? 'aborted' : 'completed';
  if (unpriced.length) record.meta = { ...record.meta, unpricedCalls: unpriced.length, unpricedModels: [...new Set(unpriced)] };
  record.endedAt = new Date().toISOString();
  save();
  return record;
}
