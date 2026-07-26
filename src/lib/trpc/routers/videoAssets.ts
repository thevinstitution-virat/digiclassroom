import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, superAdminProcedure } from '../server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, or, isNull, gt, sql, desc } from 'drizzle-orm'
import crypto, { createHash } from 'crypto'
import { TRPCError } from '@trpc/server'
import { parseYouTubeVideoId } from '@/lib/utils/youtube'

// ── Guard functions ────────────────────────────────────────────────────────
function requireIA(role: string): void {
  if (role !== 'org_admin' && role !== 'owner')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Institution Admin access required.' });
}

function requireSA(role: string): void {
  if (role !== 'super_admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super Admin access required.' });
}

// ── Shared Bunny helpers ───────────────────────────────────────────────────
async function createBunnyVideoPlaceholder(title: string) {
  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const apiKey    = process.env.BUNNY_LIBRARY_API_KEY;
  if (!libraryId || !apiKey)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Bunny CDN credentials not configured.' });

  const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    console.error('Bunny Create Video Error:', await response.text());
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create video placeholder in CDN.' });
  }

  const data = await response.json();
  return { providerVideoId: data.guid as string, libraryId, apiKey };
}

function generateTusCredentials(libraryId: string, apiKey: string, providerVideoId: string) {
  const expirationTime   = Math.floor(Date.now() / 1000) + 3600;
  const signatureString  = `${libraryId}${apiKey}${expirationTime}${providerVideoId}`;
  const signature        = createHash('sha256').update(signatureString).digest('hex');
  return { signature, expirationTime, libraryId, providerVideoId };
}

// ── Shared Zod schemas ─────────────────────────────────────────────────────
const videoUploadBaseInput = {
  title:         z.string().min(1),
  description:   z.string().optional(),
  domainId:      z.string().uuid(),
  courseId:      z.string().uuid(),
  levelId:       z.string().uuid(),
  subjectId:     z.string().uuid(),
  bookTag:       z.string().max(255).optional().nullable(),
  isFreePreview: z.boolean().optional().default(false),
};

const youtubeBaseInput = {
  ...videoUploadBaseInput,
  youtubeUrl: z.string().url(),
  sortOrder:  z.number().int().default(0),
};

/**
 * SECURITY NOTE: YouTube Unlisted vs Bunny DRM
 *
 * YouTube unlisted provides convenience-grade access control, not
 * security-grade. The signed URL that Bunny generates expires and is
 * cryptographically bound to the viewer. YouTube's embed URL does not
 * expire and can be shared outside the app.
 *
 * Use Bunny for content requiring strict access control; use YouTube for
 * supplementary or low-sensitivity material. This is a deliberate product
 * trade-off, not a bug.
 */

export const videoAssetsRouter = createTRPCRouter({
  initiateUpload: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireIA(ctx.userRole);

      const { providerVideoId, libraryId, apiKey } = await createBunnyVideoPlaceholder(input.title);
      return generateTusCredentials(libraryId, apiKey, providerVideoId);
    }),

  // 2. Mark upload as finished
  markUploaded: protectedProcedure
    .input(z.object({ providerVideoId: z.string(), ...videoUploadBaseInput }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId && ctx.userRole !== 'super_admin') {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' })
      }

      await db.insert(schema.videoAssets).values({
        id:            crypto.randomUUID(),
        tenantId:      ctx.tenantId!,
        domain:        input.domainId,
        course:        input.courseId,
        level:         input.levelId,
        levelId:       input.levelId,
        subject:       input.subjectId,
        book:          '',
        subjectId:     input.subjectId,
        bookTag:       input.bookTag ?? null,
        title:         input.title,
        description:   input.description,
        isFreePreview: input.isFreePreview,
        provider:      'bunny',
        providerVideoId: input.providerVideoId,
        status:        'processing',
        createdBy:     ctx.userId!,
      });

      return { success: true }
    }),

  // 3. Get video embed data — dual provider (Bunny HLS + YouTube) with chapters
  //    Replaces the old getSignedPlaybackUrl (iframe-only, no chapters).
  getVideoEmbed: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' })

      // 1. Fetch video — must belong to caller's tenant and be ready
      const [asset] = await db.select()
        .from(schema.videoAssets)
        .where(and(
          eq(schema.videoAssets.id, input.videoId),
          eq(schema.videoAssets.tenantId, ctx.tenantId),
          eq(schema.videoAssets.status, 'ready')
        ))
        .limit(1);

      if (!asset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Video not found or not ready' })
      }

      // 2. Enrollment check (same logic as old getSignedPlaybackUrl)
      if (!asset.isFreePreview && ctx.userRole !== 'super_admin') {
         const enrollmentRows = await db.select({ id: schema.enrollments.id })
             .from(schema.enrollments)
             .innerJoin(schema.batches, eq(schema.batches.id, schema.enrollments.batchId))
             .where(
                 and(
                     eq(schema.enrollments.userId, ctx.userId!),
                     eq(schema.enrollments.orgId, ctx.tenantId!),
                     eq(schema.enrollments.status, 'active'),
                     eq(schema.batches.levelId, asset.level || '')
                 )
             )
             .limit(1);

         if (enrollmentRows.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No active enrollment for this content' });
         }
      }

      // 3. Fetch chapters (always returned regardless of provider)
      const chapters = await db.select()
        .from(schema.videoChapters)
        .where(eq(schema.videoChapters.videoAssetId, asset.id))
        .orderBy(schema.videoChapters.sortOrder, schema.videoChapters.startSeconds);

      // 4. Return provider-specific embed data
      if (asset.provider === 'bunny') {
        const securityKey = process.env.BUNNY_STREAM_SECURITY_KEY
        const cdnHostname = process.env.BUNNY_CDN_HOSTNAME

        if (!securityKey || !cdnHostname) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Bunny Stream security key or CDN hostname missing' })
        }

        // Approach A: hex digest, input = securityKey + videoId + expiry
        // Matches the existing working embed signing. If Bunny's CDN Pull Zone
        // uses a different scheme, update this after Step 0 verification.
        const expiry = Math.floor(Date.now() / 1000) + 7200; // 2-hour window
        const dataToSign = securityKey + asset.providerVideoId + expiry;
        const token = crypto.createHash('sha256').update(dataToSign).digest('hex');
        const hlsUrl = `https://${cdnHostname}/${asset.providerVideoId}/playlist.m3u8?token=${token}&expires=${expiry}`;

        return {
          provider: 'bunny' as const,
          hlsUrl,
          title: asset.title,
          durationSeconds: asset.durationSeconds,
          thumbnailUrl: asset.thumbnailUrl,
          chapters,
        };
      }

      if (asset.provider === 'youtube') {
        return {
          provider: 'youtube' as const,
          youtubeVideoId: asset.providerVideoId,
          title: asset.title,
          durationSeconds: asset.durationSeconds,
          thumbnailUrl: asset.thumbnailUrl,
          chapters,
        };
      }

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Unknown provider: ${asset.provider}` });
    }),

  addYouTubeVideo: protectedProcedure
    .input(z.object(youtubeBaseInput))
    .mutation(async ({ ctx, input }) => {
      requireIA(ctx.userRole);

      const videoId = parseYouTubeVideoId(input.youtubeUrl); // preserve existing helper
      if (!videoId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not extract video ID from YouTube URL.' });

      await db.insert(schema.videoAssets).values({
        id:             crypto.randomUUID(),
        tenantId:       ctx.tenantId!,
        domain:         input.domainId,
        course:         input.courseId,
        level:          input.levelId,
        levelId:        input.levelId,
        subject:        input.subjectId,
        book:           '',
        subjectId:      input.subjectId,
        bookTag:        input.bookTag ?? null,
        title:          input.title,
        description:    input.description,
        provider:       'youtube',
        providerVideoId: videoId,
        durationSeconds: 0,
        thumbnailUrl:   `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        status:         'ready',
        sortOrder:      input.sortOrder,
        isFreePreview:  input.isFreePreview,
        createdBy:      ctx.userId!,
      });

      return { success: true as const };
    }),

  // 3c. Update video duration — called client-side after YouTube player reports duration
  updateDuration: protectedProcedure
    .input(z.object({
      videoId: z.string(),
      durationSeconds: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only update if durationSeconds is currently null (don't overwrite Bunny's webhook value)
      await db.update(schema.videoAssets)
        .set({ durationSeconds: input.durationSeconds })
        .where(
          and(
            eq(schema.videoAssets.id, input.videoId),
            eq(schema.videoAssets.tenantId, ctx.tenantId),
            isNull(schema.videoAssets.durationSeconds)
          )
        );
      return { success: true };
    }),

  // 5. Update video progress
  updateProgress: protectedProcedure
    .input(z.object({
        videoId: z.string(),
        watchedSeconds: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
       if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
       if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No active organization' });
       
       const [progress] = await db.select().from(schema.studentVideoProgress).where(and(
           eq(schema.studentVideoProgress.userId, ctx.userId!),
           eq(schema.studentVideoProgress.videoId, input.videoId)
       )).limit(1);
       
       if (progress) {
           if (input.watchedSeconds > (progress.maxWatchedSeconds ?? 0)) {
               await db.update(schema.studentVideoProgress)
                 .set({ maxWatchedSeconds: input.watchedSeconds, lastWatchedAt: new Date() })
                 .where(eq(schema.studentVideoProgress.id, progress.id));
           }
       } else {
           await db.insert(schema.studentVideoProgress).values({
               tenantId: ctx.tenantId!,
               userId: ctx.userId!,
               videoId: input.videoId,
               maxWatchedSeconds: input.watchedSeconds,
               lastWatchedAt: new Date()
           });
       }
       return { success: true };
    }),



  sa: createTRPCRouter({
    initiateUpload: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        targetTenantId: z.string().nullable(), // null = global platform content
      }))
      .mutation(async ({ ctx, input }) => {
        requireSA(ctx.userRole);

        const { providerVideoId, libraryId, apiKey } = await createBunnyVideoPlaceholder(input.title);
        return generateTusCredentials(libraryId, apiKey, providerVideoId);
      }),

    markUploaded: protectedProcedure
      .input(z.object({
        providerVideoId: z.string(),
        ...videoUploadBaseInput,
        targetTenantId: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        requireSA(ctx.userRole);

        await db.insert(schema.videoAssets).values({
          id:            crypto.randomUUID(),
          tenantId:      input.targetTenantId,  // null → global; orgId → institution-scoped
          domain:        input.domainId,
          course:        input.courseId,
          level:         input.levelId,
          levelId:       input.levelId,
          subject:       input.subjectId,
          book:          '',
          subjectId:     input.subjectId,
          bookTag:       input.bookTag ?? null,
          title:         input.title,
          description:   input.description,
          isFreePreview: input.isFreePreview,
          provider:      'bunny',
          providerVideoId: input.providerVideoId,
          status:        'processing',
          createdBy:     ctx.userId!,
        });

        return { success: true };
      }),

    addYouTubeVideo: protectedProcedure
      .input(z.object({
        ...youtubeBaseInput,
        targetTenantId: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        requireSA(ctx.userRole);

        const videoId = parseYouTubeVideoId(input.youtubeUrl);
        if (!videoId)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not extract video ID from YouTube URL.' });

        await db.insert(schema.videoAssets).values({
          id:             crypto.randomUUID(),
          tenantId:       input.targetTenantId,
          domain:         input.domainId,
          course:         input.courseId,
          level:          input.levelId,
          levelId:        input.levelId,
          subject:        input.subjectId,
          book:           '',
          subjectId:      input.subjectId,
          bookTag:        input.bookTag ?? null,
          title:          input.title,
          description:    input.description,
          provider:       'youtube',
          providerVideoId: videoId,
          durationSeconds: 0,
          thumbnailUrl:   `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          status:         'ready',
          sortOrder:      input.sortOrder,
          isFreePreview:  input.isFreePreview,
          createdBy:      ctx.userId!,
        });

        return { success: true as const };
      }),
  }),
})
