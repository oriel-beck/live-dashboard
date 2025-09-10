import Redis from "ioredis";

const redis = new Redis({
    host: process.env.REDIS_HOST!,
});

export const createRedisClient = () => {
    return new Redis({
        host: process.env.REDIS_HOST!,
    });
};

export default redis;