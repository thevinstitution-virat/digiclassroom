// Real dependencies for the eval runner: the production reader, rule grader, AI grader and
// key service, called as libraries. No database: the runner never writes a product table.

import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { getHwConfig } from '../config';
import { estimateCost, parsePriceTable } from '../cost/pricing';
import { generate, withStep, type CallOptions } from '../ai';
import { AiGrader } from '../grader/ai-grader';
import { StrictGrader } from '../grader/strict';
import { groupForMarking } from '../grader/instruction-screen';
import { gradeWithoutAi } from '../grader/exact-match';
import type { GradeResult } from '../grader/types';
import { GeminiReader, readCall } from '../reader/gemini-reader';
import { decideAfterRead, type EscalationPolicy } from '../reader/escalation';
import { buildKey, defaultKeyDeps, fileKeyCache, type KeySettings } from '../keys';
import type { HwLanguage } from '@/db/hw-schema';
import { mediaPath, type Dataset, type EvalItem } from './dataset';
import type { CallCost, CostStep, ReadRoute, RunnerDeps } from './runner';

const MIME: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

/** Width and height of a PNG or JPEG, read from its header; null for anything else. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
      }
      i += 2 + v.getUint16(i + 2);
    }
  }
  return null;
}

export interface LiveSettings {
  /** Tier 1 model, and the tier 2 model with the policy that escalates to it (production route). */
  reader: {
    model: string;
    escalateModel?: string;
    policy: EscalationPolicy;
    tier1Options?: CallOptions;
    tier2Options?: CallOptions;
    /** Escalate every answer (to measure the escalation step on its own). */
    forceEscalation?: boolean;
    /** Price this tier at the batch rate from the measured tokens. */
    batchPricing?: { tier1?: boolean; tier2?: boolean };
  };
  grader: { model: string; options?: CallOptions; valuePointsOnly?: boolean; batchPricing?: boolean; strict?: boolean; strictVersion?: 1 | 2; guards?: boolean };
  keys?: KeySettings;
  keyBatchPricing?: boolean;
  /** Measure how many of a read call's input tokens are the image: one text-only twin call per model and shape (its cost is recorded as a measurement). */
  splitImageTokens?: boolean;
  keyCacheDir: string;
  priceTableJson: string | undefined;
}

/** A provider hiccup worth another try: rate limiting, a credit check that timed out, a server error, a dropped connection. */
export const isTransient = (e: unknown): boolean => /HTTP (429|5\d\d)|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(e instanceof Error ? e.message : String(e));

/**
 * Eval-only retry with exponential backoff (4 s, 8 s, 16 s, 32 s, 64 s). Production has its own: the job queue
 * retries provider errors. Every retry is counted so a run says how often the provider pushed back.
 */
export async function withRetry<T>(fn: () => Promise<T>, stats: { retries: number }, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 5 || !isTransient(e)) throw e;
      stats.retries++;
      await sleep(4000 * 2 ** attempt);
    }
  }
}

export function liveDeps(ds: Dataset, s: LiveSettings): RunnerDeps {
  const stats = { retries: 0 };
  const table = parsePriceTable(s.priceTableJson);
  const tier1 = new GeminiReader(s.reader.model, 1, s.reader.tier1Options);
  const tier2 = s.reader.escalateModel ? new GeminiReader(s.reader.escalateModel, 2, s.reader.tier2Options) : null;
  const keyDeps = s.keys ? defaultKeyDeps({ cache: fileKeyCache(s.keyCacheDir) }) : null;

  const imageOf = (item: EvalItem) => {
    const rel = item.media.render ?? item.media.photo;
    if (!rel) throw new Error('no render or photo');
    const mimeType = MIME[extname(rel).toLowerCase()];
    if (!mimeType) throw new Error(`unsupported image type ${extname(rel)}`);
    const png = new Uint8Array(readFileSync(mediaPath(ds, rel)));
    return { rel, mimeType, png, size: imageSize(png) };
  };
  const inputFor = (items: EvalItem[]) => {
    const imgs = items.map(imageOf);
    return {
      input: { answers: items.map((item, i) => ({ answerId: item.id, languageHint: item.language as HwLanguage, png: imgs[i].png, mimeType: imgs[i].mimeType })) },
      images: { count: imgs.length, bytes: imgs.reduce((n, x) => n + x.png.length, 0), pixels: imgs.reduce((n, x) => n + (x.size ? x.size.width * x.size.height : 0), 0) },
    };
  };
  const call = (step: CostStep, r: { model: string; usage: CallCost['usage']; costUsd?: number }, extra: Partial<CallCost>): CallCost =>
    ({ model: r.model, usage: r.usage, costUsd: r.costUsd, step, ...extra });

  // The same request without its images: its prompt tokens are the text part of a read call.
  const twins = new Map<string, number>();
  async function withImageSplit(c: CallCost, reader: GeminiReader, input: ReturnType<typeof inputFor>['input'], extra: CallCost[]): Promise<CallCost> {
    if (!s.splitImageTokens) return c;
    const key = `${reader.model}|${input.answers.length}|${reader.options?.mediaResolution ?? ''}`;
    if (!twins.has(key)) {
      const full = readCall(reader.model, input, reader.options);
      const res = await withStep('measure_text_only', () => generate({ ...full, parts: full.parts.filter((p) => !p.inlineData) }));
      twins.set(key, res.usage.input);
      extra.push({ model: res.model, usage: res.usage, costUsd: res.costUsd, purpose: 'measurement' });
    }
    const text = twins.get(key)!;
    return { ...c, usage: { ...c.usage, inputText: text, inputImage: Math.max(0, c.usage.input - text) } };
  }

  /** Tier 1, then tier 2 when the policy (or the forced escalation) says so, for a set of answers read together. */
  async function readTogether(items: EvalItem[]) {
    const { input, images } = inputFor(items);
    const calls: CallCost[] = [];
    const r1 = await withStep('read_tier1', () => withRetry(() => tier1.read(input), stats));
    calls.push(await withImageSplit(call('read_tier1', r1, { images, answers: items.length, batchPricing: s.reader.batchPricing?.tier1 }), tier1, input, calls));
    let answers = r1.answers;
    const routes: ReadRoute[] = items.map(() => 'tier1');
    // Tier 2 re-reads only the answers in doubt, as the read handler does.
    const doubtful = items.map((_, i) => i).filter((i) => s.reader.forceEscalation || decideAfterRead(r1.answers[i], 1, s.reader.policy).action === 'escalate');
    if (tier2 && doubtful.length) {
      const sub = inputFor(doubtful.map((i) => items[i]));
      const r2 = await withStep('read_escalation', () => withRetry(() => tier2.read(sub.input), stats));
      calls.push(await withImageSplit(call('read_escalation', r2, { images: sub.images, answers: doubtful.length, batchPricing: s.reader.batchPricing?.tier2 }), tier2, sub.input, calls));
      answers = [...answers];
      doubtful.forEach((i, k) => {
        answers[i] = r2.answers[k];
        routes[i] = decideAfterRead(r2.answers[k], 2, s.reader.policy).action === 'needs_review' ? 'needs_review' : 'tier2';
      });
    }
    return { results: answers.map((a, i) => ({ text: a.text, unclearCount: a.unclearCount, confidence: a.confidence, route: routes[i] })), calls };
  }

  return {
    stats,
    async read(item: EvalItem) {
      const { results, calls } = await readTogether([item]);
      return { ...results[0], calls };
    },
    readGroup: (items) => readTogether(items),

    async grade(question, answers) {
      // As production: blank and exact-match answers are marked by rule, the rest by AI.
      const q = s.grader.valuePointsOnly ? { ...question, modelAnswer: null } : question;
      const results: GradeResult[] = [];
      const toAi: typeof answers = [];
      for (const a of answers) {
        const rule = gradeWithoutAi(q, a.answerId, a.transcript, { codeMarking: getHwConfig().HW_CODE_MARKING_ENABLED });
        if (rule) results.push(rule);
        else toAi.push(a);
      }
      const calls: CallCost[] = [];
      if (toAi.length) {
        // With the guards, an answer addressed to the marker is marked alone: the rest of the chunk goes in one call.
        for (const group of groupForMarking(toAi, Math.max(1, toAi.length), Boolean(s.grader.guards))) {
          const g = s.grader.strict ? new StrictGrader(s.grader.model, s.grader.options, { version: s.grader.strictVersion ?? 1 }) : new AiGrader(s.grader.model, s.grader.options);
          results.push(...(await withStep('grade', () => withRetry(() => g.grade({ question: q, answers: group }), stats))));
          if (g.lastCall) calls.push(call('grade', g.lastCall, { answers: group.length, batchPricing: s.grader.batchPricing }));
        }
      }
      return { results, calls };
    },

    async buildKey(req) {
      if (!keyDeps || !s.keys) throw new Error('key mode needs key settings (HW_KEY_* and a calibrated HW_KEY_R_MIN)');
      const k = await buildKey(req, { ...keyDeps, generate: (p, c) => withStep(c.model === s.keys!.verifier.model ? 'key_verifier' : 'key_writer', () => keyDeps.generate(p, c)) }, s.keys);
      if (s.keyBatchPricing) for (const c of k.calls) if (c.role !== 'embed') c.batchPricing = true;
      return k;
    },

    price(c) {
      if ('problem' in table) return null;
      // A call priced as batch uses the measured tokens at the table's batch rates, whatever the provider charged.
      if (c.batchPricing) {
        const e = estimateCost(table, c.model, c.usage, { batch: true });
        return e.problem ? null : e.paise;
      }
      if (c.costUsd !== undefined) return Math.round(c.costUsd * table.inr_per_usd * 100 * 10_000) / 10_000;
      const e = estimateCost(table, c.model, c.usage, { batch: false });
      return e.problem ? null : e.paise;
    },

    priceAs(c, batch) {
      if ('problem' in table) return null;
      const e = estimateCost(table, c.model, c.usage, { batch });
      return e.problem ? null : e.paise;
    },
  };
}

/** For run records: where the key cache for a runs folder lives. */
export const keyCacheDirFor = (runsRoot: string) => join(runsRoot, '..', 'key-cache');
