// src/lib/auth/require-platform-staff.ts
// Shared platform-level guards for /api/super-admin/* routes.
//
// Phase 1 / Batch 2 — replaces the ad-hoc `role === 'admin'` and hardcoded
// email allowlists scattered across admin routes. Those checks predate the
// super_admin tier and silently lock the platform owner out.
//
// Usage in a route handler:
//   const guard = await requirePlatformStaff();
//   if (!guard.ok) return guard.response;
//   const ctx = guard.ctx;   // OrgContext, if you need userId/role
//
// - requirePlatformStaff(): super_admin OR admin (general admin surface)
// - requirePlatformOwner(): super_admin ONLY (manage:platform / destructive ops)

import { NextResponse } from 'next/server';
import { getOrgContextOrNull, type OrgContext } from './get-org-context';
import { isPlatformStaff, isPlatformOwner } from '@/auth/permissions';

export type PlatformGuardResult =
  | { ok: true; ctx: OrgContext }
  | { ok: false; response: NextResponse };

/** Require the caller to be platform staff (super_admin or admin). */
export async function requirePlatformStaff(): Promise<PlatformGuardResult> {
  const ctx = await getOrgContextOrNull();
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isPlatformStaff(ctx.globalRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden: platform staff only' }, { status: 403 }),
    };
  }
  return { ok: true, ctx };
}

/** Require the caller to be the platform owner (super_admin only). */
export async function requirePlatformOwner(): Promise<PlatformGuardResult> {
  const ctx = await getOrgContextOrNull();
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isPlatformOwner(ctx.globalRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden: super_admin only' }, { status: 403 }),
    };
  }
  return { ok: true, ctx };
}
