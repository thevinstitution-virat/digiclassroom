'use client'

import BaseSidebar, { createNavigationItem } from '@/components/core/shared/BaseSidebar'
import {
  Home,
  MessageSquare,
  BookOpen,
  FileText,
  User,
  Brain,
  Bookmark,
  Rocket,
  Heart,
  Sparkles,
  Search,
  FolderTree,
  MonitorPlay,
  Receipt,
  Award,
  TrendingUp,
  CreditCard
} from 'lucide-react'

interface UserSidebarProps {
  user?: {
    firstName?: string | null
    lastName?: string | null
    emailAddress?: string | null
    persona?: string
  } | null
}

export default function UserSidebar({ user }: UserSidebarProps) {
  const persona = user?.persona || 'student'

  // Create navigation items using the utility function with matching gradients
  const navigation = [
    createNavigationItem('Dashboard', '/dashboard/user', Home, {
      description: 'Overview and activities',
      gradient: 'from-slate-500 to-gray-600'
    }),
    createNavigationItem('My Classroom', '/dashboard/student', MonitorPlay, {
      description: 'Your batches and video lectures',
      featured: true,
      gradient: 'from-violet-500 to-purple-600'
    }),

    createNavigationItem('Virat Gyankosh', '/dashboard/user/ai-tutor', Brain, {
      description: 'Chat with your AI teacher',
      featured: true,
      gradient: 'from-purple-500 to-indigo-600'
    }),
    createNavigationItem('Sarvagya', '/dashboard/sarvagya', Search, {
      description: 'AI Research Assistant',
      featured: true,
      gradient: 'from-amber-500 to-orange-500'
    }),
    createNavigationItem('Study Materials', '/dashboard/user/materials', BookOpen, {
      description: 'Access course content',
      featured: true,
      gradient: 'from-green-500 to-emerald-500'
    }),
    createNavigationItem('e-Learning Practest', '/dashboard/user/practest', FileText, {
      description: 'AI-powered assessment engine',
      featured: true,
      gradient: 'from-blue-500 to-cyan-500'
    }),
    createNavigationItem('Sanchika', '/dashboard/user/sanchika', FolderTree, {
      description: 'Smart Workspace',
      featured: true,
      gradient: 'from-cyan-500 to-blue-600'
    }),
    createNavigationItem('Shabdakosh', '/dashboard/user/dictionary', Bookmark, {
      description: 'English-Hindi Dictionary',
      featured: true,
      gradient: 'from-pink-500 to-rose-500'
    }),
    createNavigationItem('Mitram', '/dashboard/user/mitram', Heart, {
      description: 'Psychological & Aptitude Assessment',
      featured: true,
      gradient: 'from-teal-500 to-blue-500'
    }),
    createNavigationItem('Productivity Tools', '/dashboard/user/productivity', Rocket, {
      description: 'Revolutionary study features',
      featured: true,
      gradient: 'from-orange-500 to-red-500'
    }),
    createNavigationItem('Subscription', '/dashboard/user/pricing', CreditCard, {
      description: 'Manage Plan & Billing',
      featured: false,
      gradient: 'from-slate-400 to-slate-500'
    }),
    createNavigationItem('Profile', '/dashboard/user/profile', User, {
      description: 'Settings and preferences',
      featured: true,
      gradient: 'from-indigo-500 to-purple-500'
    }),

    createNavigationItem('Certificates', '/dashboard/student/certificates', Award, {
      description: 'Course completion certificates',
      featured: true,
      gradient: 'from-yellow-500 to-amber-500'
    }),
    createNavigationItem('My analytics', '/dashboard/student/my-analytics', TrendingUp, {
      description: 'Performance and growth metrics',
      featured: true,
      gradient: 'from-blue-600 to-indigo-600'
    }),
    createNavigationItem('My purchases', '/dashboard/student/purchases', Receipt, {
      description: 'Payment history and receipts',
      featured: false,
    })
  ]

  const getPersonaColor = () => {
    switch (persona) {
      case 'student':
        return 'bg-blue-600'
      case 'teacher':
        return 'bg-green-600'
      case 'guardian':
        return 'bg-purple-600'
      default:
        return 'bg-blue-600'
    }
  }

  const getPersonaLabel = () => {
    switch (persona) {
      case 'student':
        return 'Student'
      case 'teacher':
        return 'Teacher'
      case 'guardian':
        return 'Parent/Guardian'
      default:
        return 'Student'
    }
  }

  // Prepare user data for BaseSidebar
  const sidebarUser = user ? {
    firstName: user?.firstName,
    lastName: user?.lastName,
    emailAddress: user.emailAddress
  } : null

  return (
    <BaseSidebar
      navigation={navigation}
      user={sidebarUser}
      brandName="Digi Classroom"
      brandSubtitle={`${getPersonaLabel()} Portal`}
      brandIcon={Sparkles}
      brandColor={getPersonaColor()}
      theme="light"
      profilePath="/dashboard/user/profile"
      showLogout={true}
      userRole="user"
    />
  )
} 
