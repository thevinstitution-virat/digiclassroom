'use client'

import { useState, useEffect, Suspense } from 'react'
import { authClient } from '@/auth/client'
import { toAppUrl } from '@/utils/auth-redirect'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Sparkles, GraduationCap, BrainCircuit, ClipboardCheck, Rocket } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: BrainCircuit, title: 'AI tutor that cites the textbook', desc: 'Every answer grounded in your NCERT book — with the exact page.' },
  { icon: ClipboardCheck, title: 'Adaptive Practest engine', desc: 'Exam-style assessments that adjust to your level in real time.' },
  { icon: Rocket, title: 'A full productivity suite', desc: 'Streaks, flashcards, focus tools and offline access — built in.' },
]

function SignInForm() {
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

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [vidyaverseLoading, setVidyaverseLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const federationEnabled = process.env.NEXT_PUBLIC_FEDERATION_ENABLED === 'true'

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const result = await authClient.signIn.email({
                email,
                password,
            })

            if (result.error) {
                setError(result.error.message || 'Invalid email or password')
            } else {
                router.push(redirectUrl)
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true)
        setError(null)

        try {
            await authClient.signIn.social({
                provider: 'google',
                callbackURL: toAppUrl(redirectUrl),
            })
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed')
            setGoogleLoading(false)
        }
    }

    const handleVidyaverseSignIn = async () => {
        setVidyaverseLoading(true)
        setError(null)
        try {
            const oauthClient = authClient as unknown as {
                signIn: { oauth2: (args: { providerId: string; callbackURL?: string }) => Promise<unknown> }
            }
            await oauthClient.signIn.oauth2({ providerId: 'vidyaverse', callbackURL: toAppUrl(redirectUrl) })
        } catch (err: any) {
            setError(err.message || 'Vidyaverse sign-in failed')
            setVidyaverseLoading(false)
        }
    }

    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
            {/* ── Brand / marketing panel (desktop) ── */}
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
                {/* Aurora + grid texture */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
                    <div className="absolute -bottom-28 -right-16 h-[28rem] w-[28rem] rounded-full bg-blue-500/25 blur-3xl" />
                    <div className="absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                    <div
                        className="absolute inset-0 opacity-[0.12]"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                            backgroundSize: '44px 44px',
                            maskImage: 'radial-gradient(70% 60% at 40% 30%, #000 0%, transparent 80%)',
                            WebkitMaskImage: 'radial-gradient(70% 60% at 40% 30%, #000 0%, transparent 80%)',
                        }}
                    />
                </div>

                <div className="relative flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-indigo-500 to-blue-600 shadow-lg ring-1 ring-white/20">
                        <GraduationCap className="h-6 w-6" />
                    </div>
                    <span className="text-lg font-bold tracking-tight">Digi Classroom</span>
                </div>

                <div className="relative max-w-md">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                        <Sparkles className="h-3.5 w-3.5" /> AI-powered learning
                    </span>
                    <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight">
                        Your AI study partner for{' '}
                        <span className="bg-gradient-to-r from-orange-300 to-blue-300 bg-clip-text text-transparent">CBSE &amp; ICSE</span>
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-white/70">
                        Personalised tutoring, adaptive practice, and a productivity suite — all grounded in your syllabus.
                    </p>

                    <div className="mt-10 space-y-5">
                        {HIGHLIGHTS.map((h) => (
                            <div key={h.title} className="flex items-start gap-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm">
                                    <h.icon className="h-5 w-5 text-blue-200" />
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
                    <span className="h-2 w-2 rounded-full bg-gradient-to-r from-orange-400 to-blue-400" />
                    Part of the <span className="font-semibold text-white/70">Vidyaverse</span> ecosystem — one login across Campus OS, Library &amp; Tutor
                </div>
            </aside>

            {/* ── Form panel ── */}
            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50/70 via-background to-indigo-50/60 p-5 dark:from-slate-950 dark:via-background dark:to-indigo-950/40 sm:p-8">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl lg:hidden" />
                <div className="relative w-full max-w-md">
                    {/* Mobile brand header */}
                    <div className="mb-8 text-center lg:hidden">
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-indigo-500 to-blue-600 shadow-lg ring-1 ring-white/20">
                            <Sparkles className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
                        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue your learning journey</p>
                    </div>

                    {/* Desktop heading */}
                    <div className="mb-7 hidden lg:block">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
                        <p className="mt-2 text-muted-foreground">Sign in to continue your learning journey</p>
                    </div>

                    {/* Sign-In Card */}
                    <div className="rounded-2xl border border-border/70 bg-card/90 p-6 shadow-elev-3 backdrop-blur-xl sm:p-8">
                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
                                {error}
                            </div>
                        )}

                        {/* Google Sign-In */}
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={googleLoading}
                            className="mb-3 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-semibold text-foreground transition-all duration-200 hover:bg-accent hover:shadow-elev-1 disabled:opacity-50"
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

                        {federationEnabled && (
                            <button
                                onClick={handleVidyaverseSignIn}
                                disabled={vidyaverseLoading}
                                className="mb-3 flex w-full items-center justify-center gap-3 rounded-xl border border-indigo-300 bg-indigo-50/50 px-4 py-3 font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-100/70 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                            >
                                {vidyaverseLoading ? (
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                                ) : (
                                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                )}
                                Continue with Vidyaverse
                            </button>
                        )}

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-card px-4 text-muted-foreground">or sign in with email</span>
                            </div>
                        </div>

                        {/* Email Form */}
                        <form onSubmit={handleEmailSignIn} className="space-y-5">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-foreground">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-foreground shadow-elev-1 outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/35"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-foreground">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-12 text-foreground shadow-elev-1 outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/35"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-end">
                                <Link
                                    href="/forgot-password"
                                    className="text-sm font-semibold text-primary hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-dc-grad-br bg-[length:200%_200%] py-3 px-4 font-semibold text-white shadow-glow-brand transition-all duration-200 hover:shadow-elev-3 hover:[background-position:100%_50%] active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Sign-Up Link */}
                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        New to Digi Classroom?{' '}
                        <Link href="/sign-up" className="font-semibold text-primary hover:underline">
                            Create an account
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    )
}


export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
        }>
            <SignInForm />
        </Suspense>
    )
}
