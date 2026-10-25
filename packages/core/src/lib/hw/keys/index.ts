// Answer keys: public entry points. See service.ts for the resolution order.

import { generateWith } from '../ai';
import { getHwConfig } from '../config';
import type { KeyCache } from './cache';
import { gyankoshRetriever, type Retriever } from './retriever';
import type { KeyDeps } from './service';
import { trioReader, type TrioReader } from './trio';

export { buildKey, keyConfigHash, keySettingsFromEnv, KEY_RETRIEVAL_VERSION, type KeyDeps, type KeySettings, type OfficialScheme } from './service';
export { fileKeyCache, memoryKeyCache, type KeyCache } from './cache';
export type * from './types';

/** Real dependencies: Gyankosh Qdrant (read), trio content tables (read-only transaction), AI providers. */
export function defaultKeyDeps(opts: { cache?: KeyCache; official?: KeyDeps['official'] } = {}): KeyDeps {
  // Gyankosh and the trio database are connected on first use, so official and given-passage
  // keys work without them configured.
  let retriever: Retriever | null = null;
  let trio: TrioReader | null = null;
  const r = () => (retriever ??= gyankoshRetriever());
  const t = () => (trio ??= trioReader());
  return {
    retriever: {
      // Same value gyankoshRetriever() reports, from settings alone (it goes into the config hash).
      get indexId() { const c = getHwConfig(); return `${c.QDRANT_COLLECTION_NAME ?? 'unset'}|${c.HW_KEY_EMBED_MODEL}`; },
      embed: (text) => r().embed(text),
      search: (v, f, l) => r().search(v, f, l),
    },
    trio: { practiceRows: (ids) => t().practiceRows(ids), chunks: (ids) => t().chunks(ids) },
    generate: generateWith, cache: opts.cache, official: opts.official,
  };
}
