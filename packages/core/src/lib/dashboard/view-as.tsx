/**
 * "View as" role switcher data for the dashboard shell. This is a platform-staff
 * affordance: only super_admin / admin viewers can legitimately open every role
 * dashboard, so only their layouts pass this to DashboardLayout. Navigation only —
 * each route keeps its own server-side access guard.
 */

import { GraduationCap, Presentation, Users, Building2, ShieldCheck } from 'lucide-react'
import type { ComponentType } from 'react'

export interface ViewAsRole {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  href: string
}

export const PLATFORM_VIEW_AS_ROLES: ViewAsRole[] = [
  { key: 'student', label: 'Student', icon: GraduationCap, href: '/dashboard/user' },
  { key: 'teacher', label: 'Teacher', icon: Presentation, href: '/dashboard/teacher' },
  { key: 'parent', label: 'Parent', icon: Users, href: '/dashboard/parent' },
  { key: 'institution', label: 'Institution', icon: Building2, href: '/dashboard/institution' },
  { key: 'admin', label: 'Super-Admin', icon: ShieldCheck, href: '/dashboard/super-admin' },
]
