import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../server'
import { db } from '@/db'
import { institutionProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { TRPCError } from '@trpc/server'

export const completeOnboardingSchema = z.object({
  logoUrl: z.string().url().min(1),
  bannerUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional().or(z.literal('')),
  address: z.string().min(5),
  website: z.string().url().optional().or(z.literal('')),
})

export const institutionProfilesRouter = createTRPCRouter({
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const orgCtx = await getOrgContext()
      
      const profile = await db.query.institutionProfiles.findFirst({
        where: eq(institutionProfiles.organizationId, orgCtx.orgId),
      })

      return profile ?? null
    }),

  completeOnboarding: protectedProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContext()
      
      if (orgCtx.orgRole !== 'owner' && orgCtx.orgRole !== 'org_admin' && orgCtx.globalRole !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only institution administrators can complete onboarding.' })
      }

      await db.update(institutionProfiles)
        .set({
          logoUrl: input.logoUrl,
          bannerUrl: input.bannerUrl || null,
          primaryColor: input.primaryColor,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone || null,
          address: input.address,
          website: input.website || null,
          onboardingCompleted: true,
        })
        .where(eq(institutionProfiles.organizationId, orgCtx.orgId))

      return { success: true }
    }),

  superAdminCompleteOnboarding: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      contactPhone: z.string().min(1),
      address: z.string().optional(),
      website: z.string().optional(),
      establishedYear: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.userRole !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only Super Admins can use this.' })
      }

      await db.insert(institutionProfiles)
        .values({
          id: crypto.randomUUID(),
          organizationId: input.orgId,
          contactPhone: input.contactPhone,
          address: input.address || null,
          website: input.website || null,
          establishedYear: input.establishedYear || null,
          onboardingCompleted: true,
        })
        .onDuplicateKeyUpdate({
          set: {
            contactPhone: input.contactPhone,
            address: input.address || null,
            website: input.website || null,
            establishedYear: input.establishedYear || null,
            onboardingCompleted: true,
          }
        })

      return { success: true }
    }),
})
