/**
 * BaseSidebar — the shared dashboard sidebar, a faithful port of the grouped nav
 * in design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html:
 * mandala wordmark + role console label, titled uppercase sections, and a
 * gradient active pill with a left accent bar (`.navitem.active`). Every role
 * sidebar (student/teacher/parent/institution/super-admin) feeds this one
 * component, so the whole product picks up the redesign at once. It also reports
 * its nav up to DashboardShellContext so the topbar title and the ≤1024px bottom
 * tab bar read the exact same items.
 *
 * Markup lives inside the `.dcd` wrapper that DashboardLayout paints on the shell
 * root, so the scoped stylesheet's classes (.sidebar/.navitem/.plinth…) resolve.
 */

'use client'

import React, { ReactNode, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from '@/contexts/SidebarContext'
import { useDashboardShell } from '@/contexts/DashboardShellContext'
import { authClient } from '@/auth/client'
import { LogOut } from 'lucide-react'
import MandalaMark from '@/components/dashboard/MandalaMark'

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
  /** Marks this item for the ≤1024px bottom tab bar (mock: 4 primary + "More"). */
  primary?: boolean
  /** Short label the bottom tab bar uses in place of `name` when set. */
  shortName?: string
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
  brandIcon?: React.ComponentType<{ className?: string }>
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
  profilePath = '/dashboard/user/profile',
  showLogout = true,
  headerSlot,
}: BaseSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed, setSidebarCollapsed } = useSidebar()
  const shell = useDashboardShell()

  // Longest-prefix match so a nested route (…/practest/active) still lights the
  // Practest item, while the dashboard-home root never wins over a deeper page.
  const activeHref = useMemo(() => {
    return navigation
      .map((n) => n.href)
      .filter((h) => pathname === h || pathname.startsWith(h + '/'))
      .sort((a, b) => b.length - a.length)[0]
  }, [navigation, pathname])

  // Feed the shared shell (topbar title + bottom tab bar). Signature-keyed so the
  // provider's state update doesn't re-fire this effect.
  const navSig = navigation.map((n) => `${n.href}|${n.badge ?? ''}`).join(',')
  useEffect(() => {
    shell?.setData({
      items: navigation.map((n) => ({ name: n.name, href: n.href, icon: n.icon, badge: n.badge, primary: n.primary, shortName: n.shortName })),
      brandName,
      roleLabel: brandSubtitle,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSig, brandName, brandSubtitle])

  const handleLogout = async () => {
    // Navigate afterwards, always. Without this the cookie is cleared but the
    // dashboard stays on screen, fully rendered — so signing out looked like it
    // had done nothing until the user happened to reload. The topbar AccountMenu
    // already did this; the sidebar button did not.
    try { await authClient.signOut() } catch (e) { console.error('Logout failed:', e) }
    finally { router.replace('/sign-in') }
  }

  const closeOnMobile = () => setSidebarCollapsed(true)

  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Guest'

  return (
    <aside className={`sidebar ${isCollapsed ? '' : 'open'}`}>
      {/* Brand header */}
      <div
        style={{
          padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 11,
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <MandalaMark size={36} />
        <div>
          <div className="deva" style={{ fontSize: 19, lineHeight: 1 }}>{brandName}</div>
          <div
            style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
              textTransform: 'uppercase', color: 'var(--muted)', marginTop: 3,
            }}
          >
            {brandSubtitle}
          </div>
        </div>
      </div>

      {headerSlot && <div style={{ padding: '12px 12px 0' }}>{headerSlot}</div>}

      {/* Grouped nav */}
      <nav style={{ padding: '12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groupBySection(navigation).map((section) => (
          <div key={section.title || '_'}>
            {section.title && (
              <div
                style={{
                  padding: '6px 14px 7px', fontSize: 10, fontWeight: 800,
                  letterSpacing: '.16em', textTransform: 'uppercase',
                  color: 'var(--muted)', opacity: 0.8,
                }}
              >
                {section.title}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = item.href === activeHref
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={closeOnMobile}
                    aria-current={isActive ? 'page' : undefined}
                    className={`navitem ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="h-[21px] w-[21px] shrink-0" />
                    <span>{item.name}</span>
                    {item.badge != null && item.badge !== '' && (
                      <span
                        style={{
                          marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#fff',
                          background: 'var(--kumkum)', borderRadius: 999, padding: '1px 8px',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      {user && (
        <div style={{ padding: '14px 12px', borderTop: '1px solid var(--line-soft)' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: 9,
              borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)',
            }}
          >
            <Link
              href={profilePath}
              onClick={closeOnMobile}
              style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}
            >
              <span
                className="plinth"
                style={{
                  width: 38, height: 38,
                  background: 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))',
                  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 14,
                }}
              >
                {initials}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13.5, fontWeight: 800, color: 'var(--ink)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {fullName}
                </div>
                <div
                  style={{
                    fontSize: 11.5, color: 'var(--muted)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {user.emailAddress}
                </div>
              </div>
            </Link>
            {showLogout && (
              <button
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex' }}
              >
                <LogOut className="h-[19px] w-[19px]" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

interface Section { title: string; items: NavigationItem[] }

/** Fold the flat, section-tagged nav into contiguous titled groups. Items with
 *  no `section` before the first titled one form an untitled lead group (the
 *  home/overview item), exactly like the mock's first entry. */
function groupBySection(navigation: NavigationItem[]): Section[] {
  const sections: Section[] = []
  for (const item of navigation) {
    const title = item.section || ''
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.items.push(item)
    else sections.push({ title, items: [item] })
  }
  return sections
}

export function createNavigationItem(
  name: string,
  href: string,
  icon: React.ComponentType<{ className?: string }>,
  options: { description?: string; featured?: boolean; badge?: string | number; gradient?: string; section?: string; primary?: boolean; shortName?: string } = {},
): NavigationItem {
  return { name, href, icon, ...options }
}
