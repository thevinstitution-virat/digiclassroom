'use client'

import React, { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPassword } from '@/auth/client'
import { Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, Circle } from 'lucide-react'
// App-local single-card auth shell (see AuthShell).
import { AuthShell } from '@/components/auth/AuthShell'

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
        { label: 'Contains an uppercase letter', met: /[A-Z]/.test(password) },
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
            <AuthShell title="Invalid reset link">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--kumkum-rgb)/0.14)]">
                        <AlertCircle className="h-8 w-8 text-[color:var(--kumkum)]" />
                    </div>
                    <p className="mb-6 leading-relaxed text-muted-foreground">
                        This password reset link is invalid or has expired. Please request a new one.
                    </p>
                    <Link
                        href="/forgot-password"
                        className="inline-block w-full rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 text-center font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5"
                    >
                        Request new reset link
                    </Link>
                </div>
            </AuthShell>
        )
    }

    if (success) {
        return (
            <AuthShell title="Password reset!">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(14_159_110_/_0.14)]">
                        <CheckCircle2 className="h-8 w-8 text-[color:var(--emerald,#0E9F6E)]" />
                    </div>
                    <p className="mb-6 leading-relaxed text-muted-foreground">
                        Your password has been reset successfully. You can now sign in with your new password.
                    </p>
                    <Link
                        href="/sign-in"
                        className="inline-block w-full rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 text-center font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5"
                    >
                        Sign in now
                    </Link>
                </div>
            </AuthShell>
        )
    }

    return (
        <AuthShell title="Reset password" subtitle="Choose a new password">
            {error && (
                <div className="mb-4 flex items-start gap-2 rounded-[14px] border border-destructive/30 bg-destructive/10 p-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label htmlFor="password" className="mb-1.5 block text-[13.5px] font-bold text-foreground">
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
                    {/* Live requirement checklist — always visible, per the mock */}
                    <div className="mt-2.5 flex flex-col gap-1.5">
                        {passwordRequirements.map((req, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-2 text-[12.5px] ${req.met ? 'text-[color:var(--emerald,#0E9F6E)]' : 'text-muted-foreground'}`}
                            >
                                {req.met ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                {req.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="mb-1.5 block text-[13.5px] font-bold text-foreground">
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
                            className="w-full rounded-[14px] border border-input bg-card py-3 pl-11 pr-4 text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/25"
                        />
                    </div>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                        <p className="mt-1 text-xs text-[color:var(--kumkum)]">Passwords do not match</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--kumkum),var(--saffron))] py-3 font-bold text-white shadow-[0_14px_30px_-14px_rgba(192,57,43,0.65)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
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
        </AuthShell>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            }
        >
            <ResetPasswordForm />
        </Suspense>
    )
}
