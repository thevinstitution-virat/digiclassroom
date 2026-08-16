/**
 * AccountMenu — the top-right account dropdown in the dashboard topbar.
 *
 * Sign-out previously lived ONLY as an unlabelled icon in the sidebar footer,
 * which vanishes on ≤1024px (the sidebar becomes an off-canvas drawer and the
 * bottom tab bar carries no logout). This puts a labelled "Sign out" — plus a
 * Profile link — in the topbar, which is visible at every breakpoint and is the
 * place users look for it.
 *
 * Client component: reads the session via authClient.useSession() so it needs no
 * props threaded through the shared shell, and signs out with authClient.signOut().
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/auth/client'
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react'

interface AccountMenuProps {
  /** Where the "Profile" row links. Defaults to the learner profile. */
  profilePath?: string
}

export default function AccountMenu({ profilePath = '/dashboard/user/profile' }: AccountMenuProps) {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const user = session?.user
  const name = user?.name || 'Account'
  const email = user?.email || ''
  const initials =
    (name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('') || 'U').toUpperCase()

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } catch (e) {
      console.error('Sign out failed:', e)
    } finally {
      router.push('/sign-in')
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          padding: '5px 9px 5px 5px', borderRadius: 999,
          background: 'var(--panel)', border: '1px solid var(--line)',
          color: 'var(--ink)', fontFamily: 'var(--font-body)',
        }}
      >
        <span
          className="plinth"
          style={{
            width: 30, height: 30, borderRadius: 999, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))',
            color: '#fff', fontWeight: 800, fontSize: 12,
          }}
        >
          {initials}
        </span>
        <ChevronDown
          className="h-4 w-4"
          style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 40,
            minWidth: 232, background: 'var(--panel)', border: '1px solid var(--line)',
            borderRadius: 14, boxShadow: '0 18px 40px -18px rgba(0,0,0,.45)',
            overflow: 'hidden', padding: 6,
          }}
        >
          <div style={{ padding: '10px 12px 11px', borderBottom: '1px solid var(--line-soft)', marginBottom: 6 }}>
            <div
              style={{
                fontSize: 13.5, fontWeight: 800, color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>
            {email && (
              <div
                style={{
                  fontSize: 11.5, color: 'var(--muted)', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {email}
              </div>
            )}
          </div>

          <Link
            href={profilePath}
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 10, color: 'var(--ink)', fontSize: 13.5, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <UserIcon className="h-[18px] w-[18px]" style={{ color: 'var(--muted)' }} />
            Profile
          </Link>

          <button
            onClick={handleSignOut}
            role="menuitem"
            disabled={signingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--kumkum)', fontSize: 13.5, fontWeight: 700,
              fontFamily: 'var(--font-body)', textAlign: 'left',
            }}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
