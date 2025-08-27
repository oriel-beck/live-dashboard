import {
  type Client,
  Events,
  type Guild,
  type GuildChannel,
  type Role,
} from "discord.js";
import redis from "../redis";
import {
  hdel,
  hsetJson,
  publishGuildEvent,
  publishUserEvent,
} from "./redis-cache-utils";
import { REDIS_KEYS, CACHE_TTL } from "../constants";

let initiated = false;

export function startDataSync(client: Client) {
  if (initiated) throw new Error("[SyncData]: Listeners are already set up");
  initiated = true;

  // ---- On ready: only seed guild set, not guild data ----
  client.once(Events.ClientReady, async () => {
    console.log(`Ready as ${client.user?.tag}`);

    // Only add guild IDs to the set for O(1) lookups
    // Don't load guild data - it will be loaded on-demand when dashboard requests it
    for (const [, guild] of client.guilds.cache) {
      await redis.sadd(REDIS_KEYS.GUILD_SET, guild.id);
    }

    console.log(`[SyncData] Guild set initialized with ${client.guilds.cache.size} guilds`);
  });

  async function syncGuildBasics(guild: Guild) {
    const base = {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      shardId: guild.shardId,
      lastUpdated: Date.now(),
    };

    // Set guild basics with TTL
    await redis.hset(REDIS_KEYS.GUILD_INFO(guild.id), Object.entries(base).flat());
    await redis.expire(REDIS_KEYS.GUILD_INFO(guild.id), CACHE_TTL.GUILD_BASICS);
    
    await publishGuildEvent(guild.id, {
      type: "guild.upsert",
      guildId: guild.id,
    });
  }

  async function syncGuildRoles(guild: Guild) {
    const roles = await guild.roles.fetch();
    const key = REDIS_KEYS.GUILD_ROLES(guild.id);
    const pipeline = redis.pipeline().del(key);

    roles.forEach((role: Role) => {
      pipeline.hset(
        key,
        role.id,
        JSON.stringify({
          id: role.id,
          name: role.name,
          position: role.position,
          color: role.color,
          permissions: role.permissions.bitfield.toString(),
          managed: role.managed,
          lastUpdated: Date.now(),
        })
      );
    });

    await pipeline.exec();
    await redis.expire(key, CACHE_TTL.GUILD_ROLES);
    
    await publishGuildEvent(guild.id, {
      type: "role.refresh",
      guildId: guild.id,
    });
  }

  async function syncGuildChannels(guild: Guild) {
    const channels = await guild.channels.fetch();
    const key = REDIS_KEYS.GUILD_CHANNELS(guild.id);
    const pipeline = redis.pipeline().del(key);

    channels.forEach((ch: GuildChannel | null) => {
      if (!ch) return;
      pipeline.hset(
        key,
        ch.id,
        JSON.stringify({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          parentId: (ch as any).parentId ?? null,
          position: (ch as any).rawPosition ?? 0,
          lastUpdated: Date.now(),
        })
      );
    });
    await pipeline.exec();
    await redis.expire(key, CACHE_TTL.GUILD_CHANNELS);
    
    await publishGuildEvent(guild.id, {
      type: "channel.refresh",
      guildId: guild.id,
    });
  }

  // Clear API guild caches to ensure consistency
  async function clearApiGuildCaches() {
    try {
      // Clear all user guild caches
      const userGuildKeys = await redis.keys('user:*:guilds');
      if (userGuildKeys.length > 0) {
        await redis.del(...userGuildKeys);
      }
      
      console.log('[SyncData] Cleared API guild caches for consistency');
    } catch (error) {
      console.error('[SyncData] Error clearing API guild caches:', error);
    }
  }

  // ---- Live change mirroring ----
  client.on(Events.GuildCreate, async (guild) => {
    // Add to guild set for O(1) lookups
    await redis.sadd(REDIS_KEYS.GUILD_SET, guild.id);
    console.log(`[SyncData] Added new guild ${guild.id} (${guild.name}) to guild set`);
    
    // Clear API guild caches when new guild is added
    await clearApiGuildCaches();
  });

  client.on(Events.GuildDelete, async (guild) => {
    // Remove from guild set
    await redis.srem(REDIS_KEYS.GUILD_SET, guild.id);
    console.log(`[SyncData] Removed guild ${guild.id} (${guild.name}) from guild set`);
    
    // Remove cached data if it exists
    const pipeline = redis
      .pipeline()
      .del(
        REDIS_KEYS.GUILD_INFO(guild.id),
        REDIS_KEYS.GUILD_ROLES(guild.id),
        REDIS_KEYS.GUILD_CHANNELS(guild.id)
      );
    await pipeline.exec();
    
    await publishGuildEvent(guild.id, {
      type: "guild.delete",
      guildId: guild.id,
    });
    
    // Clear API guild caches when guild is removed
    await clearApiGuildCaches();
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    const key = REDIS_KEYS.GUILD_ROLES(role.guild.id);
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      color: role.color,
      permissions: role.permissions.bitfield.toString(),
      managed: role.managed,
      lastUpdated: Date.now(),
    };
    await hsetJson(key, role.id, data);
    await publishGuildEvent(role.guild.id, {
      type: "role.create",
      roleId: role.id,
      data,
    });
  });

  client.on(Events.GuildRoleUpdate, async (_oldRole, role) => {
    const key = REDIS_KEYS.GUILD_ROLES(role.guild.id);
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      color: role.color,
      permissions: role.permissions.bitfield.toString(),
      managed: role.managed,
      lastUpdated: Date.now(),
    };
    await hsetJson(key, role.id, data);
    await publishGuildEvent(role.guild.id, {
      type: "role.update",
      roleId: role.id,
      data,
    });
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const key = REDIS_KEYS.GUILD_ROLES(role.guild.id);
    await hdel(key, role.id);
    await publishGuildEvent(role.guild.id, {
      type: "role.delete",
      roleId: role.id,
    });
  });

  client.on(Events.ChannelCreate, async (ch) => {
    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);
    const data = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: (ch as any).parentId ?? null,
      position: (ch as any).rawPosition ?? 0,
      lastUpdated: Date.now(),
    };
    await hsetJson(key, ch.id, data);
    await publishGuildEvent(ch.guild.id, {
      type: "channel.create",
      channelId: ch.id,
      data,
    });
  });

  client.on(Events.ChannelUpdate, async (_oldCh, ch) => {
    if (ch.isDMBased()) return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);
    const data = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: (ch as any).parentId ?? null,
      position: (ch as any).rawPosition ?? 0,
      lastUpdated: Date.now(),
    };
    await hsetJson(key, ch.id, data);
    await publishGuildEvent(ch.guild.id, {
      type: "channel.update",
      channelId: ch.id,
      data,
    });
  });

  client.on(Events.ChannelDelete, async (ch) => {
    if (ch.isDMBased()) return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);
    await hdel(key, ch.id);
    await publishGuildEvent(ch.guild.id, {
      type: "channel.delete",
      channelId: ch.id,
    });
  });

  // TODO: track on a different event stream as this is unique for each connecting user
  client.on(Events.GuildMemberUpdate, async (_oldM, newM) => {
    const perms = newM.permissions?.bitfield?.toString() ?? "0";
    await redis.set(
      REDIS_KEYS.MEMBER_PERMS(newM.guild.id, newM.id),
      perms,
      "EX",
      CACHE_TTL.MEMBER_PERMS
    );
    await publishUserEvent(newM.id, {
      type: "member.perms",
      guildId: newM.guild.id,
      perms,
    });
  });
}
