// src/app/dashboard/institution/layout.tsx
// Institution console (B2B2C). Access:
//   - super_admin            → any org (platform owner)
//   - admin                  → institution administrator (global 'admin')
//   - orgRole owner/org_admin → institution administrator (org member)
// Institution admins must operate within an active organization.

import { redirect } from 'next/navigation';
import { getOrgContextOrNull } from '@/lib/auth/get-org-context';
import { dashboardHome } from '@/lib/dashboard/dashboard-nav';
import DashboardLayout from '@/components/layout/DashboardLayout';
import InstitutionSidebar from '@/components/institution/InstitutionSidebar';
import { PLATFORM_VIEW_AS_ROLES } from '@/lib/dashboard/view-as';
import InstitutionOnboardingWizard from '@/components/institution/InstitutionOnboardingWizard';
import { db } from '@/db';
import { institutionProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function InstitutionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContextOrNull();

  if (!ctx) {
    redirect('/sign-in');
  }

  const isSuperAdmin = ctx.globalRole === 'super_admin';
  const isInstitutionAdmin =
    ctx.globalRole === 'admin' || ctx.orgRole === 'owner' || ctx.orgRole === 'org_admin';

  if (!isSuperAdmin && !isInstitutionAdmin) {
    redirect(dashboardHome(ctx.globalRole, ctx.orgRole));
  }

  // Institution admins must have an active organization.
  if (!isSuperAdmin && (!ctx.orgId || ctx.orgId === 'system')) {
    redirect('/dashboard/user');
  }

  const profile = await db.query.institutionProfiles.findFirst({
    where: eq(institutionProfiles.organizationId, ctx.orgId),
  });

  if (isInstitutionAdmin && profile && !profile.onboardingCompleted) {
    return <InstitutionOnboardingWizard initialData={profile} />;
  }

  return (
    <DashboardLayout
      sidebar={<InstitutionSidebar />}
      viewAs={isSuperAdmin ? PLATFORM_VIEW_AS_ROLES : undefined}
    >
      {children}
    </DashboardLayout>
  );
}
