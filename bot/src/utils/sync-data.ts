import { ChannelType, type Client, Events } from "discord.js";
import redis from "../redis";
import {
  hdel,
  hsetJson,
  publishGuildEvent,
  publishUserEvent,
} from "./redis-cache-utils";
import {
  REDIS_KEYS,
  CACHE_TTL,
  SSE_EVENT_TYPES,
  GuildApplicationCommandPermissions,
  logger,
} from "@discord-bot/shared-types";

let initiated = false;

export function startDataSync(client: Client) {
  if (initiated) throw new Error("[SyncData]: Listeners are already set up");
  initiated = true;

  // ---- On ready: only seed guild set, not guild data ----
  client.once(Events.ClientReady, async () => {
    logger.debug(`Ready as ${client.user?.tag}`);

    // Only add guild IDs to the set for O(1) lookups
    // Don't load guild data - it will be loaded on-demand when dashboard requests it
    const guildIds = Array.from(client.guilds.cache.keys());

    // Add all guild IDs to the set at once
    if (guildIds.length > 0) {
      await redis.sadd(REDIS_KEYS.GUILD_SET, ...guildIds);
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

  client.on(Events.GuildUpdate, async (_oldGuild, newGuild) => {
    // Update cached guild info
    const key = REDIS_KEYS.GUILD_INFO(newGuild.id);
    const guildInfo = {
      id: newGuild.id,
      name: newGuild.name,
      icon: newGuild.icon,
      owner_id: newGuild.ownerId,
    };

    await redis.hset(key, guildInfo);
    await redis.expire(key, CACHE_TTL.GUILD_BASICS);

    await publishGuildEvent(newGuild.id, {
      type: SSE_EVENT_TYPES.GUILD_UPDATE,
      guildId: newGuild.id,
      data: guildInfo,
    });
  });

  client.on(Events.GuildDelete, async (guild) => {
    // Remove from guild set
    await redis.srem(REDIS_KEYS.GUILD_SET, guild.id);
    logger.debug(
      `[SyncData] Removed guild ${guild.id} (${guild.name}) from guild set`
    );

    // Remove cached data if it exists
    await redis.del(
      REDIS_KEYS.GUILD_INFO(guild.id),
      REDIS_KEYS.GUILD_ROLES(guild.id),
      REDIS_KEYS.GUILD_CHANNELS(guild.id)
    );

    await publishGuildEvent(guild.id, {
      type: SSE_EVENT_TYPES.GUILD_DELETE,
      guildId: guild.id,
    });
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    const key = REDIS_KEYS.GUILD_ROLES(role.guild.id);
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      permissions: role.permissions.bitfield.toString(),
    };

    // Only update cache if it already exists (roles are cached on-demand)
    const cacheExists = await redis.exists(key);
    if (cacheExists) {
      await hsetJson(key, role.id, data);
    }

    // Always publish the event for frontend updates
    await publishGuildEvent(role.guild.id, {
      type: SSE_EVENT_TYPES.ROLE_CREATE,
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
      permissions: role.permissions.bitfield.toString(),
    };

    // Only update cache if it already exists (roles are cached on-demand)
    const cacheExists = await redis.exists(key);
    if (cacheExists) {
      await hsetJson(key, role.id, data);
    }

    // Always publish the event for frontend updates
    await publishGuildEvent(role.guild.id, {
      type: SSE_EVENT_TYPES.ROLE_UPDATE,
      roleId: role.id,
      data,
    });
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const key = REDIS_KEYS.GUILD_ROLES(role.guild.id);

    // Only update cache if it already exists (roles are cached on-demand)
    const cacheExists = await redis.exists(key);
    if (cacheExists) {
      await hdel(key, role.id);
    }

    // Always publish the event for frontend updates
    await publishGuildEvent(role.guild.id, {
      type: SSE_EVENT_TYPES.ROLE_DELETE,
      roleId: role.id,
    });
  });

  client.on(Events.ChannelCreate, async (ch) => {
    // Skip non-text/announcement/voice channels
    if (
      ![
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
      ].includes(ch.type)
    )
      return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);

    // Get bot permissions in this channel
    const botMember = await ch.guild.members.fetchMe();
    if (!botMember) {
      logger.debug(`[SyncData] Bot member not found for guild ${ch.guild.id}`);
      return;
    }

    let botPermissions = "0";

    try {
      const permissions = ch.permissionsFor(botMember);
      botPermissions = permissions?.bitfield.toString() ?? "0";
    } catch (error) {
      // Bot doesn't have access to this channel
      logger.debug(
        `[SyncData] Bot cannot access channel ${ch.id} (${ch.name})`
      );
      botPermissions = "0";
    }

    if (botPermissions === "0") {
      logger.debug(
        `[SyncData] Bot cannot access channel ${ch.id} (${ch.name})`
      );
      return;
    }

    const data = {
      id: ch.id,
      name: ch.name,
      position: ch.rawPosition ?? 0,
      botPermissions,
    };

    // Only update cache if it already exists (channels are cached on-demand)
    const cacheExists = await redis.exists(key);
    if (cacheExists) {
      await hsetJson(key, ch.id, data);
    }

    // Always publish the event for frontend updates
    await publishGuildEvent(ch.guild.id, {
      type: SSE_EVENT_TYPES.CHANNEL_CREATE,
      channelId: ch.id,
      data,
    });
  });

  client.on(Events.ChannelUpdate, async (_oldCh, ch) => {
    if (ch.isDMBased()) return;
    // Skip non-text/announcement/voice channels
    if (![0, 2, 5].includes(ch.type)) return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);

    // Get bot permissions in this channel
    const botMember = ch.guild.members.me;
    let botPermissions = "0";

    if (botMember) {
      try {
        const permissions = ch.permissionsFor(botMember);
        botPermissions = permissions?.bitfield.toString() ?? "0";
      } catch (error) {
        // Bot doesn't have access to this channel
        logger.debug(
          `[SyncData] Bot cannot access channel ${ch.id} (${ch.name})`
        );
        botPermissions = "0";
      }
    }

    const data = {
      id: ch.id,
      name: ch.name,
      position: ch.rawPosition ?? 0,
      botPermissions,
    };

    // Only update cache if it already exists (channels are cached on-demand)
    const cacheExists = await redis.exists(key);
    if (cacheExists) {
      await hsetJson(key, ch.id, data);
    }

    // Always publish the event for frontend updates
    await publishGuildEvent(ch.guild.id, {
      type: SSE_EVENT_TYPES.CHANNEL_UPDATE,
      channelId: ch.id,
      data,
    });
  });

  client.on(Events.ChannelDelete, async (ch) => {
    if (ch.isDMBased()) return;

    const key = REDIS_KEYS.GUILD_CHANNELS(ch.guild.id);

    // Only update cache if it already exists (channels are cached on-demand)
    const cacheExists = await redis.exists(key);
    if (cacheExists) {
      await hdel(key, ch.id);
    }

    // Always publish the event for frontend updates
    await publishGuildEvent(ch.guild.id, {
      type: SSE_EVENT_TYPES.CHANNEL_DELETE,
      channelId: ch.id,
    });
  });

  // TODO: track on a different event stream as this is unique for each connecting user
  client.on(Events.GuildMemberUpdate, async (_oldM, newM) => {
    const perms = newM.permissions?.bitfield?.toString() ?? "0";
    await publishUserEvent(newM.id, {
      type: SSE_EVENT_TYPES.MEMBER_PERMS_UPDATE,
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
      if (guildPermissions) {
        // Update the permissions for the command
        const parsedPermissions = JSON.parse(
          guildPermissions
        ) as GuildApplicationCommandPermissions[];

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
      } else {
        logger.debug(
          `[SyncData] Command permissions cache for guild ${data.guildId} does not exist, will be re-fetched from Discord API when needed`
        );
      }

      // Always publish the event for frontend updates
      await publishGuildEvent(data.guildId, {
        type: SSE_EVENT_TYPES.COMMAND_PERMISSIONS_UPDATE,
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
