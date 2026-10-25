// Where the tools read eval material from: dataset manifests and media, and cached answer
// keys. R2 (hw-assignments/evals/…) in deployment; a local folder in development
// (HW_EVAL_LOCAL_ROOT with datasets/<name>/<vN>/… and key-cache/<keyId>.json). Read-only.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { datasetObjectKey, EVAL_PREFIX, mediaPath, parseDatasetRef, parseManifest, type EvalItem } from '../eval/dataset';
import type { CachedKey } from '../keys/cache';
import { getHwObject } from '../storage/r2';

export interface EvalSource {
  items(ref: string): Promise<EvalItem[]>;
  media(ref: string, relPath: string): Promise<Uint8Array>;
  key(keyId: string): Promise<CachedKey | null>;
}

const MAX_CACHE = 20;
const manifests = new Map<string, EvalItem[]>();

function remember(ref: string, items: EvalItem[]): EvalItem[] {
  if (manifests.size >= MAX_CACHE) manifests.delete(manifests.keys().next().value as string);
  manifests.set(ref, items); // datasets are immutable, so a cached manifest never goes stale
  return items;
}

function parse(ref: string, text: string): EvalItem[] {
  const r = parseManifest(text);
  if ('problems' in r) throw new HwError('BAD_REQUEST', `Dataset ${ref} is invalid.`, r.problems.slice(0, 5).join('; '));
  return r.items;
}

const KEY_ID = /^[0-9a-f]{64}$/;

export function localSource(root: string): EvalSource {
  return {
    async items(ref) {
      const hit = manifests.get(`local:${ref}`);
      if (hit) return hit;
      const { name, version } = parseDatasetRef(ref);
      const file = join(root, 'datasets', name, version, 'manifest.jsonl');
      if (!existsSync(file)) throw new HwError('NOT_FOUND', `Dataset ${ref} not found.`);
      return remember(`local:${ref}`, parse(ref, readFileSync(file, 'utf8')));
    },
    async media(ref, rel) {
      const { name, version } = parseDatasetRef(ref);
      return new Uint8Array(readFileSync(mediaPath({ dir: join(root, 'datasets', name, version) }, rel)));
    },
    async key(keyId) {
      if (!KEY_ID.test(keyId)) return null;
      const f = join(root, 'key-cache', `${keyId}.json`);
      return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as CachedKey) : null;
    },
  };
}

export function r2Source(): EvalSource {
  return {
    async items(ref) {
      const hit = manifests.get(`r2:${ref}`);
      if (hit) return hit;
      const bytes = await getHwObject(datasetObjectKey(ref, 'manifest.jsonl')).catch(() => null);
      if (!bytes) throw new HwError('NOT_FOUND', `Dataset ${ref} not found.`);
      return remember(`r2:${ref}`, parse(ref, new TextDecoder().decode(bytes)));
    },
    async media(ref, rel) {
      return getHwObject(datasetObjectKey(ref, rel));
    },
    async key(keyId) {
      if (!KEY_ID.test(keyId)) return null;
      const bytes = await getHwObject(`${EVAL_PREFIX}key-cache/${keyId}.json`).catch(() => null);
      return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as CachedKey) : null;
    },
  };
}

let override: EvalSource | null = null;
/** Tests only. */
export function _setEvalSource(s: EvalSource | null): void { override = s; manifests.clear(); }

export function evalSource(): EvalSource {
  if (override) return override;
  const root = getHwConfig().HW_EVAL_LOCAL_ROOT;
  return root ? localSource(root) : r2Source();
}
