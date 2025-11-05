/**
 * Base Sidebar Component - Consistent styling and behavior across all dashboards
 * Implements collapsible functionality with smooth animations
 */

'use client'

import React, { ReactNode, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/contexts/SidebarContext'
import { useClerk } from '@clerk/nextjs'
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Settings,
  LogOut,
  ChevronDown,
  User
} from 'lucide-react'

export interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  featured?: boolean
  badge?: string | number
  gradient?: string
}

export interface SidebarUser {
  firstName?: string | null
  lastName?: string | null
  emailAddress?: string | null
  avatar?: ReactNode
}

interface BaseSidebarProps {
  navigation: NavigationItem[]
  user?: SidebarUser | null
  brandName: string
  brandSubtitle: string
  brandIcon: React.ComponentType<{ className?: string }>
  brandColor: string
  theme?: 'light' | 'dark'
  className?: string
  profilePath?: string // Path to profile page
  showLogout?: boolean // Whether to show logout functionality
  userRole?: 'user' | 'admin' // User role for context-specific features
}

export default function BaseSidebar({
  navigation,
  user,
  brandName,
  brandSubtitle,
  brandIcon: BrandIcon,
  brandColor,
  theme = 'light',
  className = '',
  profilePath,
  showLogout = true,
  userRole = 'user'
}: BaseSidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar, isMobile } = useSidebar()
  const { signOut } = useClerk()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Enhanced design system with border-based active states for visual coherence
  const themeStyles = {
    light: {
      container: 'bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-white/20 dark:border-gray-700/20',
      text: 'text-gray-900 dark:text-white',
      textSecondary: 'text-gray-700 dark:text-gray-200',
      textTertiary: 'text-gray-600 dark:text-gray-300',
      border: 'border-white/20 dark:border-gray-700/20',
      hover: 'hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-blue-500/10 hover:scale-105 hover:shadow-md',
      active: 'bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border-2 border-orange-500 shadow-md',
      activeText: 'bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent font-bold',
      featured: 'ring-2 ring-orange-300 dark:ring-blue-300 shadow-xl bg-gradient-to-r from-orange-500/15 to-blue-500/15'
    },
    dark: {
      container: 'bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-white/20 dark:border-gray-700/20',
      text: 'text-gray-900 dark:text-white',
      textSecondary: 'text-gray-700 dark:text-gray-200',
      textTertiary: 'text-gray-600 dark:text-gray-300',
      border: 'border-white/20 dark:border-gray-700/20',
      hover: 'hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-blue-500/10 hover:scale-105 hover:shadow-md',
      active: 'bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border-2 border-blue-500 shadow-md',
      activeText: 'bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent font-bold',
      featured: 'ring-2 ring-blue-300 shadow-xl bg-gradient-to-r from-orange-500/15 to-blue-500/15'
    }
  }

  const styles = themeStyles[theme]

  return (
    <div
      className={`
        flex h-full flex-col border-r transition-all duration-200 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${styles.container} ${styles.border}
        shadow-xl rounded-r-2xl
        ${className}
      `}
      role="navigation"
      aria-label="Main navigation"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
    >
      {/* Enhanced Header with brand and toggle */}
      <div className={`flex h-20 shrink-0 items-center px-4 ${styles.border} border-b backdrop-blur-xl`}>
        <div className="flex items-center w-full">
          {/* Enhanced Brand */}
          <div className="flex items-center flex-1 min-w-0">
            <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <BrandIcon className="h-6 w-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="ml-4 min-w-0 flex-1">
                <div className="leading-tight">
                  <div className={`text-xl font-bold ${styles.text} bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent`}>
                    Digi
                  </div>
                  <div className={`text-xl font-bold -mt-1 ${styles.text} bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent`}>
                    Classroom
                  </div>
                </div>
                <p className={`text-sm truncate ${styles.textSecondary} font-medium mt-1`}>
                  {brandSubtitle}
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Toggle button */}
          <button
            onClick={toggleSidebar}
            className={`
              p-2 rounded-xl transition-all duration-200 ml-3 flex-shrink-0
              ${styles.hover} ${styles.textTertiary}
              focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
              hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-blue-500/10
              hover:scale-105 active:scale-95
            `}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col px-4 py-6 overflow-y-auto">
        <ul className="flex flex-1 flex-col gap-y-2" role="list">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const IconComponent = item.icon

            return (
              <li key={item.name} role="listitem">
                <Link
                  href={item.href}
                  className={`
                    group flex items-center rounded-xl p-4 text-sm font-bold transition-all duration-200
                    ${isActive ? styles.active : `text-gray-800 dark:text-gray-100 ${styles.hover}`}
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                    ${isCollapsed ? 'justify-center' : 'gap-x-4'}
                    ${isActive ? '' : 'border border-transparent hover:border-white/30 dark:hover:border-gray-600/30'}
                    shadow-sm hover:shadow-xl
                  `}
                  title={isCollapsed ? item.name : undefined}
                  aria-label={isCollapsed ? item.name : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className={`
                    flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 shadow-md
                    ${isActive
                      ? `bg-gradient-to-r ${item.gradient || 'from-orange-500 to-blue-600'} shadow-lg`
                      : `bg-gradient-to-r ${item.gradient || 'from-gray-400 to-gray-500'} group-hover:shadow-lg group-hover:scale-110`
                    }
                  `}>
                    <IconComponent
                      className="h-6 w-6 flex-shrink-0 text-white transition-all duration-200"
                    />
                  </div>

                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`truncate font-bold ${isActive ? styles.activeText : 'text-gray-900 dark:text-white'}`}>
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${item.gradient || 'from-orange-500 to-blue-600'} text-white shadow-md`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs mt-1 truncate text-gray-600 dark:text-gray-300 font-medium">
                          {item.description}
                        </p>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Enhanced User profile with dropdown */}
      {user && (
        <div className={`relative px-4 py-4 ${styles.border} border-t backdrop-blur-xl`} ref={dropdownRef}>
          <div
            className={`flex items-center w-full min-w-0 cursor-pointer rounded-xl p-2 transition-all duration-200 ${
              showProfileDropdown ? 'bg-gradient-to-r from-orange-500/10 to-blue-500/10' : 'hover:bg-gradient-to-r hover:from-orange-500/5 hover:to-blue-500/5'
            }`}
            onClick={() => !isCollapsed && setShowProfileDropdown(!showProfileDropdown)}
          >
            <div className="h-12 w-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <UserCircle className="h-6 w-6 text-white" />
            </div>
            {!isCollapsed && (
              <>
                <div className="ml-4 min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate ${styles.text}`}>
                    {user.firstName} {user.lastName}
                  </p>
                  <p className={`text-xs truncate ${styles.textSecondary} font-medium`}>
                    {user.emailAddress}
                  </p>
                  <div className="flex items-center mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      userRole === 'admin'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {userRole === 'admin' ? 'Administrator' : 'User'}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 ${styles.textTertiary} transition-transform duration-200 ${
                  showProfileDropdown ? 'rotate-180' : ''
                }`} />
              </>
            )}
          </div>

          {/* Profile Dropdown */}
          {!isCollapsed && showProfileDropdown && (
            <div className={`absolute bottom-full left-4 right-4 mb-2 ${styles.container} ${styles.border} border rounded-xl shadow-xl backdrop-blur-xl z-50`}>
              <div className="py-2">
                {profilePath && (
                  <Link
                    href={profilePath}
                    className={`flex items-center px-4 py-3 text-sm ${styles.textSecondary} hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-blue-500/10 transition-all duration-200`}
                    onClick={() => setShowProfileDropdown(false)}
                  >
                    <User className="h-4 w-4 mr-3" />
                    Profile Settings
                  </Link>
                )}
                {userRole === 'admin' && (
                  <Link
                    href="/dashboard/admin/settings"
                    className={`flex items-center px-4 py-3 text-sm ${styles.textSecondary} hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-blue-500/10 transition-all duration-200`}
                    onClick={() => setShowProfileDropdown(false)}
                  >
                    <Settings className="h-4 w-4 mr-3" />
                    Admin Settings
                  </Link>
                )}
                {showLogout && (
                  <>
                    <div className={`border-t ${styles.border} my-2`} />
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false)
                        handleLogout()
                      }}
                      className={`flex items-center w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200`}
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

// Utility function to create navigation items
export function createNavigationItem(
  name: string,
  href: string,
  icon: React.ComponentType<{ className?: string }>,
  options: {
    description?: string
    featured?: boolean
    badge?: string | number
    gradient?: string
  } = {}
): NavigationItem {
  return {
    name,
    href,
    icon,
    ...options
  }
}
