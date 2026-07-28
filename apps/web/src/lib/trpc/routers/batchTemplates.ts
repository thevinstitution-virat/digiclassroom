import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../server';
import { db } from '@/db';
import { batchTemplates, taxonomyLevels, taxonomyCourses, taxonomyDomains } from '@/db/schema';

function requireSuperAdmin(role: string): void {
  if (role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super Admin access required.' });
  }
}

export const batchTemplatesRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    requireSuperAdmin(ctx.userRole);
    return db
      .select({
        id: batchTemplates.id,
        name: batchTemplates.name,
        description: batchTemplates.description,
        levelId: batchTemplates.levelId,
        createdAt: batchTemplates.createdAt,
        levelName: taxonomyLevels.name,
        courseName: taxonomyCourses.name,
        domainName: taxonomyDomains.name,
      })
      .from(batchTemplates)
      .innerJoin(taxonomyLevels, eq(taxonomyLevels.id, batchTemplates.levelId))
      .innerJoin(taxonomyCourses, eq(taxonomyCourses.id, taxonomyLevels.courseId))
      .innerJoin(taxonomyDomains, eq(taxonomyDomains.id, taxonomyCourses.domainId));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(500).optional().nullable(),
      levelId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.userRole);
      
      // Enforce unique name per level manually for better error message
      const [existing] = await db.select({ id: batchTemplates.id })
        .from(batchTemplates)
        .where(and(eq(batchTemplates.name, input.name), eq(batchTemplates.levelId, input.levelId)))
        .limit(1);
        
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A template with this name already exists for this level.' });
      }

      await db.insert(batchTemplates).values({
        name: input.name,
        description: input.description,
        levelId: input.levelId,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.userRole);
      await db.delete(batchTemplates).where(eq(batchTemplates.id, input.id));
      return { success: true };
    }),
});
