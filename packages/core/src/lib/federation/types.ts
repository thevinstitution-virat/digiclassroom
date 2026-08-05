// src/lib/federation/types.ts
// Phase 1: add super_admin mapping; explicit mapGlobalRole() with precedence docs.

import type { Role, OrgRole } from '@/auth/permissions';

// ─── Vidyaverse ID-token claims shape ────────────────────────────────────────

export interface VidyaverseClaims {
  sub: string;                    // Vidyaverse user ID
  email: string;
  name?: string;
  picture?: string;

  /** Platform-level role from Vidyaverse hub (currently ignored — Phase 1 fixes this). */
  global_role?: string;

  /** Primary org membership role from Vidyaverse. */
  org_role?: string;

  /** Vidyaverse org ID the user belongs to. */
  org_id?: string;

  /** Vidyaverse app context (e.g. 'pdlms', 'digiclassroom'). */
  app?: string;

  iat?: number;
  exp?: number;
}

// ─── OIDC federation contract (current shape emitted by the Vidyaverse IdP) ──
// Source of truth: Vidyaverse Pro/backend/src/modules/oidc/claims-resolver.ts.
// This supersedes the flat org_id/org_role fields above (kept only for the
// legacy ROLE_MAP path). jit.ts reads memberships[] + global_role.

export interface VidyaverseMembershipClaim {
  institution_id: string;
  institution_code: string;
  institution_name: string;
  institution_type: string;
  role: string;
  assigned_classes?: unknown;
  assigned_sections?: unknown;
  subscription_tier?: string;
  subscription_status?: string;
}

export interface VidyaverseIdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  global_role?: string | null;
  memberships?: VidyaverseMembershipClaim[];
  entitlements_url?: string;
  iat?: number;
  exp?: number;
}

// ─── Vidyaverse → DCP global role mapping ────────────────────────────────────
//
// Precedence chain applied in jit.ts:
//   globalRole (from global_role claim)
//     ?? primaryMembershipRole (from org_role claim)
//     ?? existing user.role (unchanged if neither claim present)
//
// This ensures a Vidyaverse super_admin always lands as DCP super_admin,
// even if their org_role would map to something lower.

/**
 * Maps a Vidyaverse `global_role` claim to a DCP global Role.
 * Returns null when the claim should not override — fall through to membership role.
 */
export function mapGlobalRole(globalRole: string | undefined | null): Role | null {
  if (!globalRole) return null;

  switch (globalRole.toLowerCase()) {
    case 'super_admin':
    case 'platform_owner':
      return 'super_admin';

    case 'admin':
    case 'platform_staff':
      return 'admin';

    // 'support' (Vidyaverse's internal customer-support staff role) has no
    // DCP equivalent. It used to fall into the 'admin' case above — an
    // unjustified inference (a support agent isn't a DCP admin). Falls
    // through to null like any other unmapped value; jit.ts logs it
    // explicitly so it isn't silently absorbed.

    // All other Vidyaverse global roles (teacher, student, etc.)
    // should NOT elevate to platform staff — return null to fall through
    // to the org membership role.
    default:
      return null;
  }
}

/**
 * Maps a Vidyaverse `org_role` claim to a DCP global Role.
 * Note: institution admins get a *global* role of 'teacher' or 'student'
 * and an *org-scoped* role of 'org_admin'/'owner' — not a global admin.
 */
export function mapPrimaryMembershipRole(orgRole: string | undefined | null): Role | null {
  if (!orgRole) return null;

  switch (orgRole.toLowerCase()) {
    case 'owner':
    case 'school_owner':
      // Institution owner: global role = teacher (org role handled separately)
      return 'teacher';

    case 'org_admin':
    case 'school_admin':
    case 'principal':
      // Institution admin: global role = teacher (org role = org_admin)
      return 'teacher';

    case 'teacher':
    case 'faculty':
      return 'teacher';

    case 'student':
      return 'student';

    case 'parent':
      return 'parent';

    default:
      return null;
  }
}

/**
 * Maps a Vidyaverse `org_role` claim to a DCP org-scoped OrgRole.
 * This runs in parallel with mapPrimaryMembershipRole to populate member.role.
 */
export function mapToOrgRole(orgRole: string | undefined | null): OrgRole {
  if (!orgRole) return 'student';

  switch (orgRole.toLowerCase()) {
    case 'owner':
    case 'school_owner':
      return 'owner';

    case 'org_admin':
    case 'school_admin':
    case 'principal':
      return 'org_admin';

    case 'teacher':
    case 'faculty':
      return 'teacher';

    case 'parent':
      return 'parent';

    default:
      return 'student';
  }
}

// ─── Legacy ROLE_MAP (kept for backward compat with existing callers) ─────────
// Prefer mapGlobalRole() + mapToOrgRole() for new code.

export const ROLE_MAP: Record<string, Role> = {
  super_admin:    'super_admin',
  platform_owner: 'super_admin',
  admin:          'admin',
  support:        'admin',
  platform_staff: 'admin',
  teacher:        'teacher',
  faculty:        'teacher',
  student:        'student',
  parent:         'parent',
};

/** @deprecated Use mapGlobalRole() instead */
export function mapToDcpRole(vidyaverseRole: string): Role {
  return ROLE_MAP[vidyaverseRole.toLowerCase()] ?? 'student';
}
