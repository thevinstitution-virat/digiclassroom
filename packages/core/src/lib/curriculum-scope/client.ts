/**
 * The calling student's institute curriculum scope, pulled from Vidyaverse — what
 * narrows AI Tutor retrieval to a student's actual curriculum by default (see
 * lib/services/vector_store_service.ts's taxonomyScopeNodeIds).
 *
 * Mirrors PDLMS's backend/src/rag/curriculum-scope-client.service.ts -- same
 * fail-open contract, same process-local cache, just plain functions since this
 * codebase has no DI container. FAIL OPEN, deliberately: this only narrows
 * retrieval, so a Vidyaverse hiccup must degrade to "no filter", not break AI Tutor
 * for every institutional student. Not federated, no token, hub unreachable,
 * malformed response -- every failure mode returns an empty scope.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { account } from '@/db/schema';

interface CacheEntry {
  fetchedAt: number;
  scopeNodeIds: string[];
}

const FRESH_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;
const cache = new Map<string, CacheEntry>();

function issuer(): string | null {
  return process.env.VIDYAVERSE_ISSUER || process.env.TAXONOMY_SERVICE_URL?.replace(/\/api\/v1\/taxonomy$/, '') || null;
}

async function accessTokenFor(userId: string): Promise<string | null> {
  const row = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, 'vidyaverse')),
    columns: { accessToken: true },
  });
  return row?.accessToken ?? null;
}

export async function getCurriculumScopeForUser(userId: string): Promise<string[]> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
    return cached.scopeNodeIds;
  }

  const base = issuer();
  if (!base) return cached?.scopeNodeIds ?? [];

  try {
    const token = await accessTokenFor(userId);
    // A purely local (non-federated) account has no token and no institution --
    // no scope is exactly correct, not an error.
    if (!token) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/api/v1/academic/my-curriculum-scope`, {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) {
        console.warn(`[curriculum-scope] hub returned ${res.status} for ${userId}, failing open (no filter)`);
        return cached?.scopeNodeIds ?? [];
      }
      const body = (await res.json()) as { success: boolean; data?: { scopeNodeIds: string[] } };
      const scopeNodeIds = body.success ? (body.data?.scopeNodeIds ?? []) : [];
      cache.set(userId, { fetchedAt: Date.now(), scopeNodeIds });
      return scopeNodeIds;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(`[curriculum-scope] hub unreachable for ${userId}, failing open (no filter):`, (err as Error).message);
    return cached?.scopeNodeIds ?? [];
  }
}

export function invalidateCurriculumScope(userId: string): void {
  cache.delete(userId);
}
