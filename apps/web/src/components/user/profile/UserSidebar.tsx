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

  // Grouped by use case (mirrors the section pattern already shipped on PDLMS's
  // super-admin sidebar). BaseSidebar renders a header above the first item of
  // each new `section` value, so items sharing a section must stay contiguous.
  const navigation = [
    createNavigationItem('Dashboard', '/dashboard/user', Home, {
      description: 'Overview and activities',
    }),

    // Learn
    createNavigationItem('My Classroom', '/dashboard/student', MonitorPlay, {
      description: 'Your batches and video lectures',
      featured: true,
      section: 'Learn',
    }),
    createNavigationItem('Study Materials', '/dashboard/user/materials', BookOpen, {
      description: 'Access course content',
      featured: true,
      section: 'Learn',
    }),
    createNavigationItem('e-Learning Practest', '/dashboard/user/practest', FileText, {
      description: 'AI-powered assessment engine',
      featured: true,
      section: 'Learn',
    }),
    createNavigationItem('Sanchika', '/dashboard/user/sanchika', FolderTree, {
      description: 'Smart Workspace',
      featured: true,
      section: 'Learn',
    }),

    // AI & Research
    createNavigationItem('Virat Gyankosh', '/dashboard/user/ai-tutor', Brain, {
      description: 'Chat with your AI teacher',
      featured: true,
      section: 'AI & Research',
    }),
    createNavigationItem('Sarvagya', '/dashboard/sarvagya', Search, {
      description: 'AI Research Assistant',
      featured: true,
      section: 'AI & Research',
    }),
    createNavigationItem('Mitram', '/dashboard/user/mitram', Heart, {
      description: 'Psychological & Aptitude Assessment',
      featured: true,
      section: 'AI & Research',
    }),

    // Tools & Reference
    createNavigationItem('Shabdakosh', '/dashboard/user/dictionary', Bookmark, {
      description: 'English-Hindi Dictionary',
      featured: true,
      section: 'Tools & Reference',
    }),
    createNavigationItem('Productivity Tools', '/dashboard/user/productivity', Rocket, {
      description: 'Revolutionary study features',
      featured: true,
      section: 'Tools & Reference',
    }),

    // Progress
    createNavigationItem('Certificates', '/dashboard/student/certificates', Award, {
      description: 'Course completion certificates',
      featured: true,
      section: 'Progress',
    }),
    createNavigationItem('My analytics', '/dashboard/student/my-analytics', TrendingUp, {
      description: 'Performance and growth metrics',
      featured: true,
      section: 'Progress',
    }),

    // Account
    createNavigationItem('Subscription', '/dashboard/user/pricing', CreditCard, {
      description: 'Manage Plan & Billing',
      section: 'Account',
    }),
    createNavigationItem('My purchases', '/dashboard/student/purchases', Receipt, {
      description: 'Payment history and receipts',
      section: 'Account',
    }),
    createNavigationItem('Profile', '/dashboard/user/profile', User, {
      description: 'Settings and preferences',
      featured: true,
      section: 'Account',
    }),
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
