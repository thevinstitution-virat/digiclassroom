/**
 * BaseSidebar — modern, refined navigation shell shared across all dashboards.
 * Slim items, soft active states, grouped sections, glass panel, collapsible.
 */

'use client'

import React, { ReactNode, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/contexts/SidebarContext'
import { authClient } from '@/auth/client'
import { ChevronLeft, ChevronRight, Settings, LogOut, ChevronDown, User } from 'lucide-react'

export interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  featured?: boolean
  badge?: string | number
  gradient?: string
  /** Optional group label — a header renders above the first item of each section. */
  section?: string
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
  brandColor?: string
  theme?: 'light' | 'dark'
  className?: string
  profilePath?: string
  showLogout?: boolean
  userRole?: 'user' | 'admin'
  headerSlot?: ReactNode
}

export default function BaseSidebar({
  navigation,
  user,
  brandName,
  brandSubtitle,
  brandIcon: BrandIcon,
  profilePath,
  showLogout = true,
  userRole = 'user',
  headerSlot,
  className = '',
}: BaseSidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar, isMobile } = useSidebar()
  const [showProfile, setShowProfile] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    try { await authClient.signOut() } catch (e) { console.error('Logout failed:', e) }
  }

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div
      className={`relative flex h-full flex-col border-r border-border/70 bg-card/85 backdrop-blur-xl transition-all duration-300 ease-in-out shadow-[8px_0_30px_-16px_hsl(var(--shadow-color)/0.35)] ${isCollapsed ? 'w-[76px]' : 'w-64'} ${className}`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Top brand sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-4">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-indigo-500 to-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20">
          <BrandIcon className="h-5 w-5" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-gray-900 dark:text-white">{brandName}</p>
            <p className="truncate text-[11px] font-medium text-gray-400">{brandSubtitle}</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {headerSlot && !isCollapsed && <div className="px-3 pb-2">{headerSlot}</div>}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {navigation.map((item, idx) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const newSection = !!item.section && item.section !== navigation[idx - 1]?.section
          return (
            <React.Fragment key={item.name}>
              {newSection && !isCollapsed && (
                <div className="px-3 pb-1 pt-4 first:pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">{item.section}</span>
                </div>
              )}
              {newSection && isCollapsed && idx !== 0 && (
                <div className="mx-3 my-2 border-t border-gray-200/70 dark:border-white/10" aria-hidden="true" />
              )}
              <Link
                href={item.href}
                onClick={() => { if (isMobile) toggleSidebar() }}
                title={isCollapsed ? item.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/12 to-blue-500/12 text-foreground shadow-sm ring-1 ring-primary/10'
                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                }`}
              >
                {isActive && !isCollapsed && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-gradient-to-b from-orange-500 to-blue-600" />
                )}
                <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'}`} />
                {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}
                {!isCollapsed && item.badge != null && (
                  <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400">{item.badge}</span>
                )}
              </Link>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Profile footer */}
      {user && (
        <div className="relative border-t border-gray-200/70 p-3 dark:border-white/10" ref={dropdownRef}>
          <button
            onClick={() => !isCollapsed && setShowProfile((v) => !v)}
            className={`flex w-full items-center rounded-xl p-1.5 transition-colors ${isCollapsed ? 'justify-center' : 'gap-3'} ${showProfile ? 'bg-gray-100 dark:bg-white/[0.06]' : 'hover:bg-gray-100/70 dark:hover:bg-white/[0.04]'}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 text-xs font-bold text-white dark:from-gray-600 dark:to-gray-800">
              {initials}
            </div>
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                  <p className="truncate text-[11px] text-gray-400">{user.emailAddress}</p>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>

          {!isCollapsed && showProfile && (
            <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-gray-900">
              {profilePath && (
                <Link href={profilePath} onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5">
                  <User className="h-4 w-4" /> Profile
                </Link>
              )}
              {userRole === 'admin' && (
                <Link href="/dashboard/super-admin/settings" onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
              )}
              {showLogout && (
                <button onClick={() => { setShowProfile(false); handleLogout() }}
                  className="flex w-full items-center gap-2.5 border-t border-gray-100 px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/10 dark:text-red-400 dark:hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function createNavigationItem(
  name: string,
  href: string,
  icon: React.ComponentType<{ className?: string }>,
  options: { description?: string; featured?: boolean; badge?: string | number; gradient?: string } = {},
): NavigationItem {
  return { name, href, icon, ...options }
}
