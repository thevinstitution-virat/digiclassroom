// src/app/api/super-admin/organizations/list/route.ts — list all institutions for the super-admin console.
import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { db } from '@/db'
import { organization, member, institutionProfiles } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { parseEntitlements } from '@/lib/institution/features'

export async function GET() {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  const orgs = await db.select().from(organization)

  const memberCounts = await db
    .select({ orgId: member.organizationId, c: sql<number>`count(*)` })
    .from(member)
    .groupBy(member.organizationId)
  const countMap = new Map(memberCounts.map((m) => [m.orgId, Number(m.c)]))

  const profiles = await db.select().from(institutionProfiles)
  const profileMap = new Map(profiles.map((p) => [p.organizationId, p]))

  const organizations = orgs.map((o) => {
    const ent = parseEntitlements((o as { settings?: unknown }).settings)
    const profile = profileMap.get(o.id)
    let metaType: string | null = null
    try {
      metaType = o.metadata ? (JSON.parse(o.metadata) as { type?: string }).type ?? null : null
    } catch {
      /* ignore */
    }
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: profile?.type ?? metaType ?? 'school',
      plan: ent.plan ?? (o as { subscriptionPlan?: string }).subscriptionPlan ?? null,
      status: (o as { subscriptionStatus?: string }).subscriptionStatus ?? 'trial',
      members: countMap.get(o.id) ?? 0,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
      enabledFeatures: ent.enabledFeatures.length,
      allowedFeatures: ent.allowedFeatures.length,
      createdAt: o.createdAt,
    }
  })

  return NextResponse.json({ organizations })
}
