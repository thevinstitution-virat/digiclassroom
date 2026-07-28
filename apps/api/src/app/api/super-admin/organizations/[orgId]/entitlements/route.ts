// src/app/api/super-admin/organizations/[orgId]/entitlements/route.ts
// super_admin grants an institution's plan / allowed features (entitlements).
// The institution admin can then toggle within `allowedFeatures`.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { organization } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { parseEntitlements, setAllowed } from '@/lib/institution/features'

const PutBody = z.object({
  allowedFeatures: z.array(z.string()),
  plan: z.string().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const body = PutBody.parse(await req.json())

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, params.orgId))
    .limit(1)

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const newSettings = setAllowed(org.settings, body.allowedFeatures, body.plan)

  await db
    .update(organization)
    .set({ settings: newSettings })
    .where(eq(organization.id, params.orgId))

  return NextResponse.json({ success: true, ...parseEntitlements(newSettings) })
}
