// src/lib/auth/with-org-context.ts
// Phase 1: bypass extended to include super_admin; admin bypass preserved (transition safety).

import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, type OrgContext } from './get-org-context';
import type { Role, OrgRole } from '@/auth/permissions';

/**
 * Back-compat alias. Routes written before the Phase-1 rewrite import
 * `OrgRouteContext`; it is the same shape as `OrgContext`. Prefer `OrgContext`
 * in new code.
 */
export type OrgRouteContext = OrgContext;

interface WithOrgContextOptions {
  /** Require an active org to be present (default: true). */
  requireOrg?: boolean;
  /** Global roles allowed — empty means all authenticated users. */
  roles?: Role[];
  /** Org-scoped roles allowed — empty means any org member. */
  orgRoles?: OrgRole[];
}

type RouteHandler = (
  req: NextRequest,
  params: { params: Record<string, string> },
  orgContext: OrgContext,
) => Promise<NextResponse | Response>;

/**
 * Higher-order wrapper that resolves OrgContext and enforces role gates
 * before calling the route handler.
 *
 * Phase 1 bypass:
 *   super_admin and admin both set isPlatformBypass=true in getOrgContext(),
 *   so they skip org-membership and orgRole checks here.
 *   Phase 2 will introduce per-route super_admin-only gates for destructive ops.
 */
export function withOrgContext(
  handler: RouteHandler,
  options: WithOrgContextOptions = {},
) {
  const { requireOrg = true, roles = [], orgRoles = [] } = options;

  return async (
    req: NextRequest,
    params: { params: Record<string, string> },
  ): Promise<NextResponse | Response> => {
    let orgContext: OrgContext;

    try {
      orgContext = await getOrgContext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      if (message.startsWith('Forbidden')) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Platform bypass (super_admin OR admin in Phase 1) ─────────────────────
    if (orgContext.isPlatformBypass) {
      return handler(req, params, orgContext);
    }

    // ── Org presence check ────────────────────────────────────────────────────
    if (requireOrg && (!orgContext.orgId || orgContext.orgId === 'system')) {
      return NextResponse.json(
        { error: 'Forbidden: no active organization' },
        { status: 403 },
      );
    }

    // ── Global role gate ──────────────────────────────────────────────────────
    if (roles.length > 0 && !roles.includes(orgContext.globalRole)) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient global role' },
        { status: 403 },
      );
    }

    // ── Org role gate ─────────────────────────────────────────────────────────
    if (orgRoles.length > 0 && !orgRoles.includes(orgContext.orgRole)) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient org role' },
        { status: 403 },
      );
    }

    return handler(req, params, orgContext);
  };
}
