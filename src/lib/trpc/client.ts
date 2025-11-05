import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink, loggerLink } from '@trpc/client'
import { createTRPCNext } from '@trpc/next'
import superjson from 'superjson'
import type { AppRouter } from '@/lib/trpc/routers'

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '' // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}` // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}` // dev SSR should use localhost
}

// Create tRPC React hooks
export const api = createTRPCReact<AppRouter>()

// Create tRPC Next.js client
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          headers() {
            return {
              // Add any custom headers here
            }
          },
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
                return false
              }
              // Retry up to 3 times for other errors
              return failureCount < 3
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      },
    }
  },
  ssr: false, // We'll handle SSR manually where needed
})

// Utility function to invalidate queries
export const invalidateQueries = (queryClient: any, filters?: any) => {
  return queryClient.invalidateQueries(filters)
}

// Utility function to prefetch queries
export const prefetchQuery = async (queryClient: any, input: any) => {
  return queryClient.prefetchQuery(input)
}

// Error handling utilities for client-side
export const handleTRPCClientError = (error: any) => {
  console.error('tRPC Client Error:', error)

  // Handle specific error types
  if (error?.data?.code === 'UNAUTHORIZED') {
    // Redirect to login or show auth modal
    window.location.href = '/sign-in'
    return
  }

  if (error?.data?.code === 'FORBIDDEN') {
    // Show permission denied message
    console.error('Permission denied:', error.message)
    return
  }

  if (error?.data?.code === 'TOO_MANY_REQUESTS') {
    // Show rate limit message
    console.error('Rate limit exceeded:', error.message)
    return
  }

  // Generic error handling
  console.error('An unexpected error occurred:', error.message)
}

// Custom hooks for common operations
export const useInvalidateQuery = () => {
  const utils = api.useUtils()
  
  return {
    invalidateAll: () => utils.invalidate(),
    invalidateContent: () => utils.content.invalidate(),
    invalidateClasses: () => utils.classes.invalidate(),
    invalidateUsers: () => utils.users.invalidate(),
  }
}

// Optimistic update utilities
export const useOptimisticUpdate = () => {
  const utils = api.useUtils()

  return {
    updateUserProgress: (userId: string, contentId: string, progress: number) => {
      utils.progress.getUserProgress.setData({ userId, contentId }, (old) => {
        if (!old) return old
        return { ...old, progress }
      })
    },
  }
}

// Type exports for use in components
export type { AppRouter } from '@/lib/trpc/routers'
