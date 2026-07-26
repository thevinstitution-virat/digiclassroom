/**
 * tRPC API Route Handler for VG Kosh
 * Handles all tRPC requests
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type NextRequest } from 'next/server'
import { appRouter } from '@/lib/trpc/routers'
import { createTRPCContext } from '@/lib/trpc/server'

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async (opts) => {
      return await createTRPCContext(opts)
    },
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
          )
        }
        : undefined,
  })

export { handler as GET, handler as POST }
