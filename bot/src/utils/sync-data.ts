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

let initiated = false;

export function startDataSync(client: Client) {
  if (initiated) throw new Error("[SyncData]: Listeners are already set up");
  initiated = true;

  // ---- On ready: seed minimal guild data to Redis ----
  client.once(Events.ClientReady, async () => {
    console.log(`Ready as ${client.user?.tag}`);

    // Seed guild basics (name/icon/owner) and structures (roles/channels)
    for (const [, guild] of client.guilds.cache) {
      await syncGuildBasics(guild);
      await syncGuildRoles(guild);
      await syncGuildChannels(guild);
    }

    // Clear API guild caches to ensure fresh data
    await clearApiGuildCaches();
  });

  async function syncGuildBasics(guild: Guild) {
    const base = {
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      ownerId: guild.ownerId,
      shardId: guild.shardId,
    };

    await redis.hset(`guild:${guild.id}`, Object.entries(base).flat());
    await publishGuildEvent(guild.id, {
      type: "guild.upsert",
      guildId: guild.id,
    });
  }

  async function syncGuildRoles(guild: Guild) {
    const roles = await guild.roles.fetch();
    const key = `guild:${guild.id}:roles`;
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
        })
      );
    });

    await pipeline.exec();
    await publishGuildEvent(guild.id, {
      type: "role.refresh",
      guildId: guild.id,
    });
  }

  async function syncGuildChannels(guild: Guild) {
    const channels = await guild.channels.fetch();
    const key = `guild:${guild.id}:channels`;
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
        })
      );
    });
    await pipeline.exec();
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
    await syncGuildBasics(guild);
    await syncGuildRoles(guild);
    await syncGuildChannels(guild);
    
    // Clear API guild caches when new guild is added
    await clearApiGuildCaches();
  });

  client.on(Events.GuildDelete, async (guild) => {
    // Remove keys
    const pipeline = redis
      .pipeline()
      .del(
        `guild:${guild.id}`,
        `guild:${guild.id}:roles`,
        `guild:${guild.id}:channels`
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
    const key = `guild:${role.guild.id}:roles`;
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      color: role.color,
      permissions: role.permissions.bitfield.toString(),
      managed: role.managed,
    };
    await hsetJson(key, role.id, data);
    await publishGuildEvent(role.guild.id, {
      type: "role.create",
      roleId: role.id,
      data,
    });
  });

  client.on(Events.GuildRoleUpdate, async (_oldRole, role) => {
    const key = `guild:${role.guild.id}:roles`;
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      color: role.color,
      permissions: role.permissions.bitfield.toString(),
      managed: role.managed,
    };
    await hsetJson(key, role.id, data);
    await publishGuildEvent(role.guild.id, {
      type: "role.update",
      roleId: role.id,
      data,
    });
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const key = `guild:${role.guild.id}:roles`;
    await hdel(key, role.id);
    await publishGuildEvent(role.guild.id, {
      type: "role.delete",
      roleId: role.id,
    });
  });

  client.on(Events.ChannelCreate, async (ch) => {
    const key = `guild:${ch.guild.id}:channels`;
    const data = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: (ch as any).parentId ?? null,
      position: (ch as any).rawPosition ?? 0,
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

    const key = `guild:${ch.guild.id}:channels`;
    const data = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: (ch as any).parentId ?? null,
      position: (ch as any).rawPosition ?? 0,
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

    const key = `guild:${ch.guild.id}:channels`;
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
      `member:${newM.guild.id}:${newM.id}:perms`,
      perms,
      "EX",
      60 * 30
    );
    await publishUserEvent(newM.id, {
      type: "member.perms",
      guildId: newM.guild.id,
      perms,
    });
  });
}
