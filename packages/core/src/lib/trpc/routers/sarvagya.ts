import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { callSarvagya } from '@/lib/sarvagya/client';
import { documentProcessingQueue, audioGenerationQueue } from '@/lib/queues';
import { TRPCError } from '@trpc/server';
import { checkSarvagyaCredits, deductSarvagyaCredits } from '@/lib/sarvagya/credits';
import { db } from '@/db';
import { sarvagyaSpaces, sarvagyaDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { generatePresignedUploadUrl } from '@/lib/services/r2';

export const sarvagyaRouter = createTRPCRouter({

    // ---------------------------------------------------------------------------
    // Spaces
    // ---------------------------------------------------------------------------
    listSpaces: protectedProcedure.query(async ({ ctx }) => {
        return await db
            .select()
            .from(sarvagyaSpaces)
            .where(eq(sarvagyaSpaces.userId, ctx.userId!));
    }),

    createSpace: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1).max(100),
                description: z.string().max(500).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            try {
                // 1. Call Sarvagya internally to create the space
                // Safely typing the remote response since it's a generic JSON blob from microservice
                const remoteSpace = await callSarvagya(
                    ctx.userId!,
                    'default',
                    '/api/v1/search-spaces',
                    { name: input.name, description: input.description }
                ) as { id: string | number };

                // 2. Insert mapped record locally
                const newId = crypto.randomUUID();
                await db.insert(sarvagyaSpaces).values({
                    id: newId,
                    userId: ctx.userId!,
                    internalSpaceId: remoteSpace.id.toString(),
                    name: input.name,
                    description: input.description,
                });

                const [localSpace] = await db.select().from(sarvagyaSpaces).where(eq(sarvagyaSpaces.id, newId));

                return localSpace;
            } catch (error) {
                throw mapSarvagyaError(error);
            }
        }),
    // ---------------------------------------------------------------------------
    // Query (Top-level mutation)
    // ---------------------------------------------------------------------------
    query: protectedProcedure
        .input(
            z.object({
                spaceId: z.string(), // The space UUID
                message: z.string().min(1).max(10000),
                useWebSearch: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // 1. Check credits first
            console.log("Sarvagya Query Input:", input);
            const credits = await checkSarvagyaCredits(ctx.userId!);
            console.log("Sarvagya Query Credits Evaluated:", credits);
            if (credits <= 0) {
                console.error("Sarvagya Query Failed: Insufficient Credits. Evaluated:", credits);
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: "Insufficient Sarvagya credits. Please top up your balance."
                });
            }

            try {
                // 2. Query the LLM
                const response = await callSarvagya(
                    ctx.userId!,
                    'default',
                    '/api/v1/query',
                    {
                        search_space_id: input.spaceId,
                        query: input.message,
                        useWebSearch: input.useWebSearch,
                    }
                ) as {
                    answer?: string;
                    content?: string;
                    citations?: any[];
                    [key: string]: unknown
                };

                // 3. Deduct credit POST-success. 1 credit per query.
                // We use a mock query ID here since Sarvagya API doesn't return one uniquely yet.
                const queryId = crypto.randomUUID();
                await deductSarvagyaCredits(ctx.userId!, 1, queryId);

                return { ...response, creditsCharged: 1, creditsRemaining: credits - 1 };
            } catch (error) {
                throw mapSarvagyaError(error);
            }
        }),

    // ---------------------------------------------------------------------------
    // Documents
    // ---------------------------------------------------------------------------
    listDocuments: protectedProcedure
        .input(z.object({ spaceId: z.string() }))
        .query(async ({ input }) => {
            return await db.select().from(sarvagyaDocuments).where(eq(sarvagyaDocuments.spaceId, input.spaceId));
        }),

    getUploadUrl: protectedProcedure
        .input(z.object({
            filename: z.string(),
            contentType: z.string()
        }))
        .mutation(async ({ input }) => {
            const { uploadUrl, objectKey } = await generatePresignedUploadUrl(input.contentType, input.filename);
            return { uploadUrl, objectKey };
        }),

    uploadDocument: protectedProcedure
        .input(
            z.object({
                spaceId: z.string(), // Local UUID of the space
                name: z.string(),
                url: z.string().url(),
                fileType: z.string(),
                size: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // 1. Insert local pending state
            const newDocId = crypto.randomUUID();
            await db.insert(sarvagyaDocuments).values({
                id: newDocId,
                spaceId: input.spaceId,
                internalDocId: 'pending-' + crypto.randomUUID(),
                name: input.name,
                url: input.url,
                fileType: input.fileType,
                size: input.size,
                status: 'pending'
            });

            const [doc] = await db.select().from(sarvagyaDocuments).where(eq(sarvagyaDocuments.id, newDocId));

            // 2. Queue for background ingestion
            await documentProcessingQueue.add('sarvagya_doc', {
                type: 'sarvagya_doc',
                userId: ctx.userId!,
                tenantId: 'default', // Single-tenant fallback, or use active context if multitenant
                payload: {
                    connector_type: 'url',
                    connector_data: { url: input.url },
                    search_space_id: input.spaceId
                }
            });

            return doc;
        }),
    // ---------------------------------------------------------------------------
    // Audio Podcasts
    // ---------------------------------------------------------------------------
    generateAudioOverview: protectedProcedure
        .input(z.object({ spaceId: z.string() }))
        .mutation(async ({ input }) => {
            // Deduct credits for audio generation (e.g. 5 credits)
            // In a real app we would compute this based on document length

            // Queue for background audio generation
            const job = await audioGenerationQueue.add('sarvagya_audio', {
                spaceId: input.spaceId,
                // In a full implementation, you'd fetch all document text here and pass it
                // Or let the worker fetch it using the spaceId
                action: 'generate_podcast'
            });

            return { jobId: job.id, status: 'queued' };
        }),

    getAudioOverviewStatus: protectedProcedure
        .input(z.object({ jobId: z.string() }))
        .query(async ({ input }) => {
            const job = await audioGenerationQueue.getJob(input.jobId);
            if (!job) {
                return { status: 'not_found' };
            }

            const state = await job.getState();
            // Depending on the queue system (Bull/BullMQ), job.returnvalue might contain the URL
            const resultUrl = job.returnvalue?.url || null;

            return {
                id: job.id,
                status: state,
                progress: job.progress,
                failedReason: job.failedReason,
                url: resultUrl
            };
        }),

    // ---------------------------------------------------------------------------
    // Store
    // ---------------------------------------------------------------------------
    storeProducts: protectedProcedure.query(() => {
        return [
            { id: 'pack_50', credits: 50, price: 49, featured: false },
            { id: 'pack_120', credits: 120, price: 99, featured: true },
            { id: 'pack_280', credits: 280, price: 199, featured: false },
            { id: 'pack_800', credits: 800, price: 499, featured: false },
        ];
    }),

    storeCheckout: protectedProcedure
        .input(z.object({ packId: z.string() }))
        .mutation(async ({ input }) => {
            // Return a mock Razorpay order ID to fulfill testing safely
            return {
                orderId: `order_${crypto.randomBytes(10).toString('hex')}`,
                packId: input.packId
            };
        }),
});

// ---------------------------------------------------------------------------
// Error mapper
// ---------------------------------------------------------------------------
function mapSarvagyaError(error: unknown): TRPCError {
    if (error instanceof Error && error.message.includes('Sarvagya API Error')) {
        const match = error.message.match(/Sarvagya API Error \((\d+)\)/);
        const statusCode = match ? parseInt(match[1], 10) : 500;

        const code =
            statusCode === 404
                ? 'NOT_FOUND'
                : statusCode === 403
                    ? 'FORBIDDEN'
                    : statusCode === 401
                        ? 'UNAUTHORIZED'
                        : 'INTERNAL_SERVER_ERROR';

        return new TRPCError({
            code: code as 'NOT_FOUND' | 'FORBIDDEN' | 'UNAUTHORIZED' | 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error,
        });
    }

    return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Sarvagya service error',
        cause: error,
    });
}
