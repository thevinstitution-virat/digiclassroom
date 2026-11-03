// Shared database handle types for the feature.

import { randomUUID } from 'node:crypto';
import { db } from '@/db';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the pool or an open transaction. */
export type Exec = typeof db | Tx;

export { db };

export const newId = (): string => randomUUID();

/** numeric columns come back as strings. */
export const num = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

/** India Standard Time is UTC+05:30 all year (no daylight saving). */
export const IST_OFFSET_MS = 5.5 * 3_600_000;

/**
 * First day of the current month in INDIA STANDARD TIME, as stored in hw_ai_usage_monthly.month (roadmap 5.1: a month starts at midnight IST,
 * not at 05:30 IST as the UTC month did). Rows written before this change are keyed by the UTC month; none exist in production.
 */
export function monthKey(d = new Date()): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
