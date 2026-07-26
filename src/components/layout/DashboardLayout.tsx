/**
 * Dashboard Layout — premium app shell.
 * Aurora + blueprint-grid background, in-flow collapsible sidebar on desktop,
 * off-canvas drawer with a sticky top app-bar on mobile/tablet, centered content.
 */

'use client'

import React, { ReactNode } from 'react'
import { Menu, GraduationCap } from 'lucide-react'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'

interface DashboardLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  header?: ReactNode
}

function DashboardLayoutInner({ children, sidebar, header }: DashboardLayoutProps) {
  const { isCollapsed, isMobile, toggleSidebar } = useSidebar()

  return (
    <div className="dc-app-bg dc-grid relative min-h-screen">
      {/* Decorative animated aurora accents */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-orange-400/10 blur-3xl animate-float-slow dark:bg-orange-500/[0.08]" />
        <div className="absolute -bottom-44 right-0 h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl animate-aurora dark:bg-blue-600/[0.08]" />
      </div>

      <div className="relative z-10 flex min-h-screen lg:h-screen">
        {/* Mobile backdrop — closes sidebar on tap */}
        {isMobile && !isCollapsed && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={toggleSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar: in-flow on desktop, off-canvas drawer on mobile/tablet */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
            isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'
          }`}
        >
          {sidebar}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile / tablet top app-bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-card/80 px-4 backdrop-blur-xl lg:hidden">
            <button
              onClick={toggleSidebar}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-dc-grad-br text-white shadow-elev-1">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">Digi Classroom</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
              {header}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children, sidebar, header }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner sidebar={sidebar} header={header}>
        {children}
      </DashboardLayoutInner>
    </SidebarProvider>
  )
}
