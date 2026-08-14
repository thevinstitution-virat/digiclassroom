/**
 * DashboardShellContext — lets the role sidebar (the single source of truth for
 * a role's navigation) feed the shared shell chrome: the topbar title and the
 * ≤1024px bottom tab bar both read the same nav the sidebar renders, so they can
 * never drift. BaseSidebar reports; DashboardLayout consumes.
 */

'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface ShellNavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
  /** Marks this item for the ≤1024px bottom tab bar (mock: 4 primary + "More"). */
  primary?: boolean
  /** Short label the bottom tab bar uses in place of `name` when set. */
  shortName?: string
}

export interface ShellData {
  items: ShellNavItem[]
  brandName: string
  roleLabel: string
}

interface ShellCtx {
  data: ShellData
  setData: (d: ShellData) => void
}

const DashboardShellContext = createContext<ShellCtx | null>(null)

export function DashboardShellProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShellData>({
    items: [],
    brandName: 'Digi Classroom',
    roleLabel: '',
  })
  return (
    <DashboardShellContext.Provider value={{ data, setData }}>
      {children}
    </DashboardShellContext.Provider>
  )
}

export function useDashboardShell() {
  return useContext(DashboardShellContext)
}
