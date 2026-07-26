/**
 * Sidebar Context - Manages collapsible sidebar state across all dashboard pages
 * Provides consistent behavior and state persistence
 */

'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

interface SidebarProviderProps {
  children: ReactNode
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isCollapsed, setIsCollapsed] = useState(true) // default collapsed (safe for mobile SSR)
  const [isMobile, setIsMobile] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // 1. Hydrate: detect mobile + restore localStorage (runs once)
  useEffect(() => {
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)

    if (mobile) {
      // Mobile always starts collapsed (sidebar hidden off-screen)
      setIsCollapsed(true)
    } else {
      // Desktop: restore saved preference
      const savedState = localStorage.getItem('vg-kosh-sidebar-collapsed')
      if (savedState !== null) {
        setIsCollapsed(JSON.parse(savedState))
      } else {
        setIsCollapsed(false) // desktop default: expanded
      }
    }
    setHydrated(true)
  }, [])

  // 2. Respond to window resize (NO dependency on isCollapsed to avoid re-collapse loops)
  useEffect(() => {
    if (!hydrated) return
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(prev => {
        // When crossing from desktop → mobile, auto-collapse
        if (mobile && !prev) setIsCollapsed(true)
        return mobile
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [hydrated])

  // 3. Persist to localStorage — only on desktop
  useEffect(() => {
    if (!hydrated || isMobile) return
    localStorage.setItem('vg-kosh-sidebar-collapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed, hydrated, isMobile])

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev)
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed)
  }

  const value: SidebarContextType = {
    isCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    isMobile
  }

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

// Hook for sidebar animations
export function useSidebarAnimation() {
  const { isCollapsed } = useSidebar()
  
  return {
    sidebarWidth: isCollapsed ? 'w-16' : 'w-64',
    contentMargin: isCollapsed ? 'ml-16' : 'ml-64',
    transition: 'transition-all duration-300 ease-in-out'
  }
}
