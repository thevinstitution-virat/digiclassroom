// src/lib/auth/with-practest-context.ts
//
// Auth wrapper for the STUDENT-facing Practest APIs. Unlike withOrgContext (which
// 403s any non-super-admin without an organization), this also allows INDIVIDUAL
// students (B2C, no org) — they get orgId = null and see only platform-global
// content (practestQueries(null) is scoped to org IS NULL). Org-enrolled students
// keep their org scope; unauthenticated users still get 401.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { getOrgContext } from './get-org-context'
import type { OrgRole } from '@/auth/permissions'

export interface PractestContext {
  userId: string
  /** null for individual (B2C) students — scopes queries to platform-global content. */
  orgId: string | null
  orgRole?: OrgRole
  isPlatformBypass: boolean
}

type Handler = (
  req: NextRequest,
  params: { params: Record<string, string> },
  ctx: PractestContext,
) => Promise<NextResponse | Response>

export function withPractestContext(handler: Handler) {
  return async (
    req: NextRequest,
    params: { params: Record<string, string> },
  ): Promise<NextResponse | Response> => {
    try {
      // Org-enrolled students + super_admin resolve a full org context.
      const oc = await getOrgContext()
      return handler(req, params, {
        userId: oc.userId,
        orgId: oc.orgId && oc.orgId !== 'system' ? oc.orgId : null,
        orgRole: oc.orgRole,
        isPlatformBypass: oc.isPlatformBypass,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      // "Forbidden: no active organization" / "not a member" → treat as an individual
      // student and serve platform-global content. Anything else (no session) → 401.
      if (msg.startsWith('Forbidden')) {
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session?.user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handler(req, params, {
          userId: session.user.id,
          orgId: null,
          orgRole: undefined,
          isPlatformBypass: false,
        })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
}
