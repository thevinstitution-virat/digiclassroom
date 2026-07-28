'use client'

// Institution-admin dashboard sidebar — consumes the canonical INSTITUTION_NAV.
import BaseSidebar from '@/components/core/shared/BaseSidebar'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { INSTITUTION_NAV } from '@/lib/dashboard/dashboard-nav'
import { Building2 } from 'lucide-react'

export default function InstitutionSidebar() {
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
      navigation={INSTITUTION_NAV}
      user={sidebarUser}
      brandName="DigiClassroom"
      brandSubtitle="Institution Admin"
      brandIcon={Building2}
      brandColor="bg-violet-600"
      theme="light"
      profilePath="/dashboard/institution/settings"
      showLogout
      userRole="admin"
    />
  )
}
