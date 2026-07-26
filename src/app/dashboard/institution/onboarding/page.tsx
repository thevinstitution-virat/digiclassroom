// src/app/dashboard/institution/onboarding/page.tsx
//
// LEGACY REDIRECT (B2B2C).
// This used to be a single-step "Create Institution" form gated by
// `role === 'admin'` — a check that predated the super_admin tier and therefore
// wrongly denied the platform owner. Institution creation now belongs to the
// super-admin onboarding wizard (/dashboard/super-admin/onboarding), which also
// sets the plan, entitlements and invites the institution admin.
//
// We redirect by role instead of rendering the old form:
//   super_admin           → the canonical onboarding wizard
//   institution admin/etc → back to their institution dashboard (they don't create orgs)

import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'

export default async function InstitutionOnboardingRedirect() {
  const ctx = await getOrgContextOrNull()

  if (!ctx) {
    redirect('/sign-in')
  }

  if (ctx.globalRole === 'super_admin') {
    redirect('/dashboard/super-admin/onboarding')
  }

  // Institution admins (and anyone else who lands here) do not create institutions.
  redirect('/dashboard/institution')
}
