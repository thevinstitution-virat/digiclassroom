// src/app/dashboard/super-admin/layout.tsx
// Platform owner console — super_admin ONLY (B2B2C).
// `admin` is the institution administrator and is redirected to its institution dashboard.

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import { dashboardHome } from '@/lib/dashboard/dashboard-nav'
import AdminSidebarWrapper from '@/components/core/layout/AdminSidebarWrapper'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PLATFORM_VIEW_AS_ROLES } from '@/lib/dashboard/view-as'
import { SuperAdminContextProvider } from './_context/SuperAdminContext'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContextOrNull()

  if (!ctx) {
    redirect('/sign-in')
  }

  if (ctx.globalRole !== 'super_admin') {
    redirect(dashboardHome(ctx.globalRole, ctx.orgRole))
  }

  return (
    <SuperAdminContextProvider>
      <DashboardLayout sidebar={<AdminSidebarWrapper />} viewAs={PLATFORM_VIEW_AS_ROLES}>
        <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
      </DashboardLayout>
    </SuperAdminContextProvider>
  )
}
