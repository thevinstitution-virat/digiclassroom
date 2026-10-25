// Monthly AI quota per institution, checked BEFORE any provider call.
//
// hw_tenant_quota.monthly_answer_quota is the number of answers per month that may go
// through each AI step: reading (pages_read) and marking (answers_graded) are each counted
// against it. 0 means AI is off and teachers mark by hand.

import { and, eq } from 'drizzle-orm';
import { hwAiUsageMonthly, hwTenantQuota } from '@/db/hw-schema';
import { monthKey, type Exec } from '../db';

export type QuotaStep = 'read' | 'grade';

export interface QuotaState {
  quota: number;
  used: number;
}

/** Pure decision, unit-tested. */
export function quotaAllows(state: QuotaState, requested: number): boolean {
  return state.quota > 0 && state.used + requested <= state.quota;
}

export function quotaRefusal(state: QuotaState): string {
  return state.quota === 0
    ? 'AI is switched off for this institution; please mark by hand.'
    : `AI quota reached (${state.used} of ${state.quota} answers this month); please mark by hand.`;
}

export async function quotaState(x: Exec, orgId: string, step: QuotaStep): Promise<QuotaState> {
  const [q] = await x.select({ quota: hwTenantQuota.monthlyAnswerQuota }).from(hwTenantQuota)
    .where(eq(hwTenantQuota.organizationId, orgId)).limit(1);
  const [u] = await x.select({ pagesRead: hwAiUsageMonthly.pagesRead, answersGraded: hwAiUsageMonthly.answersGraded })
    .from(hwAiUsageMonthly)
    .where(and(eq(hwAiUsageMonthly.organizationId, orgId), eq(hwAiUsageMonthly.month, monthKey())))
    .limit(1);
  return {
    quota: q?.quota ?? 0,
    used: step === 'read' ? u?.pagesRead ?? 0 : u?.answersGraded ?? 0,
  };
}
