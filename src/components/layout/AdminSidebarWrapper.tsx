/**
 * Admin Sidebar Wrapper - Server component that fetches user data
 * and passes it to the client-side AdminSidebar component
 */

import { currentUser } from '@clerk/nextjs/server'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminSidebarWrapper() {
  const user = await currentUser()
  
  const userData = user ? {
    firstName: user.firstName,
    lastName: user.lastName,
    emailAddress: user.primaryEmailAddress?.emailAddress
  } : null

  return <AdminSidebar user={userData} />
}
