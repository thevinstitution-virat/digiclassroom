// Which classes an institution has switched the feature on for (roadmap 5.1, migration 025). An institution is either unrestricted (the
// feature applies to all its classes, as before) or restricted to a list of classes and sections, so a pilot can run in one class while
// the rest of the school does not see it. The list is hw_tenant_scope; the flag is hw_tenant_quota.scope_restricted. Pure rule plus a loader.

import { eq } from 'drizzle-orm';
import { hwTenantQuota, hwTenantScope } from '@/db/hw-schema';
import { HwError } from './errors';
import type { Exec } from './db';

export interface ScopeEntry { classId: string; sectionId: string | null }
export interface TenantScope { restricted: boolean; entries: ScopeEntry[] }

/**
 * May the feature be used for this class and section? A restricted institution allows exactly what is listed: a class entry (no section)
 * covers every section of it; a section entry covers that section only. An assignment for ALL sections of a class (section null) needs the
 * whole class listed, because students of an unlisted section would otherwise see it.
 */
export function scopeAllows(scope: TenantScope, classId: string, sectionId: string | null): boolean {
  if (!scope.restricted) return true;
  return scope.entries.some((e) => e.classId === classId && (e.sectionId === null || (sectionId !== null && e.sectionId === sectionId)));
}

export async function loadScope(x: Exec, orgId: string): Promise<TenantScope> {
  const [q] = await x.select({ restricted: hwTenantQuota.scopeRestricted }).from(hwTenantQuota).where(eq(hwTenantQuota.organizationId, orgId)).limit(1);
  if (!q?.restricted) return { restricted: false, entries: [] };
  const rows = await x.select({ classId: hwTenantScope.classId, sectionId: hwTenantScope.sectionId }).from(hwTenantScope).where(eq(hwTenantScope.organizationId, orgId));
  return { restricted: true, entries: rows };
}

/** Drops duplicates and sections already covered by their whole class, so the stored list is minimal and stable. */
export function normaliseScope(entries: readonly ScopeEntry[]): ScopeEntry[] {
  const wholeClass = new Set(entries.filter((e) => e.sectionId === null).map((e) => e.classId));
  const seen = new Set<string>();
  const out: ScopeEntry[] = [];
  for (const e of entries) {
    if (e.sectionId !== null && wholeClass.has(e.classId)) continue;
    const k = `${e.classId}|${e.sectionId ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ classId: e.classId, sectionId: e.sectionId });
  }
  return out.sort((x, y) => (x.classId + (x.sectionId ?? '')).localeCompare(y.classId + (y.sectionId ?? '')));
}

export const SCOPE_REFUSAL = 'Handwritten assignments are not switched on for this class yet.';

export async function requireScope(x: Exec, orgId: string, classId: string, sectionId: string | null): Promise<void> {
  if (!scopeAllows(await loadScope(x, orgId), classId, sectionId)) throw new HwError('FEATURE_DISABLED', SCOPE_REFUSAL);
}
