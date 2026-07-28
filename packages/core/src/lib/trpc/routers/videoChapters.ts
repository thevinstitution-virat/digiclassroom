import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, teacherProcedure } from '../server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const videoChaptersRouter = createTRPCRouter({
  // Get chapters for a video (Public/Protected read)
  getByVideo: protectedProcedure
    .input(z.object({
      videoAssetId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      return db
        .select()
        .from(schema.videoChapters)
        .where(
          and(
            eq(schema.videoChapters.tenantId, ctx.tenantId),
            eq(schema.videoChapters.videoAssetId, input.videoAssetId)
          )
        )
        .orderBy(schema.videoChapters.sortOrder, schema.videoChapters.startSeconds);
    }),

  // Save all chapters for a video (Full replace)
  saveChapters: teacherProcedure
    .input(z.object({
      videoAssetId: z.string(),
      chapters: z.array(z.object({
        title: z.string().min(1).max(255),
        startSeconds: z.number().min(0),
        sortOrder: z.number().default(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Verify the video belongs to this tenant (or global 'system')
      const video = await db.query.videoAssets.findFirst({
        where: eq(schema.videoAssets.id, input.videoAssetId),
      });

      if (!video) throw new TRPCError({ code: 'NOT_FOUND', message: 'Video not found' });
      
      // Strict isolation check: can only edit chapters for your own tenant's videos
      // unless you are super_admin operating in global mode (which is handled upstream by context,
      // but let's be explicit)
      if (video.tenantId !== ctx.tenantId && video.tenantId !== 'system') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      await db.transaction(async (tx) => {
        // 1. Delete existing chapters for this video (scoping to tenantId for safety)
        await tx.delete(schema.videoChapters).where(
          and(
            eq(schema.videoChapters.videoAssetId, input.videoAssetId),
            eq(schema.videoChapters.tenantId, ctx.tenantId)
          )
        );

        // 2. Insert new chapters if any
        if (input.chapters.length > 0) {
          await tx.insert(schema.videoChapters).values(
            input.chapters.map(c => ({
              videoAssetId: input.videoAssetId,
              tenantId: ctx.tenantId,
              title: c.title,
              startSeconds: c.startSeconds,
              sortOrder: c.sortOrder,
            }))
          );
        }
      });

      return { success: true };
    }),
});
