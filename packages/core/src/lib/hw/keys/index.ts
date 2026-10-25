// Answer keys: public entry points. See service.ts for the resolution order.

import { generateWith } from '../ai';
import type { KeyCache } from './cache';
import { gyankoshRetriever } from './retriever';
import type { KeyDeps } from './service';
import { trioReader } from './trio';

export { buildKey, keyConfigHash, keySettingsFromEnv, KEY_RETRIEVAL_VERSION, type KeyDeps, type KeySettings, type OfficialScheme } from './service';
export { fileKeyCache, memoryKeyCache, type KeyCache } from './cache';
export type * from './types';

/** Real dependencies: Gyankosh Qdrant (read), trio content tables (read-only transaction), AI providers. */
export function defaultKeyDeps(opts: { cache?: KeyCache; official?: KeyDeps['official'] } = {}): KeyDeps {
  return { retriever: gyankoshRetriever(), trio: trioReader(), generate: generateWith, cache: opts.cache, official: opts.official };
}
