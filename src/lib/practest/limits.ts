// src/lib/practest/limits.ts
//
// Plan-aware daily limit on PRACTICE TEST creation (separate from the AI-tutor
// question quota). Trial users get 5 tests/day; paid plans get more.
// Change these numbers in one place to adjust policy app-wide.

export const PRACTEST_DAILY_LIMITS: Record<string, number> = {
  FREE_TRIAL: 5,
  BASIC: 10,
  CLASSIC: 20,
  PRO: 100,
}

// Unknown-but-present plan codes get this (lenient); no plan at all gets 0.
export const DEFAULT_PRACTEST_LIMIT = 5

/** Daily practice-test limit for a plan. 0 = no active plan/trial (must start one). */
export function practestDailyLimit(planCode?: string | null): number {
  if (!planCode) return 0
  return PRACTEST_DAILY_LIMITS[planCode] ?? DEFAULT_PRACTEST_LIMIT
}
