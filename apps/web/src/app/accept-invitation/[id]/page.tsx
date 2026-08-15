'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/auth/client'
import { Building2, CheckCircle2, XCircle, Loader2, LogIn, UserPlus } from 'lucide-react'

export default function AcceptInvitationPage() {
  const params = useParams<{ id: string }>()
  const invitationId = params?.id
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const [orgName, setOrgName] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'accepted' | 'declined' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const here = `/accept-invitation/${invitationId}`

  // Best-effort fetch of invitation details (org name / role) once signed in.
  useEffect(() => {
    if (!invitationId || isPending || !session?.user) return
    ;(async () => {
      try {
        const res: any = await authClient.organization.getInvitation({ query: { id: invitationId } })
        const inv = res?.data
        if (inv) {
          setOrgName(inv.organizationName ?? inv.organization?.name ?? null)
          setRole(inv.role ?? null)
        }
      } catch {
        /* generic copy is fine */
      }
    })()
  }, [invitationId, isPending, session?.user])

  const accept = async () => {
    if (!invitationId) return
    setStatus('working'); setError(null)
    try {
      const res: any = await authClient.organization.acceptInvitation({ invitationId })
      if (res?.error) {
        setError(res.error.message || 'Could not accept the invitation. It may have expired.')
        setStatus('error')
        return
      }
      setStatus('accepted')
      setTimeout(() => router.push('/dashboard'), 1200)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.')
      setStatus('error')
    }
  }

  const decline = async () => {
    if (!invitationId) return
    setStatus('working')
    try {
      await authClient.organization.rejectInvitation({ invitationId })
    } catch { /* ignore */ }
    setStatus('declined')
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50/70 via-background to-primary/10 p-5 dark:from-[var(--night-ink)] dark:via-background dark:to-primary/40">
      <div className="pointer-events-none absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/60 blur-3xl dark:bg-primary/100" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl dark:bg-orange-500/10" />

      <div className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card/90 p-8 text-center shadow-elev-3 backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-primary to-primary/80 text-white shadow-lg ring-1 ring-white/20">
          <Building2 className="h-8 w-8" />
        </div>

        {isPending ? (
          <div className="py-6"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
        ) : !session?.user ? (
          // ── Not signed in ──
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">You&apos;re invited{orgName ? ` to ${orgName}` : ''}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in or create your account to join your institution on Digi Classroom.</p>
            <div className="mt-6 space-y-3">
              <Link href={`/sign-up?redirect_url=${encodeURIComponent(here)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-dc-grad-br py-3 font-semibold text-white shadow-glow-brand transition-all hover:shadow-elev-3">
                <UserPlus className="h-5 w-5" /> Create account &amp; join
              </Link>
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(here)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 font-semibold text-foreground transition-colors hover:bg-accent">
                <LogIn className="h-5 w-5" /> I already have an account
              </Link>
            </div>
          </>
        ) : status === 'accepted' ? (
          <>
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">You&apos;re in! 🎉</h1>
            <p className="mt-2 text-sm text-muted-foreground">Taking you to your dashboard…</p>
          </>
        ) : status === 'declined' ? (
          <>
            <XCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Invitation declined</h1>
            <p className="mt-2 text-sm text-muted-foreground">No problem — redirecting…</p>
          </>
        ) : (
          // ── Signed in: accept / decline ──
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Join {orgName || 'your institution'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ve been invited{role ? <> as <strong className="text-foreground">{role === 'member' ? 'student' : role}</strong></> : ''}. Accept to join and unlock your institution&apos;s content.
            </p>
            {error && (
              <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={decline} disabled={status === 'working'}
                className="flex-1 rounded-xl border border-border bg-background py-3 font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50">
                Decline
              </button>
              <button onClick={accept} disabled={status === 'working'}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-dc-grad-br py-3 font-semibold text-white shadow-glow-brand transition-all hover:shadow-elev-3 disabled:opacity-50">
                {status === 'working' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Accept &amp; Join
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
