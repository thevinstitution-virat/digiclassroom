'use client'

import { useState, useEffect, Suspense } from 'react'
import { authClient } from '@/auth/client'
import { toAppUrl } from '@/utils/auth-redirect'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Info, User, Mail, Lock, Eye, EyeOff } from 'lucide-react'
// App-local single-card auth shell (see AuthShell). The redesign drops the
// two-column brand aside + lotus mandala for a clean, focused auth.
import { AuthShell } from '@/components/auth/AuthShell'

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

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [vidyaverseLoading, setVidyaverseLoading] = useState(false)
    const [verifySent, setVerifySent] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Mirrors the isReal() gate on the server (packages/core/src/auth/index.ts) —
    // Google is only registered with better-auth when this is a real client ID,
    // not the `your_*` placeholder Coolify ships by default. Without this check
    // the button always renders and every click 404s at /api/auth/sign-in/social.
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const googleEnabled = Boolean(
        googleClientId && !googleClientId.startsWith('your_') && !googleClientId.toLowerCase().includes('placeholder')
    )

    // Local email/password self-signup is open again (server sets
    // emailAndPassword.disableSignUp: false, 2026-08-16). requireEmailVerification
    // is still on, so a successful signup creates the account but grants NO
    // session — the user must click the verification email before they can sign
    // in. We therefore show a "check your email" confirmation rather than routing
    // to the dashboard.
    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const result = await authClient.signUp.email({ email, password, name })
            if (result.error) {
                setError(result.error.message || 'Could not create your account. Please try again.')
            } else {
                setVerifySent(true)
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

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

    // Account created — verification email on its way. Everything below the
    // heading is replaced by a single confirmation so the user knows the next
    // step is their inbox, not this page.
    if (verifySent) {
        return (
            <AuthShell title="Almost there" subtitle="Confirm your email to finish">
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3 rounded-[14px] border border-border bg-secondary p-4">
                        <Mail className="mt-0.5 h-5 w-5 flex-none text-[color:var(--accent-strong)]" />
                        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                            We sent a verification link to{' '}
                            <strong className="text-foreground">{email}</strong>. Click it to activate
                            your account, then sign in.
                        </p>
                    </div>
                    <Link
                        href="/sign-in"
                        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 px-4 font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Go to Sign In
                    </Link>
                </div>
            </AuthShell>
        )
    }

    return (
        <AuthShell title="Create your account" subtitle="Start your learning journey">
            <div className="flex flex-col gap-3.5">
                {/* Error Message */}
                {error && (
                    <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
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
                        className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3 font-bold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-secondary disabled:opacity-50"
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

                {/* Vidyaverse SSO — one login across Campus OS, Library and Tutor. */}
                <button
                    onClick={handleVidyaverseSignUp}
                    disabled={vidyaverseLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-[rgb(var(--kumkum-rgb)/0.35)] bg-[rgb(var(--kumkum-rgb)/0.06)] px-4 py-3 font-bold text-[color:var(--kumkum)] transition-all duration-200 hover:bg-[rgb(var(--kumkum-rgb)/0.11)] disabled:opacity-50"
                >
                    {vidyaverseLoading ? (
                        <div
                            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
                            style={{ borderColor: 'var(--kumkum)', borderTopColor: 'transparent' }}
                        />
                    ) : (
                        <Sparkles className="h-5 w-5" style={{ color: 'var(--kumkum)' }} />
                    )}
                    Continue with Vidyaverse
                </button>

                {/* Divider */}
                <div className="my-2 flex items-center gap-3 text-[12.5px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or sign up with email
                    <span className="h-px flex-1 bg-border" />
                </div>

                {/* Email/password registration. Server accepts this again
                    (disableSignUp: false); the account is created unverified and a
                    verification email is sent before it can sign in. */}
                <form onSubmit={handleEmailSignUp} className="flex flex-col gap-3">
                    <div>
                        <label className="mb-1.5 block text-[13.5px] font-bold text-foreground">
                            Full Name
                        </label>
                        <div className="relative">
                            <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                required
                                className="w-full rounded-[14px] border border-input bg-card py-3 pl-11 pr-4 text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[13.5px] font-bold text-foreground">
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
                                className="w-full rounded-[14px] border border-input bg-card py-3 pl-11 pr-4 text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[13.5px] font-bold text-foreground">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                required
                                minLength={8}
                                className="w-full rounded-[14px] border border-input bg-card py-3 pl-11 pr-12 text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25"
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 px-4 font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Creating account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                {/* Info card — federated option still available and encouraged. */}
                <div className="flex items-start gap-3 rounded-[14px] border border-border bg-secondary p-4">
                    <Info className="mt-0.5 h-5 w-5 flex-none text-[color:var(--accent-strong)]" />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Prefer one login across Campus OS, Library and Tutor? Use your{' '}
                        <strong className="text-foreground">Vidyaverse ID</strong> above — no separate
                        password to remember.
                    </p>
                </div>
            </div>

            {/* Sign-In Link */}
            <p className="mt-5 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/sign-in" className="font-bold text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </AuthShell>
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
