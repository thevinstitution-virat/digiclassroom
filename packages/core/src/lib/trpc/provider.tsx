'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpLink } from '@trpc/client'
import { api } from './client'
import superjson from 'superjson'

function getBaseUrl() {
  // Same-origin: /api/trpc is proxied to the API service by the web rewrite.
  if (typeof window !== 'undefined')
    return ''
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3001}`
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
                return false
              }
              return failureCount < 3
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      })
  )

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          // Send auth cookies to the API on a different subdomain.
          fetch(url, options) {
            return fetch(url, { ...options, credentials: 'include' })
          },
          headers() {
            return {}
          },
        }),
      ],
    })
  )

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </api.Provider>
  )
}
