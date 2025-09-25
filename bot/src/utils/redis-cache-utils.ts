import { REDIS_KEYS } from "@discord-bot/shared-types";
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

