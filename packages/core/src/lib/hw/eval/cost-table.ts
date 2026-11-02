// The per-step cost table of the cost work: one row per pipeline step, from the calls a run
// recorded (items.jsonl rows carry them). Every number is a provider-reported usage field or
// the provider's own charge; nothing here estimates tokens.

import type { ItemRow, LedgerCall, CostStep } from './runner';

export const STEP_LABEL: Record<CostStep, string> = {
  read_tier1: 'tier-1 read',
  read_escalation: 'escalation read',
  key_retrieval: 'key retrieval / embedding',
  key_writer: 'key writer',
  key_verifier: 'key verifier',
  grade: 'grade',
};
export const STEP_ORDER: CostStep[] = ['read_tier1', 'read_escalation', 'key_retrieval', 'key_writer', 'key_verifier', 'grade'];

export interface StepRow {
  step: CostStep;
  label: string;
  models: string[];
  calls: number;
  /** Answers (or, for key steps, questions) the run handled; the denominator of the per-answer columns. */
  answers: number;
  callsPerAnswer: number;
  /** Mean per call, for steps that send images. */
  imagesPerCall: number | null;
  imagePxPerImage: number | null;
  imageKbPerImage: number | null;
  inputTokens: { total: number; image: number | null; text: number | null };
  cached: number;
  cacheWrite: number | null;
  output: number;
  thinking: number | null;
  /** Total ₹ of the step in the run, as charged (reported cost, or the price table's batch rates for a batch-priced call). */
  inr: number;
  inrPerAnswer: number;
  /** The same tokens at the table's standard / batch rates. */
  tableStandardInr: number;
  tableBatchInr: number;
  shareOfTotal: number;
  basis: ('reported' | 'table' | 'table_batch')[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const opt = (xs: (number | undefined)[]) => (xs.some((x) => x !== undefined) ? sum(xs.map((x) => x ?? 0)) : null);

export function callsOf(rows: readonly ItemRow[]): LedgerCall[] {
  return rows.flatMap((r) => r.calls ?? []);
}

/** `answers` = how many answers the run handled (items × repeats that were not skipped); for key runs, how many keys were built. */
export function stepTable(rows: readonly ItemRow[], answers: number): StepRow[] {
  const calls = callsOf(rows).filter((c) => c.purpose === undefined);
  const total = sum(calls.map((c) => c.paise));
  const out: StepRow[] = [];
  for (const step of STEP_ORDER) {
    const cs = calls.filter((c) => c.step === step);
    if (!cs.length) continue;
    const withImages = cs.filter((c) => c.images && c.images.count > 0);
    const imageCount = sum(withImages.map((c) => c.images!.count));
    const inr = sum(cs.map((c) => c.paise)) / 100;
    out.push({
      step, label: STEP_LABEL[step], models: [...new Set(cs.map((c) => c.model))], calls: cs.length, answers,
      callsPerAnswer: cs.length / answers,
      imagesPerCall: withImages.length ? imageCount / withImages.length : null,
      imagePxPerImage: imageCount ? sum(withImages.map((c) => c.images!.pixels)) / imageCount : null,
      imageKbPerImage: imageCount ? sum(withImages.map((c) => c.images!.bytes)) / imageCount / 1024 : null,
      inputTokens: { total: sum(cs.map((c) => c.usage.input)), image: opt(cs.map((c) => c.usage.inputImage)), text: opt(cs.map((c) => c.usage.inputText)) },
      cached: sum(cs.map((c) => c.usage.cached)),
      cacheWrite: opt(cs.map((c) => c.usage.cacheWrite)),
      output: sum(cs.map((c) => c.usage.output)),
      thinking: opt(cs.map((c) => c.usage.thinking)),
      inr, inrPerAnswer: inr / answers,
      tableStandardInr: sum(cs.map((c) => c.tableStandardPaise ?? 0)) / 100,
      tableBatchInr: sum(cs.map((c) => c.tableBatchPaise ?? 0)) / 100,
      shareOfTotal: total ? (inr * 100) / total : 0,
      basis: [...new Set(cs.map((c) => c.basis))],
    });
  }
  return out;
}

export function stepTableMarkdown(rows: StepRow[]): string {
  const f = (n: number | null, d = 0) => (n === null ? 'n/r' : n.toFixed(d));
  const head = '| Step | Model | Calls per answer | Image px and KB | Input tokens (image / text) | Cached | Cache-write | Output | Thinking | ₹ per answer | Share of total |\n|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rows.map((r) => {
    const img = r.imagePxPerImage !== null ? `${f(r.imagePxPerImage / 1000, 0)}k px (${f(r.imageKbPerImage, 0)} KB) ×${f(r.imagesPerCall, 1)}` : '–';
    const inTok = `${f(r.inputTokens.total / r.calls)} (${r.inputTokens.image === null ? 'n/r' : f(r.inputTokens.image / r.calls)} / ${r.inputTokens.text === null ? 'n/r' : f(r.inputTokens.text / r.calls)})`;
    return `| ${r.label} | ${r.models.join(', ')} | ${r.callsPerAnswer.toFixed(2)} | ${img} | ${inTok} | ${f(r.cached / r.calls)} | ${r.cacheWrite === null ? 'n/r' : f(r.cacheWrite / r.calls)} | ${f(r.output / r.calls)} | ${r.thinking === null ? 'n/r' : f(r.thinking / r.calls)} | ₹${r.inrPerAnswer.toFixed(4)} | ${(r.shareOfTotal * 100).toFixed(0)}% |`;
  });
  return [head, ...lines].join('\n');
}
