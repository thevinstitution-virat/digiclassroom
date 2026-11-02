// The shared key library in Postgres (hw_shared_key, migration 019). Separate from shared.ts so
// that eval scripts, which never touch a database, do not import the pool.

import { eq, sql } from 'drizzle-orm';
import { hwSharedKey } from '@/db/hw-cost-schema';
import { db } from '../db';
import type { CachedKey } from './cache';
import type { SharedKeyStore } from './shared';

export function pgSharedKeyStore(): SharedKeyStore {
  return {
    async get(cacheKey) {
      const [row] = await db.select({ result: hwSharedKey.result }).from(hwSharedKey).where(eq(hwSharedKey.cacheKey, cacheKey)).limit(1);
      if (!row) return null;
      await db.update(hwSharedKey).set({ lastUsedAt: new Date(), useCount: sql`${hwSharedKey.useCount} + 1` }).where(eq(hwSharedKey.cacheKey, cacheKey));
      return row.result as unknown as CachedKey;
    },
    async put(e) {
      await db.insert(hwSharedKey).values({
        cacheKey: e.id.cacheKey,
        questionHash: e.id.questionHash,
        questionOrigin: e.origin,
        source: e.source,
        sourceRef: e.id.sourceRef,
        keyServiceVersion: e.keyServiceVersion,
        configHash: e.configHash,
        result: e.key as unknown as Record<string, unknown>,
      }).onConflictDoNothing();
    },
  };
}
