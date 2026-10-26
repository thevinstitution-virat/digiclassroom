/**
 * Client for the PDLMS library hub (`POST /api/hub/search`, docs/library-hub.md in PDLMS), server to server.
 *
 * DigiClassroom no longer ingests books: the hub is the only writer of the library and this is the read path. The
 * caller sends the learner's goals (curriculum v2 node ids or codes) and medium; the hub scopes the search through
 * its placements, so no board, class or subject is guessed here. Results carry the `passage_id` every stored
 * reference uses (hw answer-key citations, Practest `casaAnchor`, tutor sources).
 *
 * Nothing here reads the environment except `hubConfigFromEnv`, and `fetch` is passed in, so the tests run
 * without a network.
 */

export interface HubConfig {
  /** PDLMS origin, no trailing slash (`https://api.pdlms.example`). */
  baseUrl: string;
  /** This app's id in the hub's HUB_CLIENTS (`digiclassroom`). */
  appId: string;
  secret: string;
  timeoutMs: number;
}

export interface HubSearchRequest {
  query: string;
  nodeIds?: string[];
  nodeCodes?: string[];
  workIds?: string[];
  medium?: 'en' | 'hi';
  limit?: number;
  window?: number;
  includePractice?: boolean;
  /** R_min: drop hits whose dense cosine is lower (the caller's own calibrated value). */
  minDense?: number | null;
}

export interface HubPassage {
  passage_id: string;
  chapter_no: number;
  kind: 'prose' | 'block' | 'summary';
  block_type: string | null;
  label: string | null;
  section_no: string | null;
  section_title: string | null;
  page_start: number;
  page_end: number;
  pdf_page: number | null;
  text: string;
}

export interface HubResult extends HubPassage {
  work_id: string;
  work_title: string;
  retrieval_class: 'reference' | 'practice';
  score: { fused: number; dense: number | null };
  context: { before: HubPassage[]; after: HubPassage[] };
}

export interface HubSearchResponse {
  scope: { work_id: string; title: string; medium: string; chapters: number[] | null; via: string[] }[];
  results: HubResult[];
  warnings: string[];
  /**
   * True only when the answer did not come from the hub (see `searchLibrary`): the scope was not applied and the
   * caller must say so, not present it as an ordinary search.
   */
  degraded?: boolean;
}

export type HubFailure =
  /** Could not reach the hub, timed out, or the hub answered 5xx: a mechanism failure the direct reader may cover. */
  | 'unreachable'
  /** 401/403: this app's id or secret is wrong. A deploy-time error; never covered by a fallback. */
  | 'unauthorized'
  /** 404: hub search is off on that deployment (HUB_SEARCH_ENABLED). */
  | 'disabled'
  /** 400: the request was refused (no scope, bad medium). */
  | 'bad_request'
  /** 429: over this app's per-minute budget. */
  | 'rate_limited';

export class HubError extends Error {
  constructor(message: string, readonly failure: HubFailure, readonly status: number | null = null) {
    super(message);
    this.name = 'HubError';
  }
}

export class LibraryNotConfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryNotConfigured';
  }
}

export function hubConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HubConfig {
  const baseUrl = env.LIBRARY_HUB_URL?.trim().replace(/\/+$/, '');
  const secret = env.LIBRARY_HUB_SECRET?.trim();
  if (!baseUrl) throw new LibraryNotConfigured('LIBRARY_HUB_URL is not set');
  if (!secret) throw new LibraryNotConfigured('LIBRARY_HUB_SECRET is not set');
  const timeoutMs = Number(env.LIBRARY_HUB_TIMEOUT_MS ?? 8000);
  return { baseUrl, secret, appId: env.LIBRARY_HUB_APP_ID?.trim() || 'digiclassroom', timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000 };
}

const failureOf = (status: number): HubFailure => {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'disabled';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unreachable';
  return 'bad_request';
};

/** One hub search. Throws `HubError`; never returns a partial answer. */
export async function hubSearch(cfg: HubConfig, req: HubSearchRequest, fetchImpl: typeof fetch = fetch): Promise<HubSearchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(`${cfg.baseUrl}/api/hub/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-app': cfg.appId, 'x-hub-secret': cfg.secret },
      body: JSON.stringify(req),
      signal: controller.signal,
      // The hub answers directly; a redirect would carry the secret somewhere else.
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (err) {
    throw new HubError(`library hub unreachable: ${(err as Error).message}`, 'unreachable');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const detail = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new HubError(`library hub answered ${res.status}${detail ? `: ${detail}` : ''}`, failureOf(res.status), res.status);
  }
  const body = (await res.json().catch(() => null)) as HubSearchResponse | null;
  if (!body || !Array.isArray(body.results) || !Array.isArray(body.scope)) {
    throw new HubError('library hub answered with something that is not a search response', 'unreachable', res.status);
  }
  return { ...body, warnings: body.warnings ?? [] };
}
