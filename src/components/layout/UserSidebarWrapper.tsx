/**
 * User Sidebar Wrapper - Server component that fetches user data
 * and passes it to the client-side UserSidebar component
 */

import { currentUser } from '@clerk/nextjs/server'
import UserSidebar from '@/components/user/UserSidebar'

export default async function UserSidebarWrapper() {
  const user = await currentUser()
  
  const userData = user ? {
    firstName: user.firstName,
    lastName: user.lastName,
    emailAddress: user.primaryEmailAddress?.emailAddress,
    persona: user.publicMetadata?.persona as string || 'student'
  } : null

  return <UserSidebar user={userData} />
}
