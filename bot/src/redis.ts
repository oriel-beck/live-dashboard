import Redis from "ioredis";

// Optimized Redis connection for high-scale bot
const redisOptions = {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    // Connection pool settings for high throughput
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: false, // Fail fast if Redis is down
    connectTimeout: 5000,
    lazyConnect: false,
    keepAlive: 30000,
    // Optimize for high memory usage scenarios
    showFriendlyErrorStack: false,
};

const redis = new Redis(redisOptions);

export const createRedisClient = () => {
    return new Redis(redisOptions);
};

export default redis;