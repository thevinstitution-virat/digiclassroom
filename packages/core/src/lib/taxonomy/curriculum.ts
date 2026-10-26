/**
 * HTTP client for curriculum v2: Book Buddy's education taxonomy (7,884 nodes, ids
 * uuid5(code), the same in every app), served by Vidyaverse at /api/v1/curriculum/*
 * from the shared `trio` database (module `backend/src/modules/curriculum` there).
 *
 * The response bodies are Book Buddy's CurriculumController's, unchanged: bare JSON, no
 * `{ success, data }` envelope, errors as `{ statusCode, message, error }`.
 *
 * Off unless TAXONOMY_V2_ENABLED=true. Uses the same Vidyaverse URL and service key as
 * the old tree client beside it (./client.ts), which keeps serving the old 230-node tree
 * until every caller has moved.
 *
 * Every call here is for an admin screen, so failures throw a CurriculumServiceError
 * (the screen shows it) rather than failing soft. The taxonomy only changes with a new
 * release, so successful reads are cached in memory for a few minutes.
 */

export interface CurriculumNode {
  id: string;
  code: string;
  name: string;
  nameHi: string | null;
  nodeType: string;
  depth: number;
  hasChildren: boolean;
  /** sourced = from the regulator's scheme; verify = structure right, details to check; template = a default pattern. */
  verification: string;
  completeness: string;
  canonicalSubject: string | null;
  path: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  localName: string | null;
}

export interface CurriculumNodeWithAncestors {
  node: CurriculumNode;
  /** From the domain down to the node's parent. */
  ancestors: CurriculumNode[];
}

export interface CurriculumCombination {
  code: string;
  name: string;
}

export interface CurriculumSearchOptions {
  /** A domain code such as `SCH` or `ENT`: only nodes inside it. */
  domain?: string;
  /** Node types such as `CLASS`, `EXAM`, `SUBJECT`. Default: everything but the domains. */
  types?: string[];
  /** 1-30, default 20. */
  limit?: number;
}

export class CurriculumServiceError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = 'CurriculumServiceError';
  }
}

const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function baseUrl(): string | null {
  const issuer = process.env.VIDYAVERSE_ISSUER || process.env.TAXONOMY_SERVICE_URL;
  return issuer ? `${issuer.replace(/\/$/, '')}/api/v1/curriculum` : null;
}

function apiKey(): string | null {
  return process.env.TAXONOMY_SERVICE_API_KEY || null;
}

/** True when this deployment should use curriculum v2: the flag is on and Vidyaverse is configured. */
export function isCurriculumV2Enabled(): boolean {
  return process.env.TAXONOMY_V2_ENABLED === 'true' && Boolean(baseUrl() && apiKey());
}

async function get<T>(path: string): Promise<T> {
  const url = baseUrl();
  const key = apiKey();
  if (!url || !key) {
    throw new CurriculumServiceError('Curriculum service is not configured (VIDYAVERSE_ISSUER/TAXONOMY_SERVICE_API_KEY unset).', null);
  }
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      headers: { 'x-taxonomy-api-key': key },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (err) {
    const reason = (err as Error).name === 'AbortError' ? `no answer in ${TIMEOUT_MS / 1000} s` : (err as Error).message;
    throw new CurriculumServiceError(`Curriculum service unreachable: ${reason}`, null);
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = body && typeof body === 'object'
      ? String((body as { message?: unknown; error?: unknown }).message ?? (body as { error?: unknown }).error ?? '')
      : '';
    throw new CurriculumServiceError(message || `Curriculum service returned ${res.status}`, res.status);
  }
  cache.set(path, { at: Date.now(), value: body });
  return body as T;
}

/** The seven top-level domains (School Education, Higher Education, Entrance Exams...). */
export function getCurriculumDomains(): Promise<CurriculumNode[]> {
  return get('/domains');
}

/** The active children of a node, in order. A null parent gives the domains. */
export function getCurriculumChildren(parentId: string | null): Promise<CurriculumNode[]> {
  return get(parentId ? `/nodes?parentId=${encodeURIComponent(parentId)}` : '/nodes');
}

/** One node and its breadcrumb. */
export function getCurriculumNode(id: string): Promise<CurriculumNodeWithAncestors> {
  return get(`/nodes/${encodeURIComponent(id)}`);
}

/** The streams (PCM, PCB, Commerce...) defined for a Class 11 or 12 node; empty for anything else. */
export function getCurriculumCombinations(classNodeId: string): Promise<CurriculumCombination[]> {
  return get(`/nodes/${encodeURIComponent(classNodeId)}/combinations`);
}

/** Name search in English or Hindi. Fewer than two characters returns nothing. */
export async function searchCurriculum(query: string, opts: CurriculumSearchOptions = {}): Promise<CurriculumNode[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q });
  if (opts.domain) params.set('domain', opts.domain);
  if (opts.types?.length) params.set('types', opts.types.join(','));
  if (opts.limit) params.set('limit', String(opts.limit));
  return get(`/search?${params.toString()}`);
}

/** For tests. */
export function _clearCurriculumCache(): void {
  cache.clear();
}
