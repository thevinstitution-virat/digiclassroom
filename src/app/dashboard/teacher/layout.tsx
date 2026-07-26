// src/app/dashboard/teacher/layout.tsx
// Server layout guard for the teacher surface.
// Access: globalRole 'teacher' OR platform staff (super_admin/admin).
// (Pending-approval teachers still pass — the approval state is handled by the pages.)

import { redirect } from 'next/navigation'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import DashboardLayout from '@/components/layout/DashboardLayout'
import TeacherSidebar from '@/components/teacher/TeacherSidebar'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContextOrNull()

  if (!ctx) {
    redirect('/sign-in')
  }

  const isTeacher = ctx.globalRole === 'teacher'
  const isPlatformStaff = ctx.globalRole === 'super_admin' || ctx.globalRole === 'admin'

  if (!isTeacher && !isPlatformStaff) {
    redirect('/dashboard/user')
  }

  return <DashboardLayout sidebar={<TeacherSidebar />}>{children}</DashboardLayout>
}
