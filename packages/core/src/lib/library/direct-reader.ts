/**
 * Read-only fallback for when the hub cannot answer (unreachable, timing out, 5xx): query the library collection
 * `library_v2_te3l_3072` directly with payload contract v2 and a read-only key. Only `query` is ever called.
 *
 * It is a degraded path and says so: the response carries `degraded: true` and a warning. It cannot resolve
 * placements (those live in PDLMS's database), so it applies the scope the hub gave on the last successful search
 * for the same goals (`rememberScope`); when there is none it answers from every published public book in the
 * medium and the warning says that. Dense cosine only (no bm25, no rerank), window expansion by `chunk_order` is
 * not attempted.
 */
import { LIBRARY_V2_COLLECTION, DENSE_VECTOR, EMBED_MODEL, type LibraryPayloadV2 } from './contract/src';
import { LibraryNotConfigured, type HubResult, type HubSearchRequest, type HubSearchResponse } from './hub-client';

export interface DirectPoint {
  score: number;
  payload: Partial<LibraryPayloadV2> | null;
}

export interface DirectDeps {
  embed(text: string): Promise<number[]>;
  query(args: { vector: number[]; filter: Record<string, unknown>; limit: number }): Promise<DirectPoint[]>;
}

// ── Scope remembered from the hub's last good answer ───────────────────────────────────────────

interface RememberedScope {
  at: number;
  works: { work_id: string; chapters: number[] | null }[];
}

const REMEMBER_MS = 24 * 60 * 60 * 1000;
const remembered = new Map<string, RememberedScope>();

export const scopeKey = (r: Pick<HubSearchRequest, 'nodeIds' | 'nodeCodes' | 'workIds' | 'medium'>): string =>
  JSON.stringify([[...(r.nodeIds ?? [])].sort(), [...(r.nodeCodes ?? [])].sort(), [...(r.workIds ?? [])].sort(), r.medium ?? '']);

export function rememberScope(req: HubSearchRequest, response: Pick<HubSearchResponse, 'scope'>): void {
  if (!response.scope.length) return;
  remembered.set(scopeKey(req), { at: Date.now(), works: response.scope.map((w) => ({ work_id: w.work_id, chapters: w.chapters })) });
}

export function forgetRememberedScopes(): void {
  remembered.clear();
}

// ── Reader ──────────────────────────────────────────────────────────────────────────────────────

export function filterFor(req: HubSearchRequest, scope: RememberedScope['works'] | null): Record<string, unknown> {
  const must: Record<string, unknown>[] = [
    { key: 'status', match: { value: 'live' } },
    { key: 'visibility', match: { value: 'public' } },
  ];
  if (!req.includePractice) must.push({ key: 'retrieval_class', match: { value: 'reference' } });
  if (req.medium) must.push({ key: 'medium', match: { value: req.medium } });
  const filter: Record<string, unknown> = { must };
  if (scope?.length) {
    filter.should = scope.map((w) => ({
      must: [
        { key: 'work_id', match: { value: w.work_id } },
        ...(w.chapters?.length ? [{ key: 'chapter_no', match: { any: w.chapters } }] : []),
      ],
    }));
  }
  return filter;
}

const toResult = (p: DirectPoint): HubResult | null => {
  const pl = p.payload;
  if (!pl?.passage_id || !pl.work_id || typeof pl.text !== 'string') return null;
  return {
    passage_id: pl.passage_id,
    work_id: pl.work_id,
    work_title: '',
    chapter_no: pl.chapter_no ?? 0,
    kind: pl.kind ?? 'prose',
    block_type: pl.block_type ?? null,
    label: pl.label ?? null,
    section_no: pl.section_no ?? null,
    section_title: null,
    page_start: pl.page_start ?? 0,
    page_end: pl.page_end ?? pl.page_start ?? 0,
    pdf_page: pl.pdf_page ?? null,
    text: pl.text,
    retrieval_class: pl.retrieval_class ?? 'reference',
    score: { fused: p.score, dense: p.score },
    context: { before: [], after: [] },
  };
};

export async function directSearch(req: HubSearchRequest, deps: DirectDeps, now: () => number = Date.now): Promise<HubSearchResponse> {
  const mem = remembered.get(scopeKey(req));
  const scope = mem && now() - mem.at < REMEMBER_MS ? mem.works : null;
  const limit = Math.min(Math.max(req.limit ?? 8, 1), 50);
  const vector = await deps.embed(req.query);
  const points = await deps.query({ vector, filter: filterFor(req, scope), limit: req.minDense != null ? limit * 3 : limit });
  const results = points
    .map(toResult)
    .filter((r): r is HubResult => r !== null)
    .filter((r) => req.minDense == null || (r.score.dense ?? 0) >= req.minDense)
    .slice(0, limit);
  const warnings = [
    'The library hub could not be reached: this answer is a direct read of the library collection (dense search only, no rerank, no neighbouring passages).',
    scope
      ? 'The scope is the one the hub gave for the same goals earlier.'
      : 'No earlier scope is known for these goals, so every published public book in this medium was searched.',
  ];
  return {
    scope: scope ? scope.map((w) => ({ work_id: w.work_id, title: '', medium: req.medium ?? '', chapters: w.chapters, via: ['remembered'] })) : [],
    results,
    warnings,
    degraded: true,
  };
}

/** Real dependencies: OpenAI for the query embedding, Qdrant `query` with a read-only key. */
export async function directDepsFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<DirectDeps> {
  const url = env.LIBRARY_QDRANT_URL?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (!url) throw new LibraryNotConfigured('LIBRARY_QDRANT_URL is not set (direct fallback)');
  if (!openaiKey) throw new LibraryNotConfigured('OPENAI_API_KEY is not set (direct fallback embeds the query)');
  const collection = env.LIBRARY_QDRANT_COLLECTION?.trim() || LIBRARY_V2_COLLECTION;
  const { QdrantClient } = await import('@qdrant/js-client-rest');
  const client = new QdrantClient({ url, apiKey: env.LIBRARY_QDRANT_API_KEY, checkCompatibility: false });
  return {
    async embed(text) {
      const res = await fetchImpl('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      });
      const body = (await res.json().catch(() => null)) as { data?: { embedding: number[] }[] } | null;
      const v = body?.data?.[0]?.embedding;
      if (!res.ok || !v) throw new Error(`query embedding failed: HTTP ${res.status}`);
      return v;
    },
    async query({ vector, filter, limit }) {
      const r = await client.query(collection, { query: vector, using: DENSE_VECTOR, filter: filter as never, limit, with_payload: true, with_vector: false });
      return r.points.map((p) => ({ score: p.score, payload: (p.payload ?? null) as DirectPoint['payload'] }));
    },
  };
}
