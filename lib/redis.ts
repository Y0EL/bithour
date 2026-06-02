import { Redis, RedisOptions } from 'ioredis';

const isProduction = !!process.env.REDIS_PASSWORD;

const redisConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: isProduction ? {} : undefined,  // Upstash requires TLS in production
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 5000,
};

export const redisConnection = new Redis(redisConfig);
export const redisClient = redisConnection;

redisConnection.on('error', () => {
    // Silent fail — Redis unavailable (local dev or build time)
});

redisConnection.on('connect', () => {
    // console.log('Successfully connected to Redis');
});
