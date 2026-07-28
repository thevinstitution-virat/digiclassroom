import { z } from 'zod';
import { createTRPCRouter, superAdminProcedure } from '../server';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const superAdminRouter = createTRPCRouter({
  updateOrganizationPlan: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        subscriptionPlan: z.enum(schema.subscriptionPlanEnums),
        subscriptionStatus: z.enum(schema.subscriptionStatusEnums),
        platformFeeRate: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ input }) => {
      const { orgId, subscriptionPlan, subscriptionStatus, platformFeeRate } = input;
      
      await db
        .update(schema.organization)
        .set({
          subscriptionPlan,
          subscriptionStatus,
          platformFeeRate: platformFeeRate.toFixed(4),
        })
        .where(eq(schema.organization.id, orgId));

      return { success: true };
    }),

  getSystemSettings: superAdminProcedure.query(async () => {
    let [config] = await db.select().from(schema.appConfig).limit(1);
    if (!config) {
      await db.insert(schema.appConfig).values({ id: 1 });
      [config] = await db.select().from(schema.appConfig).limit(1);
    }
    return config;
  }),

  updateSystemSettings: superAdminProcedure
    .input(
      z.object({
        maintenanceMode: z.boolean().optional(),
        debugMode: z.boolean().optional(),
        sessionTimeoutMinutes: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.update(schema.appConfig).set(input).where(eq(schema.appConfig.id, 1));
      return { success: true };
    }),
});
