// src/app/api/super-admin/onboarding/route.ts
// super_admin onboards a new institution (B2B2C):
//   1. create the Better Auth organization (+ metadata.type)
//   2. create the institutionProfile record
//   3. set entitlements from the chosen plan (allowedFeatures + all enabled by default)
//   4. invite the institution admin by email (Better Auth org invitation)

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { auth } from '@/auth'
import { db } from '@/db'
import { organization, institutionProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { PLAN_FEATURES, setAllowed, type InstitutionPlan } from '@/lib/institution/features'

const Body = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens only'),
  type: z.enum(['school', 'college', 'tuition_center']),
  contactEmail: z.string().email().optional().or(z.literal('')),
  adminEmail: z.string().email(),
  plan: z.enum(['starter', 'professional', 'enterprise']),
})

export async function POST(req: NextRequest) {
  const guard = await requirePlatformOwner()
  if (!guard.ok) return guard.response

  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid data', details: (e as z.ZodError).errors }, { status: 400 })
  }

  // 1. Create the organization (creator/super_admin becomes owner).
  const org = await auth.api.createOrganization({
    body: { name: body.name, slug: body.slug, metadata: { type: body.type } },
    headers: await headers(),
  })
  if (!org) {
    return NextResponse.json({ error: 'Failed to create organization (slug may be taken)' }, { status: 409 })
  }

  // 2. Institution profile.
  await db.insert(institutionProfiles).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    type: body.type,
    contactEmail: body.contactEmail || null,
    onboardingCompleted: false,
  })

  // 3. Entitlements from the plan (allowed = plan features, all enabled by default).
  //    The settings-JSON keeps the friendly label ('professional'); the strict
  //    `subscription_plan` column enum is ['starter','pro','enterprise'], so map it.
  const allowed = PLAN_FEATURES[body.plan as InstitutionPlan]
  const settings = setAllowed(null, allowed, body.plan)
  const planColumn = (body.plan === 'professional' ? 'pro' : body.plan) as 'starter' | 'pro' | 'enterprise'
  await db
    .update(organization)
    .set({ settings, subscriptionPlan: planColumn, subscriptionStatus: 'trial' })
    .where(eq(organization.id, org.id))

  // 4. Invite the institution admin (Better Auth org 'admin' role) — sends email.
  let invited = false
  try {
    await auth.api.createInvitation({
      body: { organizationId: org.id, email: body.adminEmail, role: 'admin' },
      headers: await headers(),
    })
    invited = true
  } catch (e) {
    // Non-fatal: the org exists; the admin can be re-invited from the institution page.
    console.error('[onboarding] invite failed:', (e as Error).message)
  }

  // Email deliverability check. Resend's default `onboarding@resend.dev` sender
  // (or a missing API key) can ONLY deliver to the Resend account owner — invites
  // to real institution admins are rejected with a 403 and silently dropped. Surface
  // this so the wizard warns the super admin instead of implying the email went out.
  const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const emailTestMode = !process.env.RESEND_API_KEY || /@resend\.dev/i.test(fromAddr)

  return NextResponse.json({
    success: true,
    organizationId: org.id,
    slug: org.slug,
    plan: body.plan,
    allowedFeatures: allowed,
    adminInvited: invited,
    adminEmail: body.adminEmail,
    emailTestMode,
  })
}
