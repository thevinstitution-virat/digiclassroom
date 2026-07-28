/**
 * Dashboard Layout - Client-side wrapper for sidebar functionality
 * Handles collapsible sidebar state while keeping server components intact
 */

'use client'

import React, { ReactNode } from 'react'
import { SidebarProvider, useSidebarAnimation } from '@/contexts/SidebarContext'

interface DashboardLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  header?: ReactNode
}

// Inner component that uses the sidebar context
function DashboardLayoutInner({ children, sidebar, header }: DashboardLayoutProps) {
  const { sidebarWidth, transition } = useSidebarAnimation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Glassmorphic overlay for consistency with landing page */}
      <div className="absolute inset-0 bg-white/20 dark:bg-black/10 backdrop-blur-sm pointer-events-none" />

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <div className={`${sidebarWidth} ${transition} flex-shrink-0`}>
          {sidebar}
        </div>

        {/* Main content */}
        <main className={`flex-1 overflow-y-auto ${transition}`}>
          <div className="p-6">
            {header}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// Main component with provider
export default function DashboardLayout({ children, sidebar, header }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner sidebar={sidebar} header={header}>
        {children}
      </DashboardLayoutInner>
    </SidebarProvider>
  )
}
