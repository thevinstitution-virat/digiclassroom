'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { forgetPassword } from '@/auth/client'
import { Mail, AlertCircle, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
// Shared Indic motifs, vendored from PDLMS — same lotus backdrop and card
// treatment as sign-in/sign-up, so the whole auth corridor feels continuous.
import { AuthBackdrop, authCardClassName } from '@/design/indic/motifs/auth-backdrop'
import { MandalaMark } from '@/design/indic/motifs/mandala-mark'

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
        <AuthBackdrop>
            <div className={`relative w-full max-w-md ${authCardClassName} p-6 sm:p-8`}>
                {/* Logo */}
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-flex flex-col items-center gap-3">
                        <MandalaMark size={64} />
                        <span className="text-lg font-bold tracking-tight text-foreground">Digi Classroom</span>
                    </Link>
                </div>

                {sent ? (
                    /* Success state */
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h1 className="mb-2 text-2xl text-foreground">Check your email</h1>
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
                            <h1 className="text-2xl text-foreground">Forgot password?</h1>
                            <p className="mt-1 text-muted-foreground">
                                No worries! Enter your email and we&apos;ll send you a reset link.
                            </p>
                        </div>

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
        </AuthBackdrop>
    )
}
