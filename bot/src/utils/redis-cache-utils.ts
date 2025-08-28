import { REDIS_KEYS } from "../constants";
import redis from "../redis";

export async function hsetJson(key: string, field: string, value: unknown) {
  await redis.hset(key, field, JSON.stringify(value));
}

export async function hdel(key: string, field: string) {
  await redis.hdel(key, field);
}

export async function publishGuildEvent(guildId: string, evt: unknown) {
  await redis.publish(REDIS_KEYS.GUILD_EVENTS(guildId), JSON.stringify(evt));
}

export async function publishUserEvent(userId: string, evt: unknown) {
  await redis.publish(REDIS_KEYS.USER_EVENTS(userId), JSON.stringify(evt));
}

// New utility functions for guild management
export async function addGuildToSet(guildId: string) {
  await redis.sadd(REDIS_KEYS.GUILD_SET, guildId);
}

export async function removeGuildFromSet(guildId: string) {
  await redis.srem(REDIS_KEYS.GUILD_SET, guildId);
}

export async function isGuildInSet(guildId: string): Promise<boolean> {
  const result = await redis.sismember(REDIS_KEYS.GUILD_SET, guildId);
  return result === 1;
}

export async function getAllGuildIds(): Promise<string[]> {
  return await redis.smembers(REDIS_KEYS.GUILD_SET);
}

export async function setGuildDataWithTTL(
  guildId: string, 
  data: Record<string, unknown>, 
  ttlSeconds: number
) {
  const key = REDIS_KEYS.GUILD_INFO(guildId);
  await redis.hset(key, Object.entries(data).flat());
  await redis.expire(key, ttlSeconds);
}

export async function setGuildRolesWithTTL(
  guildId: string, 
  roles: Record<string, unknown>, 
  ttlSeconds: number
) {
  const key = REDIS_KEYS.GUILD_ROLES(guildId);
  const pipeline = redis.pipeline().del(key);
  
  Object.entries(roles).forEach(([roleId, roleData]) => {
    pipeline.hset(key, roleId, JSON.stringify(roleData));
  });
  
  await pipeline.exec();
  await redis.expire(key, ttlSeconds);
}

export async function setGuildChannelsWithTTL(
  guildId: string, 
  channels: Record<string, unknown>, 
  ttlSeconds: number
) {
  const key = REDIS_KEYS.GUILD_CHANNELS(guildId);
  const pipeline = redis.pipeline().del(key);
  
  Object.entries(channels).forEach(([channelId, channelData]) => {
    pipeline.hset(key, channelId, JSON.stringify(channelData));
  });
  
  await pipeline.exec();
  await redis.expire(key, ttlSeconds);
}
