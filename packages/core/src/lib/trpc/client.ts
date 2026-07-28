import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink, loggerLink } from '@trpc/client'
import { createTRPCNext } from '@trpc/next'
import superjson from 'superjson'
import type { AppRouter } from '@/lib/trpc/routers'

const getBaseUrl = () => {
  // Same-origin: /api/trpc is proxied to the API service by the web app's
  // next.config rewrite, so cookies flow without CORS.
  if (typeof window !== 'undefined') return '' // browser -> relative
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3001}` // SSR -> web origin
}

// Create tRPC React hooks
export const api = createTRPCReact<AppRouter>()

// Create tRPC Next.js client
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          // Send auth cookies to the API on a different subdomain.
          fetch(url, options) {
            return fetch(url, { ...options, credentials: 'include' })
          },
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
            gcTime: 10 * 60 * 1000, // 10 minutes
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
  transformer: superjson,
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


// Type exports for use in components
export type { AppRouter } from '@/lib/trpc/routers'
