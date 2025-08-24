import Redis from 'ioredis';
import { config } from '../config';

// Redis client for data operations
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

// Redis client for pub/sub (separate connection)
export const redisPublisher = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

// Redis client for subscriptions (separate connection)
export const redisSubscriber = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

export class RedisService {
  static async getGuildRoles(guildId: string) {
    const key = `guild:${guildId}:roles`;
    const entries = await redis.hgetall(key);
    return Object.values(entries).map((s) => JSON.parse(s));
  }

  static async getGuildChannels(guildId: string) {
    const key = `guild:${guildId}:channels`;
    const entries = await redis.hgetall(key);
    return Object.values(entries).map((s) => JSON.parse(s));
  }

  static async getGuildInfo(guildId: string) {
    return await redis.hgetall(`guild:${guildId}`);
  }

  static async publishGuildEvent(guildId: string, event: any) {
    await redisPublisher.publish(
      `events:guild:${guildId}`,
      JSON.stringify(event)
    );
  }

  static async subscribeToGuildEvents(guildId: string, callback: (message: string) => void) {
    await redisSubscriber.subscribe(`events:guild:${guildId}`);
    redisSubscriber.on('message', (_channel, message) => {
      callback(message);
    });
  }

  static async unsubscribeFromGuildEvents(guildId: string) {
    await redisSubscriber.unsubscribe(`events:guild:${guildId}`);
  }
}
