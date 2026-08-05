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
// docs/identity-federation-design.md §6, §9.
//
// CORRECTION (2026-08-05): the previous version of this comment claimed this
// "mirrors the working PDLMS implementation" — false. At the time this was
// written, PDLMS had NO global_role handling at all (it only synced tenant
// memberships), and this file's own super_admin write path had never been
// executed against a live DB. It isn't a reference implementation; it's an
// independent, unverified attempt with the identical flaw PDLMS had: the
// super_admin write below hits trg_protect_super_admin (same trigger, same
// design, on all three apps' user tables) and `digiclassroom_app` — this
// app's own DB role — is not a Postgres superuser. Verified empirically
// against PDLMS's copy of the trigger, including that a SECURITY DEFINER
// function does NOT launder the is_superuser check, so there is no way to
// grant super_admin from application code, full stop. See this file's
// syncGlobalRole() for how that's now handled: detect-and-audit, not write.

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

/** OIDC subs (Vidyaverse `sub`, i.e. this row's Account.accountId) allowed to
 *  hold DCP's super_admin role. Sub, not email — an email is mutable at the
 *  IdP; the sub is what the Account row already keys on. */
const SUPER_ADMIN_SUBS = (process.env.FEDERATION_SUPER_ADMIN_SUBS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
  const rawGlobalRoleClaim = claims.global_role;
  const globalRoleMapped = mapGlobalRole(rawGlobalRoleClaim);

  if (rawGlobalRoleClaim && rawGlobalRoleClaim.toLowerCase() === 'support') {
    // Vidyaverse's `support` (platform customer-support staff) has no DCP
    // equivalent. The old map silently promoted it to 'admin' — an
    // unjustified inference. Now it falls through to membership/existing
    // role like any other unmapped claim, but visibly, not silently.
    console.warn(`[federation] global_role="support" has no DCP equivalent for user=${userId} — not elevating`);
  }

  // super_admin can NEVER be written by this sync — see the file-header note.
  // trg_protect_super_admin requires an actual Postgres-superuser session;
  // digiclassroom_app doesn't have one, and neither does a SECURITY DEFINER
  // function (verified). Detect the claim and log it; the grant stays a
  // manual, deliberate escape-hatch transaction until Phase 1 removes the
  // local role column (see TRIO_RESET_PROGRESS.md, Step 0/Step 1.3).
  if (globalRoleMapped === 'super_admin') {
    if (existingRole !== 'super_admin') {
      const allowlisted = SUPER_ADMIN_SUBS.includes(account.accountId);
      console.error(
        `[federation] super_admin claim for sub=${account.accountId} user=${userId} — ` +
          (allowlisted
            ? 'allowlisted but cannot be auto-granted (manual escape-hatch elevation required)'
            : 'NOT in FEDERATION_SUPER_ADMIN_SUBS — refusing'),
      );
    }
    // Fall back to membership-derived role for the actual write below, same
    // as the old email-based clamp did, minus the doomed super_admin write.
  }

  let resolvedGlobalRole: Role =
    globalRoleMapped === 'super_admin'
      ? (mapPrimaryMembershipRole(primaryOrgRole) ?? existingRole ?? 'student')
      : (globalRoleMapped ?? mapPrimaryMembershipRole(primaryOrgRole) ?? existingRole ?? 'student');

  // Only move the global role when a claim explicitly resolves one, and never
  // silently downgrade an existing super_admin/admin.
  const claimResolvedRole =
    (globalRoleMapped !== null && globalRoleMapped !== 'super_admin') ||
    mapPrimaryMembershipRole(primaryOrgRole) !== null;
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
