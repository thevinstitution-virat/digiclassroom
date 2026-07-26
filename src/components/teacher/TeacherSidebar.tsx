'use client'

// Teacher dashboard sidebar — consumes the canonical TEACHER_NAV.
import BaseSidebar from '@/components/core/shared/BaseSidebar'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { TEACHER_NAV } from '@/lib/dashboard/dashboard-nav'
import { GraduationCap } from 'lucide-react'

export default function TeacherSidebar() {
  const { user } = useBetterAuthUser()

  const sidebarUser = user
    ? {
        firstName: (user as { name?: string }).name?.split(' ')[0] ?? null,
        lastName: (user as { name?: string }).name?.split(' ').slice(1).join(' ') ?? null,
        emailAddress: (user as { email?: string }).email ?? null,
      }
    : null

  return (
    <BaseSidebar
      navigation={TEACHER_NAV}
      user={sidebarUser}
      brandName="DigiClassroom"
      brandSubtitle="Teacher Portal"
      brandIcon={GraduationCap}
      brandColor="bg-green-600"
      theme="light"
      profilePath="/dashboard/user/profile"
      showLogout
      userRole="user"
    />
  )
}
