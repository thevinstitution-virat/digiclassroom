// Real dependencies for the eval runner: the production reader, rule grader, AI grader and
// key service, called as libraries. No database: the runner never writes a product table.

import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { estimateCost, parsePriceTable } from '../cost/pricing';
import { AiGrader } from '../grader/ai-grader';
import { gradeWithoutAi } from '../grader/exact-match';
import type { GradeResult } from '../grader/types';
import { GeminiReader } from '../reader/gemini-reader';
import { decideAfterRead, type EscalationPolicy } from '../reader/escalation';
import { buildKey, defaultKeyDeps, fileKeyCache, type KeySettings } from '../keys';
import type { HwLanguage } from '@/db/hw-schema';
import { mediaPath, type Dataset, type EvalItem } from './dataset';
import type { CallCost, RunnerDeps } from './runner';

const MIME: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export interface LiveSettings {
  /** Tier 1 model, and the tier 2 model with the policy that escalates to it (production route). */
  reader: { model: string; escalateModel?: string; policy: EscalationPolicy };
  grader: { model: string };
  keys?: KeySettings;
  keyCacheDir: string;
  priceTableJson: string | undefined;
}

export function liveDeps(ds: Dataset, s: LiveSettings): RunnerDeps {
  const table = parsePriceTable(s.priceTableJson);
  const tier1 = new GeminiReader(s.reader.model, 1);
  const tier2 = s.reader.escalateModel ? new GeminiReader(s.reader.escalateModel, 2) : null;
  const keyDeps = s.keys ? defaultKeyDeps({ cache: fileKeyCache(s.keyCacheDir) }) : null;

  return {
    async read(item: EvalItem) {
      const rel = item.media.render ?? item.media.photo;
      if (!rel) throw new Error('no render or photo');
      const mimeType = MIME[extname(rel).toLowerCase()];
      if (!mimeType) throw new Error(`unsupported image type ${extname(rel)}`);
      const png = new Uint8Array(readFileSync(mediaPath(ds, rel)));
      const input = { answers: [{ answerId: item.id, languageHint: item.language as HwLanguage, png, mimeType }] };
      const r1 = await tier1.read(input);
      const calls: CallCost[] = [{ model: r1.model, usage: r1.usage, costUsd: r1.costUsd }];
      let a = r1.answers[0];
      let route: 'tier1' | 'tier2' | 'needs_review' = 'tier1';
      if (decideAfterRead(a, 1, s.reader.policy).action === 'escalate' && tier2) {
        const r2 = await tier2.read(input);
        calls.push({ model: r2.model, usage: r2.usage, costUsd: r2.costUsd });
        a = r2.answers[0];
        route = decideAfterRead(a, 2, s.reader.policy).action === 'needs_review' ? 'needs_review' : 'tier2';
      }
      return { text: a.text, unclearCount: a.unclearCount, confidence: a.confidence, route, calls };
    },

    async grade(question, answers) {
      // As production: blank and exact-match answers are marked by rule, the rest by AI.
      const results: GradeResult[] = [];
      const toAi: typeof answers = [];
      for (const a of answers) {
        const rule = gradeWithoutAi(question, a.answerId, a.transcript);
        if (rule) results.push(rule);
        else toAi.push(a);
      }
      const calls: CallCost[] = [];
      if (toAi.length) {
        const g = new AiGrader(s.grader.model);
        results.push(...(await g.grade({ question, answers: toAi })));
        if (g.lastCall) calls.push({ model: g.lastCall.model, usage: g.lastCall.usage, costUsd: g.lastCall.costUsd });
      }
      return { results, calls };
    },

    async buildKey(req) {
      if (!keyDeps || !s.keys) throw new Error('key mode needs key settings (HW_KEY_* and a calibrated HW_KEY_R_MIN)');
      return buildKey(req, keyDeps, s.keys);
    },

    price(call) {
      if ('problem' in table) return null;
      if (call.costUsd !== undefined) return Math.round(call.costUsd * table.inr_per_usd * 100 * 10_000) / 10_000;
      const c = estimateCost(table, call.model, call.usage, { batch: false });
      return c.problem ? null : c.paise;
    },
  };
}

/** For run records: where the key cache for a runs folder lives. */
export const keyCacheDirFor = (runsRoot: string) => join(runsRoot, '..', 'key-cache');
