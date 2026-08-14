'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/auth/client'
import { Mail, AlertCircle, Loader2, MailCheck, ArrowLeft } from 'lucide-react'
// App-local single-card auth shell (see AuthShell).
import { AuthShell } from '@/components/auth/AuthShell'

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
            const result = await requestPasswordReset({
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
        <AuthShell
            title={sent ? 'Check your email' : 'Forgot password?'}
            subtitle={sent ? undefined : 'We’ll email you a reset link'}
        >
            {sent ? (
                /* Success state */
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(14_159_110_/_0.14)]">
                        <MailCheck className="h-8 w-8 text-[color:var(--emerald,#0E9F6E)]" />
                    </div>
                    <p className="mb-6 leading-relaxed text-muted-foreground">
                        If an account exists for <strong className="text-foreground">{email}</strong>,
                        we&apos;ve sent a password reset link. Check your inbox and spam folder.
                    </p>
                    <div className="space-y-2.5">
                        <button
                            onClick={() => { setSent(false); setEmail(''); }}
                            className="w-full rounded-[14px] border border-border bg-card py-3 font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
                        >
                            Try a different email
                        </button>
                        <Link
                            href="/sign-in"
                            className="block w-full py-2 text-center font-bold text-primary transition-colors hover:underline"
                        >
                            Back to sign in
                        </Link>
                    </div>
                </div>
            ) : (
                /* Form state */
                <>
                    {error && (
                        <div className="mb-4 flex items-start gap-2 rounded-[14px] border border-destructive/30 bg-destructive/10 p-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                            <p className="text-sm font-medium text-destructive">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="email" className="mb-1.5 block text-[13.5px] font-bold text-foreground">
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
                                    className="w-full rounded-[14px] border border-input bg-card py-3 pl-11 pr-4 text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                    </Link>
                </>
            )}
        </AuthShell>
    )
}
