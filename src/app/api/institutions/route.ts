// src/app/api/institutions/route.ts
// GET — list joinable institutions (for the onboarding dropdown). Any signed-in user.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { db } from '@/db'
import { organization, institutionProfiles } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const rows = await db
      .select({
        id: organization.id,
        name: organization.name,
        type: institutionProfiles.type,
        city: institutionProfiles.address,
        logoUrl: institutionProfiles.logoUrl,
      })
      .from(institutionProfiles)
      .innerJoin(organization, eq(organization.id, institutionProfiles.organizationId))
      .orderBy(asc(organization.name))

    return NextResponse.json({ success: true, institutions: rows })
  } catch (e) {
    console.error('[institutions GET]', e)
    return NextResponse.json({ success: false, error: 'Failed to load institutions' }, { status: 500 })
  }
}
