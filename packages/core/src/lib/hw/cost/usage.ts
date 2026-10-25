// Records real token usage from every provider call: on the job row and in the monthly
// roll-up. Called with the provider's own counts; nothing here invents a number.

import { eq, sql } from 'drizzle-orm';
import { hwAiJob, hwAiUsageMonthly } from '@/db/hw-schema';
import { getHwConfig } from '../config';
import { monthKey, type Exec } from '../db';
import { estimateCost, parsePriceTable, type TokenUsage } from './pricing';

export interface UsageRecord {
  /** The job the call belongs to; null for shadow-mode calls, which count only in the monthly roll-up. */
  jobId: string | null;
  orgId: string;
  model: string;
  usage: TokenUsage;
  batch: boolean;
  pagesRead?: number;
  answersGraded?: number;
  /** What the provider reports it charged (USD). Used instead of the estimate when present. */
  costUsd?: number;
}

/** The provider's reported cost when given, otherwise the price table's estimate. */
export function costOf(r: Pick<UsageRecord, 'model' | 'usage' | 'batch' | 'costUsd'>): { paise: number; problem?: string } {
  const table = parsePriceTable(getHwConfig().HW_PRICE_TABLE_JSON);
  return r.costUsd !== undefined && !('problem' in table)
    ? { paise: Math.round(r.costUsd * table.inr_per_usd * 100 * 10_000) / 10_000 }
    : estimateCost(table, r.model, r.usage, { batch: r.batch });
}

/** Returns the cost problem, if any, so the caller can surface it on the job. */
export async function recordUsage(x: Exec, r: UsageRecord): Promise<string | undefined> {
  const cost = costOf(r);
  if (cost.problem) console.error(`[hw] cost not estimated for ${r.jobId ? `job ${r.jobId}` : 'a shadow call'}: ${cost.problem}`);

  if (r.jobId) {
    await x.update(hwAiJob).set({
      tokensIn: sql`${hwAiJob.tokensIn} + ${r.usage.input}`,
      tokensCached: sql`${hwAiJob.tokensCached} + ${r.usage.cached}`,
      tokensOut: sql`${hwAiJob.tokensOut} + ${r.usage.output}`,
      costEstimatePaise: sql`${hwAiJob.costEstimatePaise} + ${cost.paise}`,
    }).where(eq(hwAiJob.id, r.jobId));
  }

  await x.insert(hwAiUsageMonthly).values({
    organizationId: r.orgId,
    month: monthKey(),
    pagesRead: r.pagesRead ?? 0,
    answersGraded: r.answersGraded ?? 0,
    tokensIn: r.usage.input,
    tokensCached: r.usage.cached,
    tokensOut: r.usage.output,
    costPaise: String(cost.paise),
  }).onConflictDoUpdate({
    target: [hwAiUsageMonthly.organizationId, hwAiUsageMonthly.month],
    set: {
      pagesRead: sql`${hwAiUsageMonthly.pagesRead} + ${r.pagesRead ?? 0}`,
      answersGraded: sql`${hwAiUsageMonthly.answersGraded} + ${r.answersGraded ?? 0}`,
      tokensIn: sql`${hwAiUsageMonthly.tokensIn} + ${r.usage.input}`,
      tokensCached: sql`${hwAiUsageMonthly.tokensCached} + ${r.usage.cached}`,
      tokensOut: sql`${hwAiUsageMonthly.tokensOut} + ${r.usage.output}`,
      costPaise: sql`${hwAiUsageMonthly.costPaise} + ${cost.paise}`,
    },
  });

  return cost.problem;
}
