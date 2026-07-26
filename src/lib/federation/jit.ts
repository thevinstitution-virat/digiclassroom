// src/lib/federation/jit.ts
// Phase 1: reads global_role claim from Vidyaverse id_token;
// applies precedence: globalRole ?? primaryMembershipRole ?? existing user.role

import { db } from '@/db';
import { user as userTable, member as memberTable, organization as orgTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  mapGlobalRole,
  mapPrimaryMembershipRole,
  mapToOrgRole,
  type VidyaverseClaims,
} from './types';
import type { Role } from '@/auth/permissions';
import { isDesignatedSuperAdmin } from '@/lib/auth/super-admin-guard';

// ─── Inline Helpers (since helpers.ts is missing) ──────────────────────────────
export function decodeIdToken(token: string): any {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch {
    return {};
  }
}

export async function resolveOrCreateOrg(orgId: string, claims: any): Promise<string> {
  // Basic implementation to ensure the org exists before adding a member
  const existingOrgs = await db.select().from(orgTable).where(eq(orgTable.id, orgId)).limit(1);
  if (existingOrgs.length === 0) {
    await db.insert(orgTable).values({
      id: orgId,
      name: claims.org_name || 'Federated Organization',
      slug: (claims.org_name || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date(),
    });
  }
  return orgId;
}
// ───────────────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JitSyncResult {
  userId: string;
  globalRole: Role;
  orgId: string;
  orgRole: string;
  isNewUser: boolean;
}

// ─── Main JIT sync ────────────────────────────────────────────────────────────

/**
 * Syncs a federated Vidyaverse session into DCP's user + member tables.
 *
 * Role precedence (Phase 1):
 *   1. global_role claim  → mapGlobalRole()   (platform-level, highest priority)
 *   2. org_role claim     → mapPrimaryMembershipRole() (membership-derived)
 *   3. existing user.role (unchanged if neither claim present)
 *   4. fallback: 'student'
 *
 * Org membership:
 *   org_role claim → mapToOrgRole() → member.role (always set, independent of global role)
 */
export async function syncFederatedSession(
  claims: VidyaverseClaims,
): Promise<JitSyncResult> {
  const { sub, email, name, picture, global_role, org_role, org_id } = claims;

  // ── 1. Resolve or create the DCP org ───────────────────────────────────────
  const orgId = org_id
    ? await resolveOrCreateOrg(org_id, claims)
    : 'system';

  // ── 2. Resolve the target DCP global role (precedence chain) ───────────────
  const fromGlobalClaim   = mapGlobalRole(global_role);             // step 1
  const fromMembership    = mapPrimaryMembershipRole(org_role);     // step 2
  // Step 3 (existing role) is applied below after we fetch/create the user

  // ── 3. Upsert the user row ─────────────────────────────────────────────────
  const existingUsers = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  const existingUser = existingUsers[0];
  const isNewUser = !existingUser;

  // Step 3: existing role (used as fallback if neither claim overrides)
  const existingRole = (existingUser?.role ?? null) as Role | null;

  // Apply precedence: globalRole ?? membershipRole ?? existingRole ?? 'student'
  let resolvedGlobalRole: Role =
    fromGlobalClaim ?? fromMembership ?? existingRole ?? 'student';

  // SECURITY: federation can NEVER confer super_admin on a non-owner email, no
  // matter what the hub's global_role claim asserts. Downgrade to the membership
  // role (if any) or student.
  if (resolvedGlobalRole === 'super_admin' && !isDesignatedSuperAdmin(email)) {
    resolvedGlobalRole = (fromMembership && fromMembership !== 'super_admin'
      ? fromMembership
      : 'student') as Role;
  }

  let userId: string;

  if (isNewUser) {
    // Create new user
    const newId = crypto.randomUUID();
    await db.insert(userTable).values({
      id: newId,
      email,
      name: name ?? email.split('@')[0],
      image: picture ?? null,
      role: resolvedGlobalRole,
      emailVerified: true, // Federated identity — email already verified by hub
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userId = newId;
  } else {
    userId = existingUser.id;

    // Only update role if a claim explicitly overrides it.
    // Never silently downgrade an existing super_admin.
    const shouldUpdateRole =
      (fromGlobalClaim !== null) ||
      (fromMembership !== null && existingRole !== 'super_admin' && existingRole !== 'admin');

    if (shouldUpdateRole && resolvedGlobalRole !== existingRole) {
      await db
        .update(userTable)
        .set({
          role: resolvedGlobalRole,
          name: name ?? existingUser.name,
          image: picture ?? existingUser.image,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
    } else {
      // Still sync name/picture even if role is unchanged
      await db
        .update(userTable)
        .set({ name: name ?? existingUser.name, image: picture ?? existingUser.image, updatedAt: new Date() })
        .where(eq(userTable.id, userId));
    }
  }

  // ── 4. Upsert the org member row ───────────────────────────────────────────
  const dcpOrgRole = mapToOrgRole(org_role);

  if (orgId !== 'system') {
    const existingMembers = await db
      .select()
      .from(memberTable)
      .where(
        and(
          eq(memberTable.userId, userId),
          eq(memberTable.organizationId, orgId),
        ),
      )
      .limit(1);

    if (existingMembers.length === 0) {
      await db.insert(memberTable).values({
        id: crypto.randomUUID(),
        userId,
        organizationId: orgId,
        role: dcpOrgRole,
        createdAt: new Date(),
      });
    } else {
      // Update org role if the claim changed (e.g. school_admin promoted to owner)
      if (existingMembers[0].role !== dcpOrgRole) {
        await db
          .update(memberTable)
          .set({ role: dcpOrgRole })
          .where(
            and(
              eq(memberTable.userId, userId),
              eq(memberTable.organizationId, orgId),
            ),
          );
      }
    }
  }

  return {
    userId,
    globalRole: resolvedGlobalRole,
    orgId,
    orgRole: dcpOrgRole,
    isNewUser,
  };
}
