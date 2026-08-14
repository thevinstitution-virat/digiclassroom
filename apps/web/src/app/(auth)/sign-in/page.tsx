'use client'

import { useState, useEffect, Suspense } from 'react'
import { authClient } from '@/auth/client'
import { toAppUrl } from '@/utils/auth-redirect'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Sparkles } from 'lucide-react'
// App-local single-card auth shell. The redesign drops the two-column brand
// aside + lotus mandala the shared AuthBackdrop provides, for a clean, focused
// auth (warm radial page + one parchment card).
import { AuthShell } from '@/components/auth/AuthShell'

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
    const [magicLinkLoading, setMagicLinkLoading] = useState(false)
    const [magicLinkSent, setMagicLinkSent] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const federationEnabled = process.env.NEXT_PUBLIC_FEDERATION_ENABLED === 'true'
    // Mirrors the isReal() gate on the server (packages/core/src/auth/index.ts) —
    // Google is only registered with better-auth when this is a real client ID,
    // not the `your_*` placeholder Coolify ships by default. Without this check
    // the button always renders and every click 404s at /api/auth/sign-in/social.
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const googleEnabled = Boolean(
        googleClientId && !googleClientId.startsWith('your_') && !googleClientId.toLowerCase().includes('placeholder')
    )

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
                // better-auth answers INVALID_EMAIL_OR_PASSWORD both for a wrong
                // password AND for an account that has no password at all. Almost
                // every account here is federated (Google / Vidyaverse) and has no
                // credential row, so the bare message sends people to reset a
                // password that never existed. Name the likely cause instead.
                setError(
                    (result.error.message || 'Invalid email or password') +
                        '. If you signed up with Google or Vidyaverse, use that button above — ' +
                        'or get a one-time sign-in link by email.'
                )
            } else {
                router.push(redirectUrl)
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Passwordless sign-in. The magicLink plugin is registered on BOTH the server
    // (packages/core/src/auth/index.ts) and the client, and /sign-in/magic-link
    // returns 200 — but nothing in the UI ever called it, so a working
    // password-free path sat unreachable while users bounced off a password form
    // for accounts that have no password.
    const handleMagicLink = async () => {
        if (!email) {
            setError('Enter your email address first, then request a sign-in link.')
            return
        }
        setMagicLinkLoading(true)
        setError(null)
        try {
            const magicClient = authClient as unknown as {
                signIn: { magicLink: (args: { email: string; callbackURL?: string }) => Promise<{ error?: { message?: string } }> }
            }
            const result = await magicClient.signIn.magicLink({ email, callbackURL: toAppUrl(redirectUrl) })
            if (result?.error) {
                setError(result.error.message || 'Could not send the sign-in link.')
            } else {
                setMagicLinkSent(true)
            }
        } catch (err: any) {
            setError(err.message || 'Could not send the sign-in link.')
        } finally {
            setMagicLinkLoading(false)
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
        <AuthShell title="Welcome back" subtitle="Sign in to continue learning">
            <div className="flex flex-col gap-3">
                {/* Error Message */}
                {error && (
                    <div className="rounded-[14px] border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
                        {error}
                    </div>
                )}

                {/* Google Sign-In — gated on googleEnabled (see above); rendering it
                    unconditionally sends every click to a provider better-auth never
                    registered, a dead 404 with no useful error message. */}
                {googleEnabled && (
                    <button
                        onClick={handleGoogleSignIn}
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

                {/* Federated sign-in via the Vidyaverse IdP, gated on
                    NEXT_PUBLIC_FEDERATION_ENABLED (build-time). Deliberately tinted
                    with --kumkum, Vidyaverse's own signature pigment, rather than
                    this app's turmeric: it is the one control that hands the user
                    to a different product, so it should look like where it goes.
                    Kumkum is a shared pigment, so this works in every app. */}
                {federationEnabled && (
                    <button
                        onClick={handleVidyaverseSignIn}
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
                )}

                {/* Divider */}
                <div className="my-2 flex items-center gap-3 text-[12.5px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or sign in with email
                    <span className="h-px flex-1 bg-border" />
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3">
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
                                placeholder="Enter your password"
                                required
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

                    <div className="text-right">
                        <Link
                            href="/forgot-password"
                            className="text-[13.5px] font-bold text-primary hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 px-4 font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
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
                    {/* Passwordless option — the only email-based path that works
                        for the federated accounts that make up this user base. */}
                    {magicLinkSent ? (
                        <p className="rounded-[14px] border border-border bg-secondary px-4 py-3 text-center text-sm text-foreground">
                            Check <span className="font-semibold">{email}</span> for a one-time sign-in link.
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={handleMagicLink}
                            disabled={magicLinkLoading}
                            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-card py-3 px-4 font-bold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-secondary disabled:opacity-50"
                        >
                            {magicLinkLoading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                            ) : (
                                <Mail className="h-5 w-5" />
                            )}
                            Email me a sign-in link
                        </button>
                    )}
                </form>
            </div>

            {/* Sign-Up Link */}
            <p className="mt-5 text-center text-sm text-muted-foreground">
                New to Digi Classroom?{' '}
                <Link href="/sign-up" className="font-bold text-primary hover:underline">
                    Create an account
                </Link>
            </p>
        </AuthShell>
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
