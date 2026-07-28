// src/lib/auth/super-admin-guard.ts
// ============================================================================
// SECURITY — super_admin is the platform-owner god-mode role.
// ============================================================================
// It may ONLY ever be granted to the single email configured in
// SUPER_ADMIN_EMAIL. Every code path that can set a user's role — the signup
// hook, the federation JIT sync, the user-admin APIs, and the legacy
// assign-role route — MUST funnel super_admin grants through this guard so the
// role can never be obtained by:
//   - a forged signup payload (role: 'super_admin')
//   - a forged / malicious federation `global_role` claim
//   - an admin promoting an arbitrary account
//   - email-domain or hardcoded-allowlist shortcuts
//
// Server-only: reads process.env.SUPER_ADMIN_EMAIL (NOT exposed to the client).

/** True only for the one configured platform-owner email (case-insensitive). */
export function isDesignatedSuperAdmin(email: string | null | undefined): boolean {
  const target = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!target) return false;
  return !!email && email.trim().toLowerCase() === target;
}

/**
 * Clamp a desired role to what `email` is actually allowed to hold.
 * If the desired role is `super_admin` but the email is NOT the designated
 * owner, it is downgraded to `fallback` (default 'student'). All other roles
 * pass through unchanged.
 */
export function sanitizeRole(
  desiredRole: string | null | undefined,
  email: string | null | undefined,
  fallback: string = 'student',
): string {
  const role = desiredRole ?? fallback;
  if (role === 'super_admin' && !isDesignatedSuperAdmin(email)) {
    return fallback;
  }
  return role;
}
