// src/lib/federation/jit.ts
//
// JIT (just-in-time) provisioning for federated Vidyaverse sign-ins.
//
// Called from databaseHooks.session.create.after with the user's id. Reads the
// user's stored vidyaverse Account row, decodes the ID token, and reconciles:
//   1. the user's global role (precedence: global_role ?? primary membership ?? existing ?? student)
//   2. one member row per membership[] entry, auto-creating the org if missing
//
// The claim contract (global_role + memberships[]) is emitted by the Vidyaverse
// IdP — see Vidyaverse Pro/backend/src/modules/oidc/claims-resolver.ts and
// docs/identity-federation-design.md §6, §9. This mirrors the working PDLMS
// implementation (PDLMS_Pro/lib/federation/jit.ts).

import { db } from '@/db';
import {
  user as userTable,
  account as accountTable,
  organization as orgTable,
  member as memberTable,
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  mapGlobalRole,
  mapPrimaryMembershipRole,
  mapToOrgRole,
  type VidyaverseIdTokenClaims,
  type VidyaverseMembershipClaim,
} from './types';
import type { Role } from '@/auth/permissions';
import { isDesignatedSuperAdmin } from '@/lib/auth/super-admin-guard';

// Providers that emit the shared OIDC federation contract. `vdl` is the second
// control plane (inert until its env vars exist) — both emit identical claims.
const FEDERATION_PROVIDER_IDS = ['vidyaverse', 'vdl'];

/**
 * JWT decode WITHOUT verification. Better Auth already verified the signature
 * during the OAuth callback before storing the token, so it is safe to trust.
 */
function decodeIdToken(idToken: string | null | undefined): VidyaverseIdTokenClaims | null {
  if (!idToken) return null;
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8');
    return JSON.parse(payload) as VidyaverseIdTokenClaims;
  } catch {
    return null;
  }
}

function orgSlugFor(m: VidyaverseMembershipClaim): string {
  const code = m.institution_code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Namespace by control plane origin so two IdPs can't collide on a shared code.
  return `vidyaverse-${code}`;
}

/**
 * Resolves a Vidyaverse institution to a local DCP organization.
 * Match order: metadata.vidyaverse_institution_id → slug → create.
 */
async function resolveOrCreateOrg(m: VidyaverseMembershipClaim): Promise<string> {
  const slug = orgSlugFor(m);

  // Prefer a stable subject-id match (survives an institution rename).
  const bySlug = await db.select().from(orgTable).where(eq(orgTable.slug, slug)).limit(1);
  const matched = bySlug.find((o) => {
    if (o.slug === slug) return true;
    if (!o.metadata) return false;
    try {
      const meta = JSON.parse(o.metadata) as Record<string, unknown>;
      return meta.vidyaverse_institution_id === m.institution_id;
    } catch {
      return false;
    }
  });
  if (matched) return matched.id;

  const id = crypto.randomUUID();
  await db.insert(orgTable).values({
    id,
    name: m.institution_name,
    slug,
    metadata: JSON.stringify({
      vidyaverse_institution_id: m.institution_id,
      institution_type: m.institution_type,
    }),
    createdAt: new Date(),
  });
  return id;
}

/**
 * Closes the gap that account-linking-by-email opens.
 *
 * requireEmailVerification blocks sign-in until an address is confirmed, but the
 * unverified user row still exists — so someone can register with an address they
 * don't own and sit on it. When the real owner later arrives via Vidyaverse,
 * linking would attach their federated identity to that squatted row, and the
 * squatter's password would still work.
 *
 * An unverified local user at this point is exactly that case: only the IdP has
 * proven control. Retire the local password and mark the address verified.
 */
export async function retireUnprovenCredential(userId: string): Promise<void> {
    // Only a FEDERATED sign-in may retire a local password. This runs from
    // session.create.after, which fires for every session — including ones a local
    // signup flow creates for itself. Without this gate it would delete the
    // credential that signup had just created (a fresh local user is unverified by
    // definition), leaving an account nobody can log into.
    const accounts = await db
        .select()
        .from(accountTable)
        .where(eq(accountTable.userId, userId));
    if (!accounts.some((a) => FEDERATION_PROVIDER_IDS.includes(a.providerId))) return;

    const rows = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    if (!rows[0] || rows[0].emailVerified) return;

    await db
        .delete(accountTable)
        .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'credential')));
    await db
        .update(userTable)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(userTable.id, userId));
}

export interface JitSyncResult {
  userId: string;
  globalRole: Role;
  orgCount: number;
}

/**
 * Public entry point — called from databaseHooks.session.create.after with the
 * user's id. Reconciles global role + org memberships from the stored ID token.
 * Returns null when there is nothing to sync (no federated account / no claims).
 */
export async function syncFederatedSession(userId: string): Promise<JitSyncResult | null> {
  // Newest federated account wins, regardless of which control plane it came from.
  const accounts = await db
    .select()
    .from(accountTable)
    .where(eq(accountTable.userId, userId))
    .orderBy(desc(accountTable.updatedAt));
  const account = accounts.find((a) => FEDERATION_PROVIDER_IDS.includes(a.providerId));
  if (!account) return null;

  const claims = decodeIdToken(account.idToken);
  if (!claims) return null;

  const memberships: VidyaverseMembershipClaim[] = Array.isArray(claims.memberships)
    ? claims.memberships
    : [];

  const users = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
  const existingUser = users[0];
  if (!existingUser) return null;
  const existingRole = (existingUser.role ?? null) as Role | null;

  // ── Global role precedence: global_role ?? primary membership ?? existing ?? student
  const primaryOrgRole = memberships[0]?.role;
  let resolvedGlobalRole: Role =
    mapGlobalRole(claims.global_role) ??
    mapPrimaryMembershipRole(primaryOrgRole) ??
    existingRole ??
    'student';

  // SECURITY: federation can NEVER confer super_admin on a non-owner email, no
  // matter what the hub's global_role claim asserts.
  if (resolvedGlobalRole === 'super_admin' && !isDesignatedSuperAdmin(existingUser.email)) {
    const fromMembership = mapPrimaryMembershipRole(primaryOrgRole);
    resolvedGlobalRole = (fromMembership && fromMembership !== 'super_admin' ? fromMembership : 'student') as Role;
  }

  // Only move the global role when a claim explicitly resolves one, and never
  // silently downgrade an existing super_admin/admin.
  const claimResolvedRole =
    mapGlobalRole(claims.global_role) !== null || mapPrimaryMembershipRole(primaryOrgRole) !== null;
  const protectedRole = existingRole === 'super_admin' || existingRole === 'admin';

  if (claimResolvedRole && !protectedRole && resolvedGlobalRole !== existingRole) {
    await db
      .update(userTable)
      .set({ role: resolvedGlobalRole, lastLogin: new Date(), updatedAt: new Date() })
      .where(eq(userTable.id, userId));
  } else {
    await db.update(userTable).set({ lastLogin: new Date() }).where(eq(userTable.id, userId));
    resolvedGlobalRole = (existingRole ?? resolvedGlobalRole) as Role;
  }

  // ── One member row per membership; auto-create the org if missing.
  for (const m of memberships) {
    const orgId = await resolveOrCreateOrg(m);
    const orgRole = mapToOrgRole(m.role);

    const existingMember = await db
      .select()
      .from(memberTable)
      .where(and(eq(memberTable.userId, userId), eq(memberTable.organizationId, orgId)))
      .limit(1);

    if (existingMember.length === 0) {
      await db.insert(memberTable).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId,
        role: orgRole,
        createdAt: new Date(),
      });
    } else if (existingMember[0].role !== orgRole) {
      await db
        .update(memberTable)
        .set({ role: orgRole })
        .where(and(eq(memberTable.userId, userId), eq(memberTable.organizationId, orgId)));
    }
  }

  return { userId, globalRole: resolvedGlobalRole, orgCount: memberships.length };
}
