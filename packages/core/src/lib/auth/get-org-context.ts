// src/lib/auth/get-org-context.ts
// Phase 1: super_admin gets god-mode bypass; admin ALSO retains bypass (transition safety).
// Phase 2 will narrow the admin bypass on destructive routes.

import { auth, getSafeSession } from '@/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { member } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Role, OrgRole } from '@/auth/permissions';

export interface OrgContext {
  userId: string;
  orgId: string;
  globalRole: Role;
  orgRole: OrgRole;
  /** True when the caller has a platform-level bypass (super_admin or admin in Phase 1). */
  isPlatformBypass: boolean;
}

/**
 * Better Auth's organization plugin names an org administrator `admin`, but our
 * canonical OrgRole taxonomy calls that `org_admin` (the global `admin` role is
 * a separate, platform-staff concept). When super_admin onboards an institution
 * it invites the institution admin with Better Auth's `admin` org role; normalize
 * it here so every downstream check (isInstitutionAdmin, layouts, nav) sees the
 * single canonical value `org_admin`. `member` (Better Auth's default) maps to
 * the base `student` org role.
 */
function normalizeOrgRole(raw: string | null | undefined): OrgRole {
  if (raw === 'admin') return 'org_admin';
  if (raw === 'member') return 'student';
  return (raw ?? 'student') as OrgRole;
}

/**
 * Resolves the current user's org context from the Better Auth session and
 * the active-organization cookie injected by middleware.
 *
 * Bypass logic (Phase 1):
 *   - super_admin → full bypass, orgId = provided orgId || 'system'
 *   - admin       → full bypass (same as pre-Phase-1, unchanged for transition safety)
 *   - others      → must have a valid org membership
 */
export async function getOrgContext(): Promise<OrgContext> {
  const session = await getSafeSession(await headers());

  if (!session?.user) {
    throw new Error('Unauthorized: no active session');
  }

  const user = session.user;
  const globalRole = (user.role ?? 'student') as Role;

  // Read the active org from the header injected by middleware
  const headersList = await headers();
  const orgId = headersList.get('x-org-id') ?? '';

  // ── Platform bypass — super_admin ONLY ──────────────────────────────────────
  // B2B2C: admin is the institution administrator (org-scoped), so it falls
  // through to the regular member-lookup path below and is scoped to its org.
  if (globalRole === 'super_admin') {
    return {
      userId: user.id,
      orgId: orgId || 'system',
      globalRole,
      orgRole: 'owner',       // super_admin acts as owner of any org it touches
      isPlatformBypass: true,
    };
  }

  // ── Regular org-scoped users ────────────────────────────────────────────────
  if (!orgId) {
    throw new Error('Forbidden: no active organization');
  }

  // ── Phase 2c: authoritative membership check ────────────────────────────────
  // orgId came from the x-org-id header (sourced from a client cookie), so it is
  // NOT trustworthy on its own. Verify the user is a member of THAT EXACT org by
  // querying the member table directly.
  //
  // (The prior auth.api.getActiveMember() resolved the *session's* active org,
  // which could diverge from the x-org-id cookie — a swapped cookie would return
  // a valid membership for a different org while orgId pointed at the target org,
  // enabling cross-tenant access. Checking (userId, orgId) closes that gap.)
  const membershipRow = await db.query.member.findFirst({
    where: and(eq(member.userId, user.id), eq(member.organizationId, orgId)),
  });

  if (!membershipRow) {
    throw new Error('Forbidden: not a member of this organization');
  }

  return {
    userId: user.id,
    orgId,
    globalRole,
    orgRole: normalizeOrgRole(membershipRow.role),
    isPlatformBypass: false,
  };
}

/**
 * Lightweight variant — returns null instead of throwing.
 * Useful in layouts that want to redirect rather than 500.
 */
export async function getOrgContextOrNull(): Promise<OrgContext | null> {
  try {
    return await getOrgContext();
  } catch {
    return null;
  }
}
