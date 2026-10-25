// Key cache (stage1-design.md §2.6). The cache key covers the request, every setting that
// can change a key, and the exact passages retrieved, so a changed book or prompt never
// returns a stale key. Evals keep the cache in eval storage only.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { KeyResult } from './types';

/** JSON with object keys sorted at every level; undefined fields dropped. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v instanceof Set) return canonicalJson([...v].sort());
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export function cacheKeyOf(request: unknown, configHash: string, passages: readonly { id: string; text: string }[]): string {
  const passageHash = sha256(canonicalJson(passages.map((p) => [p.id, sha256(p.text)])));
  return sha256(`${canonicalJson(request)}|${configHash}|${passageHash}`);
}

/**
 * Only grounded keys are cached. no_grounding is decided before any writer call (retrieval
 * is one embedding), and an invalid key is retried next time rather than remembered.
 */
export type CachedKey = Extract<KeyResult, { status: 'grounded' }>;

export interface KeyCache {
  get(key: string): Promise<CachedKey | null>;
  set(key: string, value: CachedKey): Promise<void>;
}

/** One JSON file per key under a directory (an eval run's storage). */
export function fileKeyCache(dir: string): KeyCache {
  return {
    async get(key) {
      const f = join(dir, `${key}.json`);
      return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as CachedKey) : null;
    },
    async set(key, value) {
      mkdirSync(dir, { recursive: true });
      const f = join(dir, `${key}.json`);
      writeFileSync(`${f}.tmp`, JSON.stringify(value, null, 2));
      renameSync(`${f}.tmp`, f);
    },
  };
}

export function memoryKeyCache(): KeyCache & { size(): number } {
  const m = new Map<string, CachedKey>();
  return {
    async get(k) { return m.get(k) ? structuredClone(m.get(k)!) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    size: () => m.size,
  };
}
