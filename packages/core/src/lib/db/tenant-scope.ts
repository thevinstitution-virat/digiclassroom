// src/lib/db/tenant-scope.ts
//
// Enforced, B2B2C-aware tenant isolation primitive. Every data-access route
// should derive its filters from here instead of querying tables raw.
//
// ── Isolation contract ──────────────────────────────────────────────────────
// Every tenant-ownable row is exactly one of:
//   • org-owned   — organization_id = <orgId>   (visible only inside that org)
//   • global      — organization_id IS NULL      (platform/NCERT base; readable by everyone)
//   • personal    — user_id = <userId>           (an individual's own rows; org-tagged or B2C/null)
//
// Callers (TenantContext) are one of:
//   • platform staff (super_admin) — cross-org bypass; sees everything
//   • org member                   — orgId set; scoped to that org (+ global where applicable)
//   • individual / B2C (D2C)       — orgId null; sees only global + their own personal rows
//
// The filters below encode that contract once, so isolation no longer depends on
// every route remembering to add the right WHERE clause.

import { and, or, eq, isNull, type SQL } from 'drizzle-orm';
import type { Role, OrgRole } from '@/auth/permissions';
import { isRbacEnforced } from '@/lib/config/feature-flags';

export interface TenantContext {
  userId: string;
  /** Active org id, or null for individual (B2C/D2C) users with no organization. */
  orgId: string | null;
  /** super_admin (and Phase-1 admin) — sees across orgs. */
  isPlatformBypass: boolean;
  globalRole: Role;
  /** Normalized org role for org members; undefined for individual/B2C callers. */
  orgRole?: OrgRole;
}

// NOTE: context resolution (session/db/headers) lives in ./tenant-context so this
// module stays pure (drizzle + flags only) and unit-testable. Routes import the
// resolver from '@/lib/db/tenant-context' and the filters/guard from here.

type OrgTable = { organizationId: any };
type UserTable = { userId: any; organizationId?: any };

/**
 * Filter builders that encode the isolation contract. Compose with `.where(...)`:
 *
 *   const t = tenantScope(ctx);
 *   // shared content (NCERT base + this org's private content):
 *   db.select().from(materials).where(t.orgOrGlobal(materials));
 *   // strictly org-private content:
 *   db.select().from(institutionClasses).where(t.orgOnly(institutionClasses));
 *   // a user's own rows:
 *   db.select().from(userNotes).where(t.personal(userNotes));
 *
 * A returned `undefined` means "no restriction" (platform bypass) — pass it
 * straight to `.where()` (Drizzle treats undefined as no-op) or `and()` it.
 */
export function tenantScope(ctx: TenantContext) {
  return {
    ctx,

    /** Org-OWNED rows only. Platform bypass → all orgs. B2C → global (null org). */
    orgOnly(table: OrgTable): SQL | undefined {
      if (ctx.isPlatformBypass) return undefined;
      return ctx.orgId ? eq(table.organizationId, ctx.orgId) : isNull(table.organizationId);
    },

    /** This org's rows OR global/platform rows (null org). For shared content (e.g. NCERT). */
    orgOrGlobal(table: OrgTable): SQL | undefined {
      if (ctx.isPlatformBypass) return undefined;
      return ctx.orgId
        ? or(eq(table.organizationId, ctx.orgId), isNull(table.organizationId))
        : isNull(table.organizationId);
    },

    /** Personal (user-owned) rows. Always scoped to this user + the org/global match. */
    personal(table: UserTable, extra?: SQL): SQL | undefined {
      const conds: SQL[] = [eq(table.userId, ctx.userId)];
      if (table.organizationId) {
        conds.push(
          (ctx.orgId ? eq(table.organizationId, ctx.orgId) : isNull(table.organizationId)) as SQL,
        );
      }
      if (extra) conds.push(extra);
      return conds.length === 1 ? conds[0] : and(...conds);
    },

    /** The organization_id to stamp on INSERT for new rows (null for B2C/global). */
    orgIdForInsert(): string | null {
      return ctx.orgId ?? null;
    },
  };
}

export type TenantScope = ReturnType<typeof tenantScope>;

/**
 * Raw-SQL variant for routes built on `executeQuery()` (the majority of the
 * codebase). Each builder returns `{ clause, params }` to splice into a WHERE.
 * `clause: '1=1'` means "no restriction" (platform bypass) so it composes safely.
 * Concatenate params in clause order.
 *
 *   const t = tenantSql(ctx, 'm');                 // 'm' = table alias
 *   const org = t.orgOrGlobal();
 *   const rows = await executeQuery(
 *     `SELECT * FROM materials m WHERE ${org.clause} AND m.is_active = TRUE`,
 *     [...org.params],
 *   );
 */
export function tenantSql(ctx: TenantContext, alias = '') {
  const orgCol = alias ? `${alias}.organization_id` : 'organization_id';
  const userCol = alias ? `${alias}.user_id` : 'user_id';

  return {
    /** Org-OWNED rows only. Platform bypass → unrestricted. B2C → global (null org). */
    orgOnly(): { clause: string; params: unknown[] } {
      if (ctx.isPlatformBypass) return { clause: '1=1', params: [] };
      return ctx.orgId
        ? { clause: `${orgCol} = ?`, params: [ctx.orgId] }
        : { clause: `${orgCol} IS NULL`, params: [] };
    },
    /** This org's rows OR global/platform rows (null org). */
    orgOrGlobal(): { clause: string; params: unknown[] } {
      if (ctx.isPlatformBypass) return { clause: '1=1', params: [] };
      return ctx.orgId
        ? { clause: `(${orgCol} = ? OR ${orgCol} IS NULL)`, params: [ctx.orgId] }
        : { clause: `${orgCol} IS NULL`, params: [] };
    },
    /** Personal rows: this user, plus an optional caller-supplied extra clause. */
    personal(extraClause?: string, extraParams: unknown[] = []): { clause: string; params: unknown[] } {
      const parts = [`${userCol} = ?`];
      const params: unknown[] = [ctx.userId];
      if (extraClause) {
        parts.push(extraClause);
        params.push(...extraParams);
      }
      return { clause: parts.join(' AND '), params };
    },
  };
}

/**
 * Guard for institution-only routes (data that must never be served without an org).
 * When MT_RBAC_ENFORCEMENT is ON, a B2C/no-org caller is rejected; while it is OFF
 * (transition) the call is allowed but the tenantScope filters still restrict the
 * caller to global/null rows — so it degrades safely, never leaks another org.
 */
export function requireOrgScope(
  ctx: TenantContext,
): { ok: true } | { ok: false; status: number; error: string } {
  if (ctx.isPlatformBypass || ctx.orgId) return { ok: true };
  if (isRbacEnforced()) {
    return { ok: false, status: 403, error: 'An active organization is required for this resource.' };
  }
  return { ok: true };
}
