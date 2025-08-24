import redis from "../redis";

export async function hsetJson(key: string, field: string, value: unknown) {
  await redis.hset(key, field, JSON.stringify(value));
}

export async function hdel(key: string, field: string) {
  await redis.hdel(key, field);
}

export async function publishGuildEvent(guildId: string, evt: any) {
  await redis.publish(`events:guild:${guildId}`, JSON.stringify(evt));
}

export async function publishUserEvent(userId: string, evt: any) {
  await redis.publish(`events:user:${userId}`, JSON.stringify(evt));
}
