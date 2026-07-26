'use client'

import { authClient } from '@/auth/client'

/**
 * Drop-in replacement for Clerk's useUser() hook.
 * Uses Better Auth's useSession() under the hood.
 *
 * Usage:
 *   const { user, userId, isLoaded, isSignedIn, role } = useBetterAuthUser()
 */
export function useBetterAuthUser() {
    const { data: session, isPending, error } = authClient.useSession()

    return {
        user: session?.user ?? null,
        userId: session?.user?.id ?? null,
        isLoaded: !isPending,
        isSignedIn: !!session?.user,
        role: (session?.user as any)?.role ?? null,
        session: session?.session ?? null,
        error,
    }
}
