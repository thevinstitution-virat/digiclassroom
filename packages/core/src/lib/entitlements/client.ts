/**
 * Capability client -- DCP as the second consumer of the hub's entitlement service
 * (Vidyaverse Pro/backend/src/modules/entitlements/capabilities/), mirroring
 * PDLMS_Pro/lib/entitlements/client.ts. PDLMS was the first consumer; DCP was
 * "deliberately not backfilled" until this integration -- see this project's
 * entitlement-service memory.
 *
 * The hub's own catalogue (Vidyaverse Pro/backend/.../capabilities/catalogue.ts)
 * already declares 'sanchika.notes' as a `digiclassroom` FREE-tier capability --
 * available to everyone by product design. This client replaces the local,
 * institution-admin-toggled gate in institution/features.ts, which had drifted to
 * requiring `professional`/`enterprise` for the same feature. The hub is now the
 * single source of truth; this client asks and caches, it does not decide.
 *
 * Same fail-closed contract as PDLMS: fresh (<5min) serve cached, stale (<30min)
 * serve cached + warn, beyond -> free tier (never a guess, never a throw).
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db';
import { account as accountTable } from '@/db/schema';

export type Tier = 'free' | 'basic' | 'premium' | 'enterprise';
export type CapabilityStatus = 'active' | 'grace' | 'none';

export interface ResolvedCapabilities {
  userId: string;
  app: 'digiclassroom';
  tier: Tier;
  features: string[];
  status: CapabilityStatus;
  expiresAt: string | null;
  graceUntil: string | null;
  resolvedAt: string;
}

const FRESH_MS = 5 * 60 * 1000;
const STALE_CEILING_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;

interface CacheEntry {
  fetchedAt: number;
  value: ResolvedCapabilities;
}

/** Process-local cache -- see PDLMS's client.ts for why not Redis. */
const cache = new Map<string, CacheEntry>();

function issuer(): string | null {
  return process.env.VIDYAVERSE_ISSUER || null;
}

/** Matches the catalogue's `digiclassroom.free` tier exactly (catalogue.ts:29). */
export function freeTierFallback(userId: string): ResolvedCapabilities {
  return {
    userId,
    app: 'digiclassroom',
    tier: 'free',
    features: ['courses.browse', 'shabdkosh.lookup', 'sanchika.notes'],
    status: 'none',
    expiresAt: null,
    graceUntil: null,
    resolvedAt: new Date().toISOString(),
  };
}

async function accessTokenFor(userId: string): Promise<string | null> {
  const row = await db.query.account.findFirst({
    where: and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'vidyaverse')),
    orderBy: [desc(accountTable.updatedAt)],
    columns: { accessToken: true },
  });
  return row?.accessToken ?? null;
}

async function fetchFromHub(userId: string): Promise<ResolvedCapabilities | null> {
  const base = issuer();
  if (!base) return null;

  const token = await accessTokenFor(userId);
  // A purely local (non-federated) account has no token -- the free tier is the
  // correct answer, not an error.
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base.replace(/\/$/, '')}/api/v1/entitlements/capabilities?app=digiclassroom`,
      { headers: { authorization: `Bearer ${token}` }, signal: controller.signal, cache: 'no-store' },
    );

    if (!res.ok) {
      console.warn(`[entitlements] hub returned ${res.status} for ${userId}`);
      return null;
    }

    const body = (await res.json()) as { success: boolean; data: ResolvedCapabilities };
    return body.success ? body.data : null;
  } catch (err) {
    console.warn(`[entitlements] hub unreachable for ${userId}: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getCapabilities(userId: string): Promise<ResolvedCapabilities> {
  const entry = cache.get(userId);
  const age = entry ? Date.now() - entry.fetchedAt : Infinity;

  if (entry && age < FRESH_MS) return entry.value;

  const fresh = await fetchFromHub(userId);
  if (fresh) {
    cache.set(userId, { fetchedAt: Date.now(), value: fresh });
    return fresh;
  }

  if (entry && age < STALE_CEILING_MS) {
    console.warn(`[entitlements] serving stale capabilities for ${userId} (age ${Math.round(age / 1000)}s)`);
    return entry.value;
  }

  return freeTierFallback(userId);
}

export async function hasCapability(userId: string, capability: string): Promise<boolean> {
  const caps = await getCapabilities(userId);
  return caps.features.includes(capability);
}

export function invalidateCapabilities(userIds: string[]): number {
  let dropped = 0;
  for (const id of userIds) {
    if (cache.delete(id)) dropped++;
  }
  return dropped;
}
