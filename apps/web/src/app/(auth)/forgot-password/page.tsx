'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { forgetPassword } from '@/auth/client'
import { GraduationCap, Mail, AlertCircle, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const result = await forgetPassword({
                email,
                redirectTo: '/reset-password',
            })

            if (result.error) {
                setError(result.error.message || 'Something went wrong. Please try again.')
            } else {
                setSent(true)
            }
        } catch (err: unknown) {
            setError((err as Error)?.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50/70 via-background to-indigo-50/60 p-5 dark:from-slate-950 dark:via-background dark:to-indigo-950/40">
            {/* Background decorations */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl dark:bg-orange-500/10" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/15" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 text-center">
                    <Link href="/" className="group inline-flex items-center gap-2.5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-indigo-500 to-blue-600 shadow-lg ring-1 ring-white/20 transition-shadow duration-300 group-hover:shadow-xl">
                            <GraduationCap className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold dc-gradient-text">Digi Classroom</span>
                    </Link>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border/70 bg-card/90 p-8 shadow-elev-3 backdrop-blur-xl">
                    {sent ? (
                        /* Success state */
                        <div className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                                <CheckCircle className="h-8 w-8 text-emerald-500" />
                            </div>
                            <h1 className="mb-2 text-2xl font-bold text-foreground">Check your email</h1>
                            <p className="mb-6 text-muted-foreground">
                                If an account exists for <strong className="text-foreground">{email}</strong>,
                                we&apos;ve sent a password reset link. Please check your inbox and spam folder.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => { setSent(false); setEmail(''); }}
                                    className="w-full rounded-xl bg-secondary py-3 font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
                                >
                                    Try a different email
                                </button>
                                <Link
                                    href="/sign-in"
                                    className="block w-full py-3 text-center font-semibold text-primary transition-colors hover:underline"
                                >
                                    Back to sign in
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* Form state */
                        <>
                            <div className="mb-6 text-center">
                                <h1 className="text-2xl font-bold text-foreground">Forgot password?</h1>
                                <p className="mt-1 text-muted-foreground">
                                    No worries! Enter your email and we&apos;ll send you a reset link.
                                </p>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                                    <p className="text-sm font-medium text-destructive">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            required
                                            autoFocus
                                            className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-foreground shadow-elev-1 outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/35"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-dc-grad-br bg-[length:200%_200%] py-3 font-semibold text-white shadow-glow-brand transition-all duration-200 hover:shadow-elev-3 hover:[background-position:100%_50%] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </button>
                            </form>

                            <Link
                                href="/sign-in"
                                className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to sign in
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
