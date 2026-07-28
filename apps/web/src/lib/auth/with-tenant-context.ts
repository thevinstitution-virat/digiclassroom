// src/lib/auth/with-tenant-context.ts
//
// B2B2C route wrapper. Unlike withOrgContext (which 401/403s any user with no
// org), this resolves a TenantContext where a logged-in individual/D2C learner
// is valid (orgId = null) — they simply see global content. Institution members
// and platform staff are unchanged. Use for SHARED features (practest, materials)
// that both individuals and institutions should access.

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextOrNull } from '@/lib/db/tenant-context';
import type { TenantContext } from '@/lib/db/tenant-scope';

type TenantRouteHandler = (
  req: NextRequest,
  params: { params: Record<string, string> },
  ctx: TenantContext,
) => Promise<NextResponse | Response>;

export function withTenantContext(handler: TenantRouteHandler) {
  return async (
    req: NextRequest,
    params: { params: Record<string, string> },
  ): Promise<NextResponse | Response> => {
    const ctx = await getTenantContextOrNull();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, params, ctx);
  };
}
