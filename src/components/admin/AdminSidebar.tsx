'use client'

import BaseSidebar, { createNavigationItem } from '@/components/shared/BaseSidebar'
import {
  Home,
  Users,
  FileText,
  BarChart3,
  Settings,
  Database,
  TestTube,
  Activity,
  Folder,
  Shield,
  Brain,
  Target,
  CheckCircle
} from 'lucide-react'



interface AdminSidebarProps {
  user?: {
    firstName?: string | null
    lastName?: string | null
    emailAddress?: string | null
  } | null
}

export default function AdminSidebar({ user }: AdminSidebarProps) {

  // Create navigation items using the utility function
  const navigation = [
    createNavigationItem('Dashboard', '/dashboard/admin', Home, {
      description: 'System overview and metrics'
    }),
    createNavigationItem('User Management', '/dashboard/admin/users', Users, {
      description: 'Manage users and permissions'
    }),
    createNavigationItem('Teacher Verification', '/dashboard/admin/teacher-verification', CheckCircle, {
      description: 'Review teacher verification documents',
      featured: true
    }),
    createNavigationItem('User Sync', '/dashboard/admin/sync', Database, {
      description: 'Sync users from Clerk authentication',
      featured: true
    }),
    createNavigationItem('Content Management', '/dashboard/admin/content', FileText, {
      description: 'Educational content and resources'
    }),
    createNavigationItem('Materials Management', '/dashboard/admin/materials', Folder, {
      description: 'Study materials and Google Drive integration'
    }),
    createNavigationItem('Practest Engine', '/dashboard/admin/practest', Target, {
      description: 'AI-powered assessment management',
      featured: true
    }),
    createNavigationItem('Vector Database', '/dashboard/admin/vector-db', Database, {
      description: 'AI knowledge base management'
    }),
    createNavigationItem('Analytics', '/dashboard/admin/analytics', BarChart3, {
      description: 'Usage statistics and insights'
    }),
    createNavigationItem('Quality Tests', '/dashboard/admin/quality-tests', TestTube, {
      description: 'System testing and validation'
    }),
    createNavigationItem('Performance', '/dashboard/admin/performance', Activity, {
      description: 'System performance monitoring'
    }),
    createNavigationItem('Settings', '/dashboard/admin/settings', Settings, {
      description: 'System configuration'
    }),
    createNavigationItem('Profile', '/dashboard/admin/profile', Shield, {
      description: 'Admin account settings',
      featured: true,
      gradient: 'from-red-500 to-pink-500'
    })
  ]

  // Prepare user data for BaseSidebar
  const sidebarUser = user ? {
    firstName: user.firstName,
    lastName: user.lastName,
    emailAddress: user.emailAddress
  } : null

  // Custom brand icon component for admin
  const AdminBrandIcon = ({ className }: { className?: string }) => (
    <span className={`font-bold text-sm ${className}`}>VG</span>
  )

  return (
    <BaseSidebar
      navigation={navigation}
      user={sidebarUser}
      brandName="Digi Classroom"
      brandSubtitle="Admin Portal"
      brandIcon={AdminBrandIcon}
      brandColor="bg-blue-600"
      theme="dark"
      profilePath="/dashboard/admin/profile"
      showLogout={true}
      userRole="admin"
    />
  )
}