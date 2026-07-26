/**
 * Admin Sidebar Wrapper - Server component that fetches user data
 * and passes it to the client-side AdminSidebar component
 */

import { auth } from '@/auth'
import { headers } from 'next/headers'
import AdminSidebar from '@/components/admin/core/AdminSidebar'

export default async function AdminSidebarWrapper() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user

  const userData = user ? {
    firstName: user.name?.split(' ')[0] || user.name,
    lastName: user.name?.split(' ').slice(1).join(' ') || '',
    emailAddress: user.email
  } : null

  // Platform owner (super_admin) unlocks the ownerOnly nav section.
  const isOwner = (user as { role?: string } | undefined)?.role === 'super_admin'

  return <AdminSidebar user={userData} isOwner={isOwner} />
}
