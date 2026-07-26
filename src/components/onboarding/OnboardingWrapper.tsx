'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import { OnboardingFormData } from '@/types/user-management'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

export default function OnboardingWrapper({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useBetterAuthUser()
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        if (isLoaded && user) {
            checkProfile()
        } else if (isLoaded && !user) {
            setLoading(false)
        }
    }, [isLoaded, user, pathname])

    const checkProfile = async () => {
        try {
            const res = await fetch('/api/user/profile')
            const result = await res.json()

            // If onboarding is not complete, show the modal
            if (!result.data || result.data?.onboardingComplete === false) {
                setShowModal(true)
            } else {
                setShowModal(false)
            }
        } catch (e) {
            console.error('Failed to grab user profile:', e)
        } finally {
            setLoading(false)
        }
    }

    const handleOnboardingComplete = async (data: OnboardingFormData) => {
        try {
            setLoading(true)
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    role: data.role,
                    board: data.board,
                    medium: data.medium,
                    class: data.class,
                    stream: data.stream,
                })
            })
            const result = await res.json()
            if (result.success) {
                // B2B2C: if the student chose an institution, submit a join request
                // (admin-approved). null = independent (B2C) — nothing to do.
                if (data.institutionId) {
                    try {
                        await fetch('/api/institutions/join-request', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                institutionId: data.institutionId,
                                requestedClass: data.class,
                                requestedBoard: data.board,
                            }),
                        })
                    } catch (joinErr) {
                        console.error('Join request failed (non-blocking):', joinErr)
                    }
                }
                setShowModal(false)
                // Refresh the page so children components fetch properly
                // initialized profile data (like materials page)
                window.location.reload()
            } else {
                console.error('Onboarding failed:', result.error)
                setLoading(false)
            }
        } catch (e) {
            console.error('Error during onboarding submission:', e)
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500 font-medium">Checking profile details...</p>
                </div>
            </div>
        )
    }

    return (
        <>
            <OnboardingModal
                isOpen={showModal}
                onComplete={handleOnboardingComplete}
            // No onSkip prop passed means they cannot exit out of this modal
            />
            {/* If showModal is true, the user shouldn't be able to interact with children, 
          so we can conditionally blur or just overlay it. The Dialog component in OnboardingModal
          automatically overlays and locks scroll. */}
            {children}
        </>
    )
}
