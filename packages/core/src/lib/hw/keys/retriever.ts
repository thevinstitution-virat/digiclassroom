// Passage retrieval for answer keys: read-only dense search over Gyankosh's Qdrant collection.
//
// Deliberately NOT the tutor's QdrantRAGSearch / EnhancedRAGPipeline:
// - QdrantRAGSearch.search() retries with the subject filter removed, then with every
//   educational filter removed (medium included), and falls back to keyword search when
//   embedding fails. A Hindi question could silently get English passages.
// - Its hybrid search returns RRF fusion scores, which are ranks, not relevance: a fixed
//   threshold (R_min) means nothing on them. It also adds score boosts.
// - EnhancedRAGPipeline.search() drops the medium, board and organisation filters.
// Here: one strict filter, dense cosine scores as returned, and any failure is an error.
// Only `query` (a read) is ever called on the collection.

import { QdrantClient } from '@qdrant/js-client-rest';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import type { KeyCallUsage } from './types';

export interface VectorHit {
  id: string;
  /** Cosine similarity from the dense vector, unmodified. */
  score: number;
  contentItemId: string;
  chapter: string | null;
}

export interface Retriever {
  /** Embeds the query once; returns the vector and the provider's usage. */
  embed(text: string): Promise<{ vector: number[]; call: KeyCallUsage }>;
  search(vector: number[], filter: object, limit: number): Promise<VectorHit[]>;
  /** Identifies the index for the config hash (collection and embedding model). */
  readonly indexId: string;
}

const EMBED_URL = 'https://api.openai.com/v1/embeddings';

export function gyankoshRetriever(): Retriever {
  const cfg = getHwConfig();
  if (!cfg.QDRANT_URL || !cfg.QDRANT_COLLECTION_NAME) {
    throw new HwError('NOT_CONFIGURED', 'Textbook search is not configured.', 'QDRANT_URL and QDRANT_COLLECTION_NAME must be set');
  }
  if (!cfg.OPENAI_API_KEY) {
    throw new HwError('NOT_CONFIGURED', 'Textbook search is not configured.', 'OPENAI_API_KEY is not set (query embeddings)');
  }
  const collection = cfg.QDRANT_COLLECTION_NAME;
  const model = cfg.HW_KEY_EMBED_MODEL;
  const apiKey = cfg.OPENAI_API_KEY;
  const client = new QdrantClient({ url: cfg.QDRANT_URL, apiKey: cfg.QDRANT_API_KEY, checkCompatibility: false });

  return {
    indexId: `${collection}|${model}`,

    async embed(text) {
      const res = await fetch(EMBED_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: text }),
      });
      const body = (await res.json().catch(() => null)) as { data?: { embedding: number[] }[]; usage?: { prompt_tokens?: number }; error?: { message?: string } } | null;
      if (!res.ok || !body?.data?.[0]?.embedding) {
        throw new HwError('PROVIDER_ERROR', 'Textbook search failed.', `embeddings: HTTP ${res.status} ${body?.error?.message ?? ''}`.trim());
      }
      return {
        vector: body.data[0].embedding,
        call: { role: 'embed', provider: 'openai', model, usage: { input: body.usage?.prompt_tokens ?? 0, cached: 0, output: 0 } },
      };
    },

    async search(vector, filter, limit) {
      const r = await client.query(collection, {
        query: vector,
        using: 'dense',
        filter: filter as never,
        limit,
        with_payload: ['content_item_id', 'chapter'],
        with_vector: false,
      });
      return r.points.map((p) => {
        const pl = (p.payload ?? {}) as { content_item_id?: string; chapter?: string };
        return { id: String(p.id), score: p.score, contentItemId: String(pl.content_item_id ?? ''), chapter: pl.chapter ?? null };
      });
    },
  };
}
