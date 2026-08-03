'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPassword } from '@/auth/client'
import { Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
// Shared Indic motifs, vendored from PDLMS — same lotus backdrop and card
// treatment as sign-in/sign-up/forgot-password, so the whole auth corridor
// feels continuous.
import { AuthBackdrop, authCardClassName } from '@/design/indic/motifs/auth-backdrop'
import { MandalaMark } from '@/design/indic/motifs/mandala-mark'

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token') || ''

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const passwordRequirements = [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'Contains a number', met: /\d/.test(password) },
        { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (!token) {
            setError('Invalid or missing reset token. Please request a new reset link.')
            return
        }

        setLoading(true)

        try {
            const result = await resetPassword({
                newPassword: password,
                token,
            })

            if (result.error) {
                setError(result.error.message || 'Failed to reset password. The link may have expired.')
            } else {
                setSuccess(true)
                setTimeout(() => router.push('/sign-in'), 3000)
            }
        } catch (err: unknown) {
            setError((err as Error)?.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!token) {
        return (
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/15">
                    <AlertCircle className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="mb-2 text-2xl text-foreground">Invalid reset link</h1>
                <p className="mb-6 text-muted-foreground">
                    This password reset link is invalid or has expired. Please request a new one.
                </p>
                <Link
                    href="/forgot-password"
                    className="inline-block w-full rounded-xl bg-dc-grad-br py-3 text-center font-semibold text-white shadow-glow-brand transition-all duration-300 hover:shadow-elev-3"
                >
                    Request new reset link
                </Link>
            </div>
        )
    }

    if (success) {
        return (
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <h1 className="mb-2 text-2xl text-foreground">Password reset!</h1>
                <p className="mb-6 text-muted-foreground">
                    Your password has been successfully reset. Redirecting you to sign in...
                </p>
                <Link
                    href="/sign-in"
                    className="inline-block w-full rounded-xl bg-dc-grad-br py-3 text-center font-semibold text-white shadow-glow-brand transition-all duration-300 hover:shadow-elev-3"
                >
                    Sign in now
                </Link>
            </div>
        )
    }

    return (
        <>
            <div className="mb-6 text-center">
                <h1 className="text-2xl text-foreground">Reset password</h1>
                <p className="mt-1 text-muted-foreground">Enter your new password below</p>
            </div>

            {error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">
                        New Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter new password"
                            required
                            autoFocus
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
                    {password.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {passwordRequirements.map((req, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                    <CheckCircle className={`h-3.5 w-3.5 ${req.met ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                                    <span className={req.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>{req.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-foreground">
                        Confirm New Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            id="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            required
                            className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-foreground shadow-elev-1 outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/35"
                        />
                    </div>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                        <p className="mt-1 text-xs text-rose-500">Passwords do not match</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-dc-grad-br bg-[length:200%_200%] py-3 font-semibold text-white shadow-glow-brand transition-all duration-200 hover:shadow-elev-3 hover:[background-position:100%_50%] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Resetting...
                        </>
                    ) : (
                        'Reset Password'
                    )}
                </button>
            </form>
        </>
    )
}

export default function ResetPasswordPage() {
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

                <Suspense fallback={
                    <div className="py-8 text-center">
                        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                }>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </AuthBackdrop>
    )
}
