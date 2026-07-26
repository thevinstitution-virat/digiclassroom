// src/app/dashboard/parent/layout.tsx
// Server layout guard for the parent/guardian surface.
// Access: globalRole 'parent' OR platform staff (super_admin/admin). Everyone
// else is redirected to their own dashboard.

import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ParentSidebar from '@/components/parent/ParentSidebar'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContextOrNull()

  if (!ctx) {
    redirect('/sign-in')
  }

  const isParent = ctx.globalRole === 'parent'
  const isPlatformStaff = ctx.globalRole === 'super_admin' || ctx.globalRole === 'admin'

  if (!isParent && !isPlatformStaff) {
    redirect('/dashboard/user')
  }

  return <DashboardLayout sidebar={<ParentSidebar />}>{children}</DashboardLayout>
}
