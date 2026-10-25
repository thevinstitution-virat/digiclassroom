// Cost estimates from real token counts and the rates in HW_PRICE_TABLE_JSON.
//
// Format (USD per 1M tokens, as the provider publishes them):
//   {
//     "inr_per_usd": 84,
//     "models": {
//       "gemini-3.5-flash-lite": { "input": 0.30, "cached": 0.03, "output": 2.50,
//                                  "batch_input": 0.15, "batch_output": 1.25 }
//     }
//   }
// Output includes thinking tokens: providers bill them as output.

import { z } from 'zod';

const Rate = z.object({
  input: z.number().nonnegative(),
  cached: z.number().nonnegative(),
  output: z.number().nonnegative(),
  batch_input: z.number().nonnegative().optional(),
  batch_output: z.number().nonnegative().optional(),
});

const PriceTable = z.object({
  inr_per_usd: z.number().positive(),
  models: z.record(Rate),
});

export type PriceTable = z.infer<typeof PriceTable>;

export interface TokenUsage {
  /** All prompt tokens, including the cached ones. */
  input: number;
  /** The part of `input` served from cache. */
  cached: number;
  /** Visible output plus thinking. */
  output: number;
}

export interface CostEstimate {
  paise: number;
  /** Set when the estimate could not be made; the job records this instead of a silent 0. */
  problem?: string;
}

export function parsePriceTable(json: string | undefined): PriceTable | { problem: string } {
  if (!json) return { problem: 'HW_PRICE_TABLE_JSON is not set; cost not estimated' };
  try {
    const parsed = PriceTable.safeParse(JSON.parse(json));
    if (!parsed.success) return { problem: `HW_PRICE_TABLE_JSON is invalid: ${parsed.error.issues[0]?.message ?? 'unknown'}` };
    return parsed.data;
  } catch {
    return { problem: 'HW_PRICE_TABLE_JSON is not valid JSON; cost not estimated' };
  }
}

export function estimateCost(
  table: PriceTable | { problem: string },
  model: string,
  usage: TokenUsage,
  opts: { batch: boolean },
): CostEstimate {
  if ('problem' in table) return { paise: 0, problem: table.problem };
  // Responses may name a versioned model ("gemini-x-001"); fall back to the longest listed prefix.
  const key = table.models[model] ? model : Object.keys(table.models).filter((k) => model.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  const rate = key ? table.models[key] : undefined;
  if (!rate) return { paise: 0, problem: `no price for model ${model} in HW_PRICE_TABLE_JSON` };

  const inputRate = opts.batch ? rate.batch_input ?? rate.input : rate.input;
  const outputRate = opts.batch ? rate.batch_output ?? rate.output : rate.output;
  const uncached = Math.max(0, usage.input - usage.cached);
  const usd = (uncached * inputRate + usage.cached * rate.cached + usage.output * outputRate) / 1_000_000;
  return { paise: Math.round(usd * table.inr_per_usd * 100 * 10_000) / 10_000 };
}
