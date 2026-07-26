/**
 * User Sidebar Wrapper - Server component that fetches user data
 * and passes it to the client-side UserSidebar component
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import UserSidebar from '@/components/user/profile/UserSidebar'

export default async function UserSidebarWrapper() {
  const _baSession = await auth.api.getSession({ headers: await headers() });
  const user = _baSession?.user; const userData = user ? {
    firstName: user?.name?.split(' ')[0],
    lastName: user?.name?.split(' ').slice(1).join(' '),
    emailAddress: user.email,
    persona: user.role || 'student'
  } : null

  return <UserSidebar user={userData} />
}
