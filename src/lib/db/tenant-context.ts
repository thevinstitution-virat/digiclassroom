// src/lib/db/tenant-context.ts
//
// Resolves the B2B2C TenantContext from the verified session + active-org header.
// Kept separate from tenant-scope.ts (the pure filter builders) so that the
// filter logic stays unit-testable without pulling in auth/db/headers.

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { member } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { isPlatformStaff, type Role, type OrgRole } from '@/auth/permissions';
import type { TenantContext } from './tenant-scope';

/** Better Auth member roles → canonical OrgRole (matches get-org-context). */
function normalizeOrgRole(raw: string | null | undefined): OrgRole {
  if (raw === 'admin') return 'org_admin';
  if (raw === 'member') return 'student';
  return (raw ?? 'student') as OrgRole;
}

/**
 * Resolve the B2B2C tenant context. Unlike getOrgContext(), a logged-in user
 * with no org is NOT an error — it is a valid individual/B2C caller (orgId = null).
 * Returns null only when unauthenticated.
 *
 * The org id comes from the `x-org-id` header (a client cookie, NOT trustworthy on
 * its own) and is only honoured after an authoritative (userId, orgId) membership
 * check — closing the swapped-cookie cross-tenant gap.
 */
export async function getTenantContextOrNull(): Promise<TenantContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user;
  const globalRole = (user.role ?? 'student') as Role;
  const headerOrg = (await headers()).get('x-org-id') ?? '';

  // Platform staff → cross-org bypass (keep the active org if one is selected).
  if (isPlatformStaff(globalRole)) {
    return { userId: user.id, orgId: headerOrg || null, isPlatformBypass: true, globalRole, orgRole: 'owner' };
  }

  // Regular user → org-scoped only with a VERIFIED membership for the header org.
  if (headerOrg) {
    const membershipRow = await db.query.member.findFirst({
      where: and(eq(member.userId, user.id), eq(member.organizationId, headerOrg)),
    });
    if (membershipRow) {
      return {
        userId: user.id, orgId: headerOrg, isPlatformBypass: false, globalRole,
        orgRole: normalizeOrgRole(membershipRow.role),
      };
    }
  }

  // No org / not a member of the claimed org → valid individual (B2C) caller.
  return { userId: user.id, orgId: null, isPlatformBypass: false, globalRole };
}

/** Throwing variant for routes that always need a caller. */
export async function getTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContextOrNull();
  if (!ctx) throw new Error('Unauthorized: no active session');
  return ctx;
}
