import { Queue } from 'bullmq';
import { redisConnection } from './redis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const driveQueue = new Queue('drive-sync', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: redisConnection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 3600, // keep completed jobs for 1 hour
        },
        removeOnFail: {
            age: 86400, // keep failed jobs for 24 hours
        },
    },
});
