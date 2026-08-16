// src/app/api/me/route.ts
// Lightweight session-context endpoint.
// Returns globalRole, orgRole, orgId, and the dashboard the client should redirect to.
// Used by dashboard/page.tsx router — avoids duplicating getOrgContext() logic client-side.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSafeSession } from '@/auth';
import { getOrgContextOrNull } from '@/lib/auth/get-org-context';
import type { Role, OrgRole } from '@/auth/permissions';

export interface MeResponse {
  userId: string;
  globalRole: Role;
  orgRole: OrgRole | null;
  orgId: string | null;
  dashboard: '/dashboard/super-admin' | '/dashboard/institution' | '/dashboard/teacher' | '/dashboard/parent' | '/dashboard/user';
}

function resolveDashboard(
  globalRole: Role,
  orgRole: OrgRole | null,
  isPlatformBypass: boolean,
): MeResponse['dashboard'] {
  // super_admin = sole platform tier → platform owner console
  if (globalRole === 'super_admin') {
    return '/dashboard/super-admin';
  }

  // Institution administrator (global 'admin') OR org owner/org_admin → institution dashboard
  if (globalRole === 'admin' || orgRole === 'owner' || orgRole === 'org_admin') {
    return '/dashboard/institution';
  }

  // Regular teacher
  if (globalRole === 'teacher') {
    return '/dashboard/teacher';
  }

  // Parent — dedicated guardian dashboard (DCP-specific tier)
  if (globalRole === 'parent') {
    return '/dashboard/parent';
  }

  // Students and everyone else
  return '/dashboard/user';
}

export async function GET(): Promise<NextResponse> {
  // "Who are you" and "which org are you in" are DIFFERENT questions, and this
  // route only needs the first.
  //
  // getOrgContext() throws `Forbidden: no active organization` for any
  // non-super_admin whose x-org-id header is empty, and getOrgContextOrNull()
  // flattens that throw to `null`. Reading that null as 401 told a perfectly
  // authenticated user they were unauthenticated — and every D2C learner is in
  // that state, because they belong to no institution (the `member` and
  // `organization` tables are empty in production).
  //
  // The 401 then drove an infinite redirect loop: /dashboard fails closed to
  // /sign-in, middleware sees the still-valid session cookie and bounces back to
  // /dashboard, forever. Logging in "did nothing" for every non-super-admin.
  const session = await getSafeSession(await headers());

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Org context is a refinement here, not a gate: it upgrades the answer to an
  // institution dashboard when the user has one. Its absence is a normal state
  // for a D2C student, so it must not fail the request.
  const ctx = await getOrgContextOrNull();

  const globalRole = (ctx?.globalRole ?? (session.user as { role?: string }).role ?? 'student') as Role;
  const orgRole = ctx?.orgRole ?? null;
  const orgId = ctx && ctx.orgId !== 'system' ? ctx.orgId : null;

  const dashboard = resolveDashboard(globalRole, orgRole, ctx?.isPlatformBypass ?? false);

  const body: MeResponse = {
    userId:     session.user.id,
    globalRole,
    orgRole,
    orgId,
    dashboard,
  };

  return NextResponse.json(body);
}
