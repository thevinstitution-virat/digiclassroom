import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const videoProgressRouter = createTRPCRouter({
  // 1. Upsert progress — called by the video player as the student watches
  // Uses ON DUPLICATE KEY UPDATE so only the highest progress is retained.
  // Requires UNIQUE(user_id, video_id) on student_video_progress.
  upsert: protectedProcedure
    .input(z.object({
      videoId: z.string(),
      watchedSeconds: z.number().min(0),
      completionPercentage: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });

      await db.insert(schema.studentVideoProgress).values({
        userId: ctx.userId!,
        videoId: input.videoId,
        tenantId: ctx.tenantId,
        maxWatchedSeconds: input.watchedSeconds,
        completionPercentage: input.completionPercentage.toFixed(2),
        lastWatchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.studentVideoProgress.userId, schema.studentVideoProgress.videoId],
        set: {
          // Only update if new value is greater (prevent rewind from wiping progress)
          maxWatchedSeconds: sql`GREATEST(max_watched_seconds, ${input.watchedSeconds})`,
          completionPercentage: sql`GREATEST(completion_percentage, ${input.completionPercentage.toFixed(2)})`,
          lastWatchedAt: new Date(),
        }
      });

      return { success: true };
    }),

  // 2. Get progress for all videos in a batch's taxonomy scope
  getForBatch: protectedProcedure
    .input(z.object({
      domain: z.string(),
      course: z.string(),
      level: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });

      return db
        .select({
          videoId: schema.studentVideoProgress.videoId,
          maxWatchedSeconds: schema.studentVideoProgress.maxWatchedSeconds,
          completionPercentage: schema.studentVideoProgress.completionPercentage,
          lastWatchedAt: schema.studentVideoProgress.lastWatchedAt,
        })
        .from(schema.studentVideoProgress)
        .innerJoin(schema.videoAssets, eq(schema.studentVideoProgress.videoId, schema.videoAssets.id))
        .where(
          and(
            eq(schema.studentVideoProgress.userId, ctx.userId!),
            eq(schema.studentVideoProgress.tenantId, ctx.tenantId),
            eq(schema.videoAssets.domain, input.domain),
            eq(schema.videoAssets.course, input.course),
            eq(schema.videoAssets.level, input.level),
          )
        );
    }),
})
