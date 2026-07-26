'use client'

// Platform dashboard sidebar (super_admin + admin).
// Nav comes from the canonical PLATFORM_NAV matrix; ownerOnly items render
// only for the platform owner (super_admin).
import BaseSidebar from '@/components/core/shared/BaseSidebar'
import OrganizationSwitcher from '@/components/core/shared/OrganizationSwitcher'
import { PLATFORM_NAV, visibleNav } from '@/lib/dashboard/dashboard-nav'

interface AdminSidebarProps {
  user?: {
    firstName?: string | null
    lastName?: string | null
    emailAddress?: string | null
  } | null
  /** True for super_admin — unlocks the platform-owner-only nav items. */
  isOwner?: boolean
}

const AdminBrandIcon = ({ className }: { className?: string }) => (
  <span className={`font-bold text-sm ${className}`}>DC</span>
)

export default function AdminSidebar({ user, isOwner = false }: AdminSidebarProps) {
  const navigation = visibleNav(PLATFORM_NAV, isOwner)

  const sidebarUser = user
    ? {
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddress: user.emailAddress,
      }
    : null

  return (
    <BaseSidebar
      navigation={navigation}
      user={sidebarUser}
      brandName="DigiClassroom"
      brandSubtitle={isOwner ? 'Platform Owner' : 'Admin Portal'}
      brandIcon={AdminBrandIcon}
      brandColor="bg-blue-600"
      theme="dark"
      profilePath="/dashboard/super-admin/profile"
      showLogout
      userRole="admin"
      headerSlot={<OrganizationSwitcher />}
    />
  )
}
