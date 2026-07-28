import { Worker, Job } from 'bullmq';
import { bullmqConnection } from '../redis/bullmq-connection';
import { db } from '@/db';
import { sarvagyaSpaces, sarvagyaDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generatePodcastAudio } from '../services/elevenlabs';
import { uploadBufferToR2 } from '../services/r2';
import { QUEUE_NAMES } from '../queues';

// Note: A real implementation would pull from the initialized Vector DB,
// but for this phase we simulate fetching the document text by generating
// a script relative to the document titles stored in MySQL.
async function generateScriptFromSpace(spaceId: string) {
    const [space] = await db.select().from(sarvagyaSpaces).where(eq(sarvagyaSpaces.id, spaceId));
    const docs = await db.select().from(sarvagyaDocuments).where(eq(sarvagyaDocuments.spaceId, spaceId));

    if (!space) throw new Error("Space not found");

    const docTitles = docs.map(d => d.name).join(", ");

    // Fallback/Simulated podcast script based on the space context
    return `Welcome to the Sarvagya Audio Overview for your space, ${space.name}. 
    We have analyzed your ${docs.length} uploaded documents, including ${docTitles}. 
    This space focuses on advanced AI and structured research. Stay tuned as we synthesize these materials into actionable insights in the future. Everything is looking great!`;
}

export const audioWorker = new Worker(
    QUEUE_NAMES.AUDIO_GENERATION,
    async (job: Job) => {
        try {
            console.log(`[AudioWorker] Processing job ${job.id} for space ${job.data.spaceId}`);
            await job.updateProgress(10);

            // 1. Fetch text / Generate Script
            const script = await generateScriptFromSpace(job.data.spaceId);
            await job.updateProgress(30);

            // 2. Synthesize using ElevenLabs
            console.log(`[AudioWorker] Synthesizing audio via ElevenLabs...`);
            const audioBuffer = await generatePodcastAudio(script);
            await job.updateProgress(70);

            // 3. Upload raw Buffer to Cloudflare R2
            console.log(`[AudioWorker] Uploading synthesized audio to Cloudflare R2...`);
            const objectKey = await uploadBufferToR2(audioBuffer, 'audio/mpeg', `podcast_${job.data.spaceId}.mp3`);
            await job.updateProgress(90);

            // 4. Return the public/accessible URL 
            // The frontend inline audio player needs exactly this URL shape.
            const publicUrl = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${objectKey}`;

            console.log(`[AudioWorker] Job ${job.id} complete. Audio available at: ${publicUrl}`);
            await job.updateProgress(100);

            return { url: publicUrl, objectKey };
        } catch (error: any) {
            console.error(`[AudioWorker] Job ${job.id} failed:`, error);
            throw error;
        }
    },
    {
        connection: bullmqConnection as any,
        concurrency: 1, // Process one audio generation at a time
    }
);

audioWorker.on('completed', (job) => {
    console.log(`✅ [AudioWorker] Job ${job.id} successfully completed`);
});

audioWorker.on('failed', (job, err) => {
    console.error(`❌ [AudioWorker] Job ${job?.id} failed with error ${err.message}`);
});

console.log('🎧 Audio Generation Worker initialized and listening on queue:', QUEUE_NAMES.AUDIO_GENERATION);
