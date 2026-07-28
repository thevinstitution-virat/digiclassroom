import { Redis } from 'ioredis';

if (!process.env.REDIS_URL) {
    console.warn("⚠️ REDIS_URL is not set in environment variables");
}

export const bullmqConnection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true,
    enableOfflineQueue: false,
});
