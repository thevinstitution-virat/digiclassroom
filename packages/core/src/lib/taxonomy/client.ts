/**
 * HTTP client for the shared cross-repo Taxonomy Service, hosted inside Vidyaverse
 * Pro (see `taxonomy` schema in Vidyaverse's Postgres, module
 * `backend/src/modules/taxonomy` there). Mirrors PDLMS's
 * `backend/src/admin/services/taxonomy-client.service.ts` -- same contract, same
 * fail-soft/fail-throw split -- just as plain functions rather than a NestJS
 * injectable, since this codebase has no DI container.
 *
 * Read failures (tree fetch, book links lookup) fail soft -- an empty result, not a
 * thrown error, so a hub hiccup degrades a tagging picker rather than crashing it.
 * Write failures (setBookLinks) throw -- an admin saving a tag needs to know it did
 * not save, not be told it succeeded when it did not.
 */

export interface TaxonomyNodeDTO {
  id: string;
  domain: string;
  nodeType: string;
  name: string;
  slug: string;
  parentId: string | null;
  ancestorIds: string[];
  sortOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  children?: TaxonomyNodeDTO[];
}

export interface BookTaxonomyLinkDTO {
  nodeId: string;
  isPrimary: boolean;
  node: Pick<TaxonomyNodeDTO, 'id' | 'name' | 'slug' | 'nodeType' | 'domain' | 'ancestorIds'>;
}

const APP_KEY = 'digiclassroom';

function baseUrl(): string | null {
  const issuer = process.env.VIDYAVERSE_ISSUER || process.env.TAXONOMY_SERVICE_URL;
  return issuer ? `${issuer.replace(/\/$/, '')}/api/v1/taxonomy` : null;
}

function apiKey(): string | null {
  return process.env.TAXONOMY_SERVICE_API_KEY || null;
}

export function isTaxonomyConfigured(): boolean {
  return Boolean(baseUrl() && apiKey());
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = baseUrl();
  const key = apiKey();
  if (!url || !key) {
    throw new Error('Taxonomy service is not configured (VIDYAVERSE_ISSUER/TAXONOMY_SERVICE_API_KEY unset).');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-taxonomy-api-key': key,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    const body = (await res.json()) as { success: boolean; data?: T; error?: string };
    if (!res.ok || !body.success) {
      throw new Error(body.error ?? `Taxonomy service returned ${res.status}`);
    }
    return body.data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Full nested tree for a domain -- used to render the tagging picker. Fails soft. */
export async function getTaxonomyTree(domain: string): Promise<TaxonomyNodeDTO[]> {
  if (!isTaxonomyConfigured()) return [];
  try {
    return await request<TaxonomyNodeDTO[]>(`/tree?domain=${encodeURIComponent(domain)}`);
  } catch (err) {
    console.warn(`[taxonomy] getTaxonomyTree(${domain}) failed, returning empty:`, (err as Error).message);
    return [];
  }
}

/** Current tags for a book. Fails soft -- an unreachable hub means "show nothing tagged", not a crash. */
export async function getBookTaxonomyLinks(bookId: string): Promise<BookTaxonomyLinkDTO[]> {
  if (!isTaxonomyConfigured()) return [];
  try {
    return await request<BookTaxonomyLinkDTO[]>(`/books/${APP_KEY}/${encodeURIComponent(bookId)}/links`);
  } catch (err) {
    console.warn(`[taxonomy] getBookTaxonomyLinks(${bookId}) failed, returning empty:`, (err as Error).message);
    return [];
  }
}

/** Replace a book's full tag set. Throws on failure -- the caller must know a save didn't take. */
export async function setBookTaxonomyLinks(
  bookId: string,
  links: Array<{ nodeId: string; isPrimary?: boolean }>,
): Promise<BookTaxonomyLinkDTO[]> {
  return request<BookTaxonomyLinkDTO[]>(`/books/${APP_KEY}/${encodeURIComponent(bookId)}/links`, {
    method: 'PUT',
    body: JSON.stringify({ links }),
  });
}
