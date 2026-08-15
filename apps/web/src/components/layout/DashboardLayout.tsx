/**
 * DashboardLayout — the shared app shell, a faithful port of the responsive
 * shell in design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html:
 * a fixed 250px sidebar + main column on desktop; on ≤1024px the sidebar becomes
 * an off-canvas drawer (hamburger + backdrop) and a fixed bottom tab bar appears
 * (4 primary items + "More" opening the drawer, with safe-area padding).
 *
 * The topbar title and the bottom tab bar are driven by whatever nav the role
 * sidebar reports through DashboardShellContext, so they always match the sidebar.
 * A user's role — and therefore which dashboard they see — comes from the auth
 * session on the server; each dashboard route keeps its own access guard. There
 * is no in-app control that changes your own role.
 */

'use client'

import React, { ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Menu, Search, Bell, Sun, Moon } from 'lucide-react'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { DashboardShellProvider, useDashboardShell } from '@/contexts/DashboardShellContext'

interface DashboardLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  header?: ReactNode
}

function activeByPrefix(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(h + '/'))
    .sort((a, b) => b.length - a.length)[0]
}

function DashboardLayoutInner({ children, sidebar, header }: DashboardLayoutProps) {
  const { isCollapsed, setSidebarCollapsed } = useSidebar()
  const shell = useDashboardShell()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const items = shell?.data.items ?? []
  const activeHref = useMemo(
    () => activeByPrefix(pathname, items.map((i) => i.href)),
    [pathname, items],
  )
  const activeItem = items.find((i) => i.href === activeHref)
  const topTitle = activeItem?.name || shell?.data.brandName || 'Digi Classroom'
  const topKicker = shell?.data.roleLabel || ''

  const isDark = resolvedTheme === 'dark'
  // The bottom tab bar shows the sidebar's designated primary items (mock: 4 +
  // "More"); when a sidebar marks none, fall back to the first four so every
  // role still gets a usable bar.
  const primaryItems = items.filter((i) => i.primary)
  const bottomItems = (primaryItems.length ? primaryItems : items).slice(0, 4)

  const openNav = () => setSidebarCollapsed(false)
  const closeNav = () => setSidebarCollapsed(true)

  return (
    <div className="dcd" style={{ fontFamily: 'var(--font-body)', color: 'var(--ink)' }}>
      <div className="shell">
        {/* off-canvas backdrop (≤1024px) */}
        <div className={`backdrop ${isCollapsed ? '' : 'show'}`} onClick={closeNav} aria-hidden="true" />

        {sidebar}

        <div className="app-main" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* topbar */}
          <header
            style={{
              position: 'sticky', top: 0, zIndex: 30,
              background: 'color-mix(in srgb,var(--bg) 82%,transparent)',
              backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)',
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}
          >
            <button className="iconbtn hamburger" onClick={openNav} aria-label="Open menu">
              <Menu className="h-[22px] w-[22px]" />
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="dotpulse"
                  style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--emerald)' }}
                />
                <span
                  style={{
                    fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em',
                    textTransform: 'uppercase', color: 'var(--muted)',
                  }}
                >
                  {topKicker}
                </span>
              </div>
              <h1
                style={{
                  margin: '2px 0 0', fontSize: 'clamp(19px,2.4vw,25px)', fontWeight: 800,
                  letterSpacing: '-.02em', color: 'var(--ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {topTitle}
              </h1>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                className="searchbox"
                style={{
                  display: 'none', alignItems: 'center', gap: 9, padding: '9px 15px',
                  borderRadius: 12, background: 'var(--panel)', border: '1px solid var(--line)',
                  color: 'var(--muted)', minWidth: 210,
                }}
              >
                <Search className="h-[19px] w-[19px]" />
                <span style={{ fontSize: 13.5 }}>Search…</span>
              </div>
              <button className="iconbtn" aria-label="Notifications" style={{ position: 'relative' }}>
                <Bell className="h-[21px] w-[21px]" />
                <span
                  style={{
                    position: 'absolute', top: 8, right: 9, width: 7, height: 7,
                    borderRadius: '50%', background: 'var(--kumkum)',
                  }}
                />
              </button>
              <button
                className="iconbtn"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label="Toggle theme"
              >
                {mounted && isDark ? <Sun className="h-[21px] w-[21px]" /> : <Moon className="h-[21px] w-[21px]" />}
              </button>
            </div>
          </header>

          <main style={{ padding: '22px 20px 40px', maxWidth: 1240, width: '100%' }}>
            {header}
            {children}
          </main>

          {/* bottom tab bar (≤1024px) */}
          <nav
            className="bottomnav"
            aria-label="Primary"
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 36,
              background: 'color-mix(in srgb,var(--sidebar) 92%,transparent)',
              backdropFilter: 'blur(16px) saturate(160%)', borderTop: '1px solid var(--line)',
              padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
              justifyContent: 'space-around', alignItems: 'center', gap: 2,
              boxShadow: '0 -10px 30px -20px rgba(0,0,0,.5)',
            }}
          >
            {bottomItems.map((b) => {
              const Icon = b.icon
              const on = b.href === activeHref
              return (
                <Link
                  key={b.href}
                  href={b.href}
                  onClick={closeNav}
                  aria-label={b.name}
                  style={{
                    flex: 1, maxWidth: 90, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 3, padding: '5px 2px',
                    color: on ? 'var(--accent-text)' : 'var(--muted)',
                  }}
                >
                  <span
                    style={{
                      width: 46, height: 30, borderRadius: 999, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', transition: 'background .2s',
                      background: on
                        ? 'linear-gradient(135deg,rgb(var(--accent-primary-rgb) / 0.24),rgb(var(--accent-primary-rgb) / 0.08))'
                        : 'transparent',
                    }}
                  >
                    <Icon className="h-[23px] w-[23px]" />
                  </span>
                  <span
                    style={{
                      fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                    }}
                  >
                    {b.shortName || b.name}
                  </span>
                </Link>
              )
            })}
            <button
              onClick={openNav}
              aria-label="More"
              style={{
                flex: 1, maxWidth: 90, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, padding: '5px 2px', border: 'none', background: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', color: 'var(--muted)',
              }}
            >
              <span
                style={{
                  width: 46, height: 30, borderRadius: 999, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Menu className="h-[23px] w-[23px]" />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>More</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children, sidebar, header }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardShellProvider>
        <DashboardLayoutInner sidebar={sidebar} header={header}>
          {children}
        </DashboardLayoutInner>
      </DashboardShellProvider>
    </SidebarProvider>
  )
}
