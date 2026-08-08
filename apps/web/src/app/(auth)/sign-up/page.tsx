'use client'

import { useState, useEffect, Suspense } from 'react'
import { authClient } from '@/auth/client'
import { toAppUrl } from '@/utils/auth-redirect'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User, Sparkles, BrainCircuit, ClipboardCheck, Rocket } from 'lucide-react'
// Shared Indic motifs, vendored from PDLMS — same lotus backdrop, brand mark
// and card treatment as sign-in, so the two screens feel like one corridor.
import { AuthBackdrop, authCardClassName } from '@/design/indic/motifs/auth-backdrop'
import { MandalaSVG } from '@/design/indic/motifs/mandala-svgs'
import { MandalaMark } from '@/design/indic/motifs/mandala-mark'

const HIGHLIGHTS = [
  { icon: BrainCircuit, title: 'AI tutor that cites the textbook', desc: 'Every answer grounded in your NCERT book — with the exact page.' },
  { icon: ClipboardCheck, title: 'Adaptive Practest engine', desc: 'Exam-style assessments that adjust to your level in real time.' },
  { icon: Rocket, title: 'A full productivity suite', desc: 'Streaks, flashcards, focus tools and offline access — built in.' },
]

function SignUpForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectUrl = searchParams.get('redirect_url') || '/dashboard'
    const { user, isLoaded } = useBetterAuthUser()

    // Redirect authenticated users to dashboard
    useEffect(() => {
        if (isLoaded && user) {
            router.replace('/dashboard')
        }
    }, [isLoaded, user, router])

    const [googleLoading, setGoogleLoading] = useState(false)
    const [vidyaverseLoading, setVidyaverseLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Mirrors the isReal() gate on the server (packages/core/src/auth/index.ts) —
    // Google is only registered with better-auth when this is a real client ID,
    // not the `your_*` placeholder Coolify ships by default. Without this check
    // the button always renders and every click 404s at /api/auth/sign-in/social.
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const googleEnabled = Boolean(
        googleClientId && !googleClientId.startsWith('your_') && !googleClientId.toLowerCase().includes('placeholder')
    )

    // Account creation is federated only. The server sets
    // `emailAndPassword.disableSignUp: true` (packages/core/src/auth/index.ts),
    // so /api/auth/sign-up/email answers 400 EMAIL_PASSWORD_SIGN_UP_DISABLED for
    // every request. This page previously rendered a full name/email/password
    // form against that endpoint — it could not succeed even once, and told the
    // user only "Failed to create account".
    const handleVidyaverseSignUp = async () => {
        setVidyaverseLoading(true)
        setError(null)
        try {
            const oauthClient = authClient as unknown as {
                signIn: { oauth2: (args: { providerId: string; callbackURL?: string }) => Promise<unknown> }
            }
            await oauthClient.signIn.oauth2({ providerId: 'vidyaverse', callbackURL: toAppUrl(redirectUrl) })
        } catch (err: any) {
            setError(err.message || 'Vidyaverse sign-up failed')
            setVidyaverseLoading(false)
        }
    }

    const handleGoogleSignUp = async () => {
        setGoogleLoading(true)
        setError(null)

        try {
            await authClient.signIn.social({
                provider: 'google',
                callbackURL: toAppUrl(redirectUrl),
            })
        } catch (err: any) {
            setError(err.message || 'Google sign-up failed')
            setGoogleLoading(false)
        }
    }

    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
            {/* ── Brand / marketing panel (desktop) ──
                Same Indic aside as sign-in — mandala watermark, turmeric glow,
                so the two screens read as one corridor. */}
            <aside className="indic-auth-aside relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: 'rgb(var(--accent-primary-rgb) / 0.22)' }} />
                    <div className="absolute -bottom-28 -right-16 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: 'rgb(var(--indigo-ink-rgb) / 0.30)' }} />
                    <div className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full blur-3xl" style={{ background: 'rgb(var(--gold-rgb) / 0.14)' }} />
                    <div className="mandala-wrapper mandala-breathe">
                        <MandalaSVG />
                    </div>
                </div>

                <div className="relative flex items-center gap-3">
                    <MandalaMark size={44} />
                    <span className="text-lg font-bold tracking-tight">Digi Classroom</span>
                </div>

                <div className="relative max-w-md">
                    <span className="indic-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                        <Sparkles className="h-3.5 w-3.5" /> Start free in 60 seconds
                    </span>
                    <h2 className="mt-6 text-4xl leading-tight">
                        Start learning smarter,{' '}
                        <span className="gradient-text-saffron">today</span>
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-white/70">
                        Create your account and unlock an AI tutor, adaptive practice and a full productivity suite — aligned to your syllabus.
                    </p>

                    <div className="mt-10 space-y-5">
                        {HIGHLIGHTS.map((h) => (
                            <div key={h.title} className="flex items-start gap-4">
                                <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm"
                                    style={{
                                        background: 'rgb(var(--gold-rgb) / 0.12)',
                                        border: '1px solid rgb(var(--gold-rgb) / 0.25)',
                                    }}
                                >
                                    <h.icon className="h-5 w-5" style={{ color: 'var(--gold)' }} />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">{h.title}</p>
                                    <p className="text-sm text-white/60">{h.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative flex items-center gap-2.5 text-xs text-white/50">
                    <span className="h-2 w-2 rounded-full" style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--gold))' }} />
                    Part of the <span className="font-semibold text-white/70">Vidyaverse</span> ecosystem — one login across Campus OS, Library &amp; Tutor
                </div>
            </aside>

            {/* ── Form panel ── */}
            <main className="relative min-h-screen overflow-hidden">
                <AuthBackdrop>
                <div className={`relative w-full max-w-md ${authCardClassName} p-6 sm:p-8`}>
                    {/* Mobile brand header */}
                    <div className="mb-8 text-center lg:hidden">
                        <MandalaMark size={64} className="mb-4" />
                        <h1 className="text-2xl text-foreground">Create your account</h1>
                        <p className="mt-1.5 text-sm text-muted-foreground">Start your personalised learning journey</p>
                    </div>

                    {/* Desktop heading */}
                    <div className="mb-7 hidden text-center lg:block">
                        <h1 className="text-3xl text-foreground">Create your account</h1>
                        <p className="mt-2 text-muted-foreground">Start your personalised learning journey today</p>
                    </div>

                    {/* Sign-Up Card body */}
                    <div>
                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
                                {error}
                            </div>
                        )}

                        {/* Google Sign-Up — gated on googleEnabled (see above); rendering it
                            unconditionally sends every click to a provider better-auth never
                            registered, a dead 404 with no useful error message. */}
                        {googleEnabled && (
                            <button
                                onClick={handleGoogleSignUp}
                                disabled={googleLoading}
                                className="mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-semibold text-foreground transition-all duration-200 hover:bg-accent hover:shadow-elev-1 disabled:opacity-50"
                            >
                                {googleLoading ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                ) : (
                                    <svg viewBox="0 0 24 24" className="h-5 w-5">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                )}
                                Continue with Google
                            </button>
                        )}

                        {/* Vidyaverse is the primary account-creation path — the server
                            accepts no other. Rendering it above the fold rather than as a
                            fallback, because it is the ONLY thing on this page that works. */}
                        <button
                            onClick={handleVidyaverseSignUp}
                            disabled={vidyaverseLoading}
                            className="mb-6 flex w-full items-center justify-center gap-3 rounded-xl bg-dc-grad-br bg-[length:200%_200%] py-3 px-4 font-semibold text-white shadow-glow-brand transition-all duration-200 hover:shadow-elev-3 hover:[background-position:100%_50%] active:scale-[0.98] disabled:opacity-50"
                        >
                            {vidyaverseLoading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                            ) : (
                                <Sparkles className="h-5 w-5" />
                            )}
                            Continue with Vidyaverse
                        </button>

                        <p className="text-center text-sm text-muted-foreground">
                            DigiClassroom accounts are created through your Vidyaverse ID — one
                            login across Campus OS, Library and Tutor. There is no separate
                            DigiClassroom password to remember.
                        </p>
                    </div>

                    {/* Sign-In Link */}
                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/sign-in" className="font-semibold text-primary hover:underline">
                            Sign in
                        </Link>
                    </p>
                </div>
                </AuthBackdrop>
            </main>
        </div>
    )
}


export default function SignUpPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
        }>
            <SignUpForm />
        </Suspense>
    )
}
