// Shared database handle types for the feature.

import { db } from '@/db';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the pool or an open transaction. */
export type Exec = typeof db | Tx;

export { db };

export const newId = (): string => crypto.randomUUID();

/** numeric columns come back as strings. */
export const num = (v: string | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

/** First day of the current month (UTC), as stored in hw_ai_usage_monthly.month. */
export function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
