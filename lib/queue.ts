import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const documentQueue = new Queue('document-generation', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: { count: 100, age: 3600 }, // Keep last 100 completed jobs for 1 hour to allow polling
        removeOnFail: { age: 24 * 3600 }, // Keep failed jobs for 24h
    },
});

export const videoUploadQueue = new Queue('video-upload', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 }, // Keep failed jobs for 24h
    },
});

export const videoProcessQueue = new Queue('video-process', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { age: 3600 }
    }
});

export const chatQueue = new Queue('chat-messages', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
    },
});

export const syncQueue = new Queue('external-sync', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000, // Google API usually needs more backoff
        },
        removeOnComplete: true,
        removeOnFail: { age: 7 * 24 * 3600 }, // Keep failures for a week for debugging
    },
});