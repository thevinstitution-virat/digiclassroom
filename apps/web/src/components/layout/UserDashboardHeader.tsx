'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { BackToMenuButton } from '@/components/navigation/BackNavigationButton'
import {
  SparklesIcon,
  BookOpenIcon,
  UserIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'

interface UserDashboardHeaderProps {
  /** Custom title for the page */
  title?: string
  /** Custom subtitle/description */
  subtitle?: string
  /** Whether to show the back button */
  showBackButton?: boolean
  /** Additional content to render in the header */
  children?: React.ReactNode
  /** Custom CSS classes */
  className?: string
}

const UserDashboardHeader: React.FC<UserDashboardHeaderProps> = ({
  title,
  subtitle,
  showBackButton = true,
  children,
  className = ''
}) => {
  const pathname = usePathname()

  // Auto-generate title and subtitle based on current route if not provided
  const getPageInfo = () => {
    if (title && subtitle) {
      return { title, subtitle, icon: SparklesIcon }
    }

    switch (pathname) {
      case '/dashboard/user':
        return {
          title: 'Dashboard',
          subtitle: 'Your personalized learning hub',
          icon: SparklesIcon
        }
      case '/dashboard/user/ai-tutor':
        return {
          title: 'AI Tutor',
          subtitle: 'Get instant help with any topic',
          icon: SparklesIcon
        }
      case '/dashboard/user/materials':
        return {
          title: 'Study Materials',
          subtitle: 'Access your learning resources',
          icon: BookOpenIcon
        }
      case '/dashboard/user/profile':
        return {
          title: 'Profile Settings',
          subtitle: 'Manage your account and preferences',
          icon: UserIcon
        }
      case '/dashboard/user/assessments':
        return {
          title: 'Assessments',
          subtitle: 'Test your knowledge and track progress',
          icon: ClipboardDocumentListIcon
        }
      case '/dashboard/user/dictionary':
        return {
          title: 'Shabdakosh',
          subtitle: 'English-Hindi Dictionary with Amarkosha Wisdom',
          icon: BookOpenIcon
        }
      case '/dashboard/user/productivity':
        return {
          title: 'Productivity Tools',
          subtitle: 'Revolutionary features for enhanced learning',
          icon: RocketLaunchIcon
        }
      case '/dashboard/user/mitram':
        return {
          title: 'Mitram',
          subtitle: 'Psychological & Aptitude Assessment Platform',
          icon: SparklesIcon
        }

      default:
        return {
          title: title || 'VG Kosh',
          subtitle: subtitle || 'AI-Powered Learning Platform',
          icon: SparklesIcon
        }
    }
  }

  const pageInfo = getPageInfo()
  const IconComponent = pageInfo.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`
        bg-white/20 dark:bg-gray-800/20 backdrop-blur-md border-b border-white/30 dark:border-gray-700/30
        px-8 py-6 mb-8 rounded-2xl shadow-lg
        ${className}
      `}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Back Button */}
          {showBackButton && (
            <BackToMenuButton className="flex-shrink-0" />
          )}

          {/* Page Icon and Title */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-blue-600 rounded-xl shadow-lg">
              <IconComponent className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                <span className="bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">
                  {pageInfo.title}
                </span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
                {pageInfo.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Additional content */}
        {children && (
          <div className="flex items-center gap-4">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default UserDashboardHeader

// Specialized header variants for specific pages
export const AITutorHeader: React.FC<Omit<UserDashboardHeaderProps, 'title' | 'subtitle'>> = (props) => (
  <UserDashboardHeader
    title="AI Tutor"
    subtitle="Ask questions and get instant, personalized help"
    {...props}
  />
)

export const MaterialsHeader: React.FC<Omit<UserDashboardHeaderProps, 'title' | 'subtitle'>> = (props) => (
  <UserDashboardHeader
    title="Study Materials"
    subtitle="Browse and access your learning resources"
    {...props}
  />
)

export const ProfileHeader: React.FC<Omit<UserDashboardHeaderProps, 'title' | 'subtitle'>> = (props) => (
  <UserDashboardHeader
    title="Profile Settings"
    subtitle="Manage your account, preferences, and subscription"
    {...props}
  />
)



export const AssessmentsHeader: React.FC<Omit<UserDashboardHeaderProps, 'title' | 'subtitle'>> = (props) => (
  <UserDashboardHeader
    title="Assessments"
    subtitle="Test your knowledge and measure your progress"
    {...props}
  />
)
