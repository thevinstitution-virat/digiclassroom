'use client'

// Parent/guardian dashboard sidebar — consumes the canonical PARENT_NAV.
import BaseSidebar from '@/components/core/shared/BaseSidebar'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { PARENT_NAV } from '@/lib/dashboard/dashboard-nav'
import { Heart } from 'lucide-react'

export default function ParentSidebar() {
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
      navigation={PARENT_NAV}
      user={sidebarUser}
      brandName="DigiClassroom"
      brandSubtitle="Parent Portal"
      brandIcon={Heart}
      brandColor="bg-purple-600"
      theme="light"
      profilePath="/dashboard/parent/profile"
      showLogout
      userRole="user"
    />
  )
}
