/**
 * Main tRPC Router for VG Kosh
 * Combines all feature routers
 */

import { createTRPCRouter } from '../server'
import { dictionaryRouter } from './dictionary'
import { contentRouter } from './content'

import { sarvagyaRouter } from './sarvagya'
import { tenantFeaturesRouter } from './tenantFeatures'
import { taxonomyRouter } from './taxonomy'
import { noticesRouter } from './notices'
import { homeworkRouter } from './homework'
import { attendanceRouter } from './attendance'
import { videoAssetsRouter } from './videoAssets'
import { zoomCredentialsRouter } from './zoomCredentials'
import { liveClassesRouter } from './liveClasses'
import { batchesRouter } from './batches'
import { videoProgressRouter } from './videoProgress'
import { videoChaptersRouter } from './videoChapters'
import { institutionProfilesRouter } from './institutionProfiles'
import { enrollmentsRouter } from './enrollments'
import { studentRouter } from './student'
import { institutionAdminRouter } from './institutionAdmin'
import { batchTemplatesRouter } from './batchTemplates'
import { superAdminAnalyticsRouter } from './superAdminAnalytics'
import { superAdminRouter } from './superAdmin'

/**
 * This is the primary router for your server.
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  dictionary: dictionaryRouter,
  content: contentRouter,
  sarvagya: sarvagyaRouter,
  tenantFeatures: tenantFeaturesRouter,
  zoomCredentials: zoomCredentialsRouter,
  liveClasses: liveClassesRouter,
  notices: noticesRouter,
  homework: homeworkRouter,
  attendance: attendanceRouter,
  videoAssets: videoAssetsRouter,
  batches: batchesRouter,
  videoProgress: videoProgressRouter,
  videoChapters: videoChaptersRouter,
  institutionProfiles: institutionProfilesRouter,
  taxonomy: taxonomyRouter,
  enrollments: enrollmentsRouter,
  student: studentRouter,
  institutionAdmin: institutionAdminRouter,
  batchTemplates: batchTemplatesRouter,
  superAdminAnalytics: superAdminAnalyticsRouter,
  superAdmin: superAdminRouter,
})

// Export type definition of API
export type AppRouter = typeof appRouter
