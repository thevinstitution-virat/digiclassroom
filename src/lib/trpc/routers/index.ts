/**
 * Main tRPC Router for VG Kosh
 * Combines all feature routers
 */

import { createTRPCRouter } from '../server'
import { dictionaryRouter } from './dictionary'
import { contentRouter } from './content'

import { sarvagyaRouter } from './sarvagya'

/**
 * This is the primary router for your server.
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  dictionary: dictionaryRouter,
  content: contentRouter,
  sarvagya: sarvagyaRouter,
})

// Export type definition of API
export type AppRouter = typeof appRouter
