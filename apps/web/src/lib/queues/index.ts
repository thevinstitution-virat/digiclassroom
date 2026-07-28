/**
 * BullMQ Queue Definitions
 * Central registry for all background job queues.
 */

import { Queue } from 'bullmq';
import { bullmqConnection } from '@/lib/redis/bullmq-connection';

export const QUEUE_NAMES = {
    DOCUMENT_PROCESSING: 'document-processing',
    CONNECTOR_SYNC: 'connector-sync',
    NOTIFICATION: 'notification',
    AUDIO_GENERATION: 'audio-generation',
} as const;

export const documentProcessingQueue = new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, {
    connection: bullmqConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    },
});

export const connectorSyncQueue = new Queue(QUEUE_NAMES.CONNECTOR_SYNC, {
    connection: bullmqConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
    connection: bullmqConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    },
});

export const audioGenerationQueue = new Queue(QUEUE_NAMES.AUDIO_GENERATION, {
    connection: bullmqConnection as any,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: { count: 100 },  // keep last 100 completed jobs
        removeOnFail: { count: 50 },
    },
});
