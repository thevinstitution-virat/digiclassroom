/**
 * "View as" role switcher data for the dashboard shell. This is a platform-staff
 * affordance: only super_admin / admin viewers can legitimately open every role
 * dashboard, so only their layouts pass this to DashboardLayout. Navigation only —
 * each route keeps its own server-side access guard.
 *
 * `icon` is a STRING KEY, not a component. This module is imported by SERVER
 * layouts (super-admin / teacher / parent / institution) and the array is handed
 * to the CLIENT DashboardLayout as a prop. A component/function value here cannot
 * cross that server→client boundary — React throws "Functions cannot be passed
 * directly to Client Components", which 500s every dashboard that passes viewAs.
 * DashboardLayout maps this key back to a Lucide icon on the client.
 */

export type ViewAsIcon = 'student' | 'teacher' | 'parent' | 'institution' | 'admin'

export interface ViewAsRole {
  key: string
  label: string
  icon: ViewAsIcon
  href: string
}

export const PLATFORM_VIEW_AS_ROLES: ViewAsRole[] = [
  { key: 'student', label: 'Student', icon: 'student', href: '/dashboard/user' },
  { key: 'teacher', label: 'Teacher', icon: 'teacher', href: '/dashboard/teacher' },
  { key: 'parent', label: 'Parent', icon: 'parent', href: '/dashboard/parent' },
  { key: 'institution', label: 'Institution', icon: 'institution', href: '/dashboard/institution' },
  { key: 'admin', label: 'Super-Admin', icon: 'admin', href: '/dashboard/super-admin' },
]
