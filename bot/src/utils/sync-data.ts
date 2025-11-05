import { ChannelType, type Client, Events } from "discord.js";
import redis from "../redis";
import {
  EXCHANGE_NAMES,
  REDIS_KEYS,
  SSE_EVENT_TYPES,
} from "@discord-bot/shared";
import { RabbitMQService, logger } from "@discord-bot/services";

// Note: REDIS_KEYS is still needed for guild set operations (GUILD_SET)

let initiated = false;

export function startDataSync(client: Client, rabbitMQ: RabbitMQService) {
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
    const guildInfo = {
      id: newGuild.id,
      name: newGuild.name,
      icon: newGuild.icon,
      owner_id: newGuild.ownerId,
    };

    // Publish to RabbitMQ for API to process
    try {
      await rabbitMQ.publishMessage(
        EXCHANGE_NAMES.DISCORD_EVENTS,
        {
          id: `guild-update-${newGuild.id}-${Date.now()}`,
          type: SSE_EVENT_TYPES.GUILD_UPDATE,
          payload: {
            guildId: newGuild.id,
            data: guildInfo,
          },
          timestamp: new Date(),
          source: "bot",
        },
        `guild.${newGuild.id}`
      );
    } catch (error) {
      logger.warn(`[SyncData] Failed to publish guild update event:`, error);
    }
  });

  client.on(Events.GuildDelete, async (guild) => {
    // Remove from guild set
    await redis.srem(REDIS_KEYS.GUILD_SET, guild.id);
    logger.debug(
      `[SyncData] Removed guild ${guild.id} (${guild.name}) from guild set`
    );

    // Publish to RabbitMQ for API to process (cache cleanup)
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `guild-delete-${guild.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.GUILD_DELETE,
        payload: {
          guildId: guild.id,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${guild.id}`
    );
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      permissions: role.permissions.bitfield.toString(),
    };

    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `role-create-${role.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.ROLE_CREATE,
        payload: {
          guildId: role.guild.id,
          roleId: role.id,
          data,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${role.guild.id}`
    );
  });

  client.on(Events.GuildRoleUpdate, async (_oldRole, role) => {
    const data = {
      id: role.id,
      name: role.name,
      position: role.position,
      permissions: role.permissions.bitfield.toString(),
    };

    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `role-update-${role.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.ROLE_UPDATE,
        payload: {
          guildId: role.guild.id,
          roleId: role.id,
          data,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${role.guild.id}`
    );
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `role-delete-${role.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.ROLE_DELETE,
        payload: {
          guildId: role.guild.id,
          roleId: role.id,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${role.guild.id}`
    );
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

    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `channel-create-${ch.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.CHANNEL_CREATE,
        payload: {
          guildId: ch.guild.id,
          channelId: ch.id,
          data,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${ch.guild.id}`
    );
  });

  client.on(Events.ChannelUpdate, async (_oldCh, ch) => {
    if (ch.isDMBased()) return;
    // Skip non-text/announcement/voice channels
    if (![0, 2, 5].includes(ch.type)) return;

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

    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `channel-update-${ch.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.CHANNEL_UPDATE,
        payload: {
          guildId: ch.guild.id,
          channelId: ch.id,
          data,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${ch.guild.id}`
    );
  });

  client.on(Events.ChannelDelete, async (ch) => {
    if (ch.isDMBased()) return;

    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `channel-delete-${ch.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.CHANNEL_DELETE,
        payload: {
          guildId: ch.guild.id,
          channelId: ch.id,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `guild.${ch.guild.id}`
    );
  });

  // TODO: track on a different event stream as this is unique for each connecting user
  client.on(Events.GuildMemberUpdate, async (_oldM, newM) => {
    const perms = newM.permissions?.bitfield?.toString() ?? "0";
    
    // Publish to RabbitMQ for API to process
    await rabbitMQ.publishMessage(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      {
        id: `member-perms-update-${newM.id}-${Date.now()}`,
        type: SSE_EVENT_TYPES.MEMBER_PERMS_UPDATE,
        payload: {
          userId: newM.id,
          guildId: newM.guild.id,
          perms,
        },
        timestamp: new Date(),
        source: "bot",
      },
      `user.${newM.id}`
    );
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

      // Publish to RabbitMQ for API to process (cache update)
      await rabbitMQ.publishMessage(
        EXCHANGE_NAMES.DISCORD_EVENTS,
        {
          id: `command-permissions-update-${data.guildId}-${data.id}-${Date.now()}`,
          type: SSE_EVENT_TYPES.COMMAND_PERMISSIONS_UPDATE,
          payload: {
            guildId: data.guildId,
            commandId: data.id,
            permissions: data.permissions,
          },
          timestamp: new Date(),
          source: "bot",
        },
        `guild.${data.guildId}`
      );
    } catch (error) {
      logger.error(
        `[SyncData] Error handling command permissions update:`,
        error
      );
    }
  });
}
