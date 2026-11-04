'use client'

// Public landing page of a guardian invitation link. Signed out: sign up / sign in and come back here. Signed in: see who invited you
// for which child, and accept. The server checks the invited address, the e-mail confirmation and the link's validity (lib/guardian/onboarding.ts).

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Heart, CheckCircle2, Loader2, LogIn, UserPlus, XCircle } from 'lucide-react'
import { authClient } from '@/auth/client'
import { api } from '@/lib/trpc/client'
import { useHwT } from '@/components/hw/strings'

export default function AcceptGuardianPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useHwT()
  const { data: session, isPending } = authClient.useSession()
  const signedIn = !!session?.user
  const preview = api.guardian.preview.useQuery({ token: token ?? '' }, { enabled: signedIn && !!token, retry: false })
  const [done, setDone] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const accept = api.guardian.accept.useMutation({
    onSuccess: async (r) => {
      setDone(r.studentFirstName)
      setLeaving(true)
      // The account became a guardian one: refresh the session from the database (not the cookie cache) so the dashboard routes to the parent area.
      try { await authClient.getSession({ query: { disableCookieCache: true } }) } catch { /* the next sign-in picks it up */ }
      setTimeout(() => { window.location.href = '/dashboard/parent/wards' }, 1500)
    },
  })
  const here = `/accept-guardian/${token}`
  const p = preview.data

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50/70 via-background to-primary/10 p-5 dark:from-[var(--night-ink)] dark:via-background dark:to-primary/40">
      <div className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card/90 p-8 text-center shadow-elev-3 backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-primary to-primary/80 text-white shadow-lg ring-1 ring-white/20">
          <Heart className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('ga.title')}</h1>

        {isPending ? (
          <div className="py-6"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
        ) : !signedIn ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{t('ga.intro')}</p>
            <div className="mt-6 space-y-3">
              <Link href={`/sign-up?redirect_url=${encodeURIComponent(here)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-dc-grad-br py-3 font-semibold text-white shadow-glow-brand transition-all hover:shadow-elev-3">
                <UserPlus className="h-5 w-5" /> {t('ga.create')}
              </Link>
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(here)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 font-semibold text-foreground transition-colors hover:bg-accent">
                <LogIn className="h-5 w-5" /> {t('ga.signin')}
              </Link>
            </div>
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="mx-auto my-4 h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t('ga.done', { name: done })}</p>
            {leaving && <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-primary" />}
          </>
        ) : preview.isLoading ? (
          <div className="py-6"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
        ) : preview.error ? (
          <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {preview.error.data?.code === 'FORBIDDEN' ? t('ga.off') : preview.error.message}
          </p>
        ) : p && !p.valid ? (
          <>
            <XCircle className="mx-auto my-4 h-12 w-12 text-muted-foreground" />
            <p role="alert" className="text-sm text-muted-foreground">{p.problem || t('ga.invalid')}</p>
          </>
        ) : p ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {p.organizationName ? t('ga.for', { org: p.organizationName, name: p.studentFirstName, email: p.forEmail }) : t('ga.forPlatform', { name: p.studentFirstName, email: p.forEmail })}
            </p>
            {!p.addressMatches ? (
              <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t('ga.mismatch')}</p>
            ) : (
              <>
                {accept.error && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">{accept.error.message}</p>}
                <button onClick={() => accept.mutate({ token })} disabled={accept.isPending}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-dc-grad-br py-3 font-semibold text-white shadow-glow-brand transition-all hover:shadow-elev-3 disabled:opacity-50">
                  {accept.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  {accept.isPending ? t('ga.working') : t('ga.accept')}
                </button>
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
