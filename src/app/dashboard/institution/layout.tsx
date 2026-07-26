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

  return <DashboardLayout sidebar={<InstitutionSidebar />}>{children}</DashboardLayout>;
}
