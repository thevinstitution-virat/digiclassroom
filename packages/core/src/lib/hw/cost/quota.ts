// Monthly AI quota per institution, checked BEFORE any provider call.
//
// Two rules, one at a time per institution (roadmap 5.1):
//   - BUDGET (monthly_budget_paise > 0): this month's recorded AI cost, in paise, against the institution's budget. The month is the
//     Indian Standard Time month (lib/hw/db.ts monthKey). Reading, marking and drafting all count, as money does. A call is allowed while
//     the month's cost is still below the budget, so the last call can take it over by that one call's cost.
//   - ANSWER COUNT (the older rule, used while no budget is set): hw_tenant_quota.monthly_answer_quota is the number of answers per month
//     that may go through each AI step; reading (pages_read) and marking (answers_graded) are each counted against it.
// Either way, no row or a 0 means AI is off and teachers mark by hand.

import { and, eq } from 'drizzle-orm';
import { hwAiUsageMonthly, hwTenantQuota } from '@/db/hw-schema';
import { monthKey, type Exec } from '../db';

export type QuotaStep = 'read' | 'grade';

export interface QuotaState {
  /** The answer-count quota (older rule). */
  quota: number;
  /** Answers read or marked this month (older rule), for the step asked about. */
  used: number;
  /** The monthly budget in paise; 0 = not set, the answer-count rule applies. */
  budgetPaise: number;
  /** This month's recorded AI cost in paise. */
  usedPaise: number;
}

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/** Pure decision, unit-tested. */
export function quotaAllows(state: QuotaState, requested: number): boolean {
  if (state.budgetPaise > 0) return state.usedPaise < state.budgetPaise;
  return state.quota > 0 && state.used + requested <= state.quota;
}

export function quotaRefusal(state: QuotaState): string {
  if (state.budgetPaise > 0) return `AI quota reached (${rupees(state.usedPaise)} of ${rupees(state.budgetPaise)} this month); please mark by hand.`;
  return state.quota === 0
    ? 'AI is switched off for this institution; please mark by hand.'
    : `AI quota reached (${state.used} of ${state.quota} answers this month); please mark by hand.`;
}

/** For the screens: how much of the budget is spent, and whether the 80% warning applies. Null when no budget is set. */
export function budgetStatus(state: Pick<QuotaState, 'budgetPaise' | 'usedPaise'>): { fraction: number; warn: boolean; exhausted: boolean } | null {
  if (state.budgetPaise <= 0) return null;
  const fraction = state.usedPaise / state.budgetPaise;
  return { fraction, warn: fraction >= 0.8, exhausted: fraction >= 1 };
}

export async function quotaState(x: Exec, orgId: string, step: QuotaStep): Promise<QuotaState> {
  const [q] = await x.select({ quota: hwTenantQuota.monthlyAnswerQuota, budget: hwTenantQuota.monthlyBudgetPaise }).from(hwTenantQuota)
    .where(eq(hwTenantQuota.organizationId, orgId)).limit(1);
  const [u] = await x.select({ pagesRead: hwAiUsageMonthly.pagesRead, answersGraded: hwAiUsageMonthly.answersGraded, costPaise: hwAiUsageMonthly.costPaise })
    .from(hwAiUsageMonthly)
    .where(and(eq(hwAiUsageMonthly.organizationId, orgId), eq(hwAiUsageMonthly.month, monthKey())))
    .limit(1);
  return {
    quota: q?.quota ?? 0,
    used: step === 'read' ? u?.pagesRead ?? 0 : u?.answersGraded ?? 0,
    budgetPaise: Number(q?.budget ?? 0),
    usedPaise: Number(u?.costPaise ?? 0),
  };
}
