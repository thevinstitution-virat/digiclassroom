// src/app/api/institution/features/route.ts
// Institution feature toggles. GET = current entitlements; PUT = institution
// admin sets which allowed features are enabled (clamped to ⊆ allowed).

import { NextRequest, NextResponse } from 'next/server'
import { withOrgContext, OrgRouteContext } from '@/lib/auth/with-org-context'
import { db } from '@/db'
import { organization } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { parseEntitlements, setEnabled, INSTITUTION_FEATURES } from '@/lib/institution/features'

export const GET = withOrgContext(
  async (_req: NextRequest, _ctx: any, orgContext: OrgRouteContext) => {
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, orgContext.orgId))
      .limit(1)

    const ent = parseEntitlements(org?.settings)
    return NextResponse.json({ catalog: INSTITUTION_FEATURES, ...ent })
  },
  { requireOrg: true },
)

const PutBody = z.object({ enabledFeatures: z.array(z.string()) })

export const PUT = withOrgContext(
  async (req: NextRequest, _ctx: any, orgContext: OrgRouteContext) => {
    const body = PutBody.parse(await req.json())

    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, orgContext.orgId))
      .limit(1)

    const newSettings = setEnabled(org?.settings, body.enabledFeatures)

    await db
      .update(organization)
      .set({ settings: newSettings })
      .where(eq(organization.id, orgContext.orgId))

    return NextResponse.json({ success: true, ...parseEntitlements(newSettings) })
  },
  { requireOrg: true, orgRoles: ['owner', 'org_admin'] },
)
