// src/app/api/me/route.ts
// Lightweight session-context endpoint.
// Returns globalRole, orgRole, orgId, and the dashboard the client should redirect to.
// Used by dashboard/page.tsx router — avoids duplicating getOrgContext() logic client-side.

import { NextResponse } from 'next/server';
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
  const ctx = await getOrgContextOrNull();

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dashboard = resolveDashboard(ctx.globalRole, ctx.orgRole, ctx.isPlatformBypass);

  const body: MeResponse = {
    userId:     ctx.userId,
    globalRole: ctx.globalRole,
    orgRole:    ctx.orgRole,
    orgId:      ctx.orgId === 'system' ? null : ctx.orgId,
    dashboard,
  };

  return NextResponse.json(body);
}
