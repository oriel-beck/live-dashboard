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
import { REDIS_KEYS, CACHE_TTL } from "@discord-bot/shared-types";
import logger from "./logger";
import { GuildApplicationCommandPermissions } from "@discord-bot/shared-types";

let initiated = false;

export function startDataSync(client: Client) {
  if (initiated) throw new Error("[SyncData]: Listeners are already set up");
  initiated = true;

  // ---- On ready: only seed guild set, not guild data ----
  client.once(Events.ClientReady, async () => {
    logger.debug(`Ready as ${client.user?.tag}`);

    // Only add guild IDs to the set for O(1) lookups
    // Don't load guild data - it will be loaded on-demand when dashboard requests it
    for (const [, guild] of client.guilds.cache) {
      await redis.sadd(REDIS_KEYS.GUILD_SET, guild.id);
    }

    logger.debug(
      `[SyncData] Guild set initialized with ${client.guilds.cache.size} guilds`
    );
  });

  // ---- Live change mirroring ----
  client.on(Events.GuildCreate, async (guild) => {
    // Add to guild set for O(1) lookups
    await redis.sadd(REDIS_KEYS.GUILD_SET, guild.id);
    logger.debug(
      `[SyncData] Added new guild ${guild.id} (${guild.name}) to guild set`
    );
  });

  client.on(Events.GuildDelete, async (guild) => {
    // Remove from guild set
    await redis.srem(REDIS_KEYS.GUILD_SET, guild.id);
    logger.debug(
      `[SyncData] Removed guild ${guild.id} (${guild.name}) from guild set`
    );

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
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    // Skip managed roles
    if (role.managed) return;

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
    // Skip managed roles
    if (role.managed) return;

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
    // Skip non-text/announcement/voice channels
    if (![0, 2, 5].includes(ch.type)) return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);
    const data = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId ?? null,
      position: ch.rawPosition ?? 0,
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
    // Skip non-text/announcement/voice channels
    if (![0, 2, 5].includes(ch.type)) return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);
    const data = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId ?? null,
      position: ch.rawPosition ?? 0,
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

  // This event is triggered when the permissions for a command are updated
  // It does not include the entire guild permissions, only the permissions for the command
  client.on(Events.ApplicationCommandPermissionsUpdate, async (data) => {
    try {
      // Only process if the command belongs to this bot
      const botApplicationId = process.env.DISCORD_CLIENT_ID;
      if (data.applicationId !== botApplicationId) {
        logger.debug(
          `[SyncData] Ignoring command permissions update for different bot: ${data.applicationId}`
        );
        return;
      }
      
      // Update the cached permissions if they are already cached
      const cacheKey = REDIS_KEYS.GUILD_COMMAND_PERMISSIONS(data.guildId);

      const guildPermissions = await redis.get(cacheKey);
      if (!guildPermissions) {
        logger.debug(
          `[SyncData] Command permissions cache for guild ${data.guildId} does not exist, will be re-fetched from Discord API when needed`
        );
        return;
      }

      // Update the permissions for the command
      const parsedPermissions = JSON.parse(guildPermissions) as GuildApplicationCommandPermissions[];

      const updatedPermissions = parsedPermissions.map((permission) => {
        if (permission.id === data.id) {
          return data.permissions;
        }
        return permission;
      });

      await redis.setex(
        cacheKey,
        CACHE_TTL.COMMAND_PERMISSIONS,
        JSON.stringify(updatedPermissions)
      );

      logger.debug(
        `[SyncData] Updated command permissions cache for guild ${data.guildId}`
      );

      // Publish the event for real-time updates
      await publishGuildEvent(data.guildId, {
        type: "command.permissions.update",
        guildId: data.guildId,
        commandId: data.id,
        permissions: data.permissions,
      });
    } catch (error) {
      logger.error(
        `[SyncData] Error handling command permissions update:`,
        error
      );
    }
  });
}
