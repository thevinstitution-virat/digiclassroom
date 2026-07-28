'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
        // Only initialize PostHog if a valid key is provided
        if (posthogKey && posthogKey.trim().length > 0) {
            posthog.init(posthogKey, {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
                loaded: (posthog) => {
                    if (process.env.NODE_ENV === 'development') posthog.debug(false)
                }
            })
        }
    }, [])

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
