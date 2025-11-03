import { createClient } from "redis";
import {
  CACHE_TTL,
  REDIS_KEYS,
  GuildInfo,
  ChannelType,
  GuildChannel,
  GuildRole,
  logger
} from "@discord-bot/shared-types";
import { config } from "../config";
import { DiscordService } from "./discord";

export class RedisService {
  private static client: ReturnType<typeof createClient> | null = null;

  static async initialize(): Promise<void> {
    const maxRetries = 10;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[Redis] Connection attempt ${attempt}/${maxRetries}...`);

        // Main Redis client
        this.client = createClient({
          url: config.redis.url,
          socket: {
            connectTimeout: 5000,
            keepAlive: 30000,
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                logger.error("[Redis] Max retry attempts reached");
                return new Error("Max retries reached");
              }
              return Math.min(retries * 100, 3000);
            },
          },
        });

        // Connect client
        await this.client.connect();

        // Set up error handlers
        this.client.on("error", (err) =>
          logger.error("[Redis] Client error:", err)
        );

        // Test connection
        await this.client.ping();
        logger.info("[Redis] Connected successfully");
        return; // Success, exit the retry loop
      } catch (error) {
        logger.warn(`[Redis] Connection attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          logger.error("[Redis] All connection attempts failed");
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.info(`[Redis] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  static getClient() {
    if (!this.client) {
      throw new Error("Redis not initialized. Call initialize() first.");
    }
    return this.client;
  }

  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    logger.info("[Redis] Connection closed");
  }

  static async getGuildRoles(guildId: string): Promise<GuildRole[]> {
    const client = this.getClient();
    const key = REDIS_KEYS.GUILD_ROLES(guildId);

    try {
      // Check if data exists and is not expired
      const exists = await client.exists(key);
      if (exists === 0) {
        // Data doesn't exist, try to fetch it
        logger.debug(
          `[RedisService] Guild roles not found for guild ${guildId}, attempting to fetch...`
        );

        try {
          const rolesData = await DiscordService.getGuildRoles(guildId);

          // Transform and cache the roles (including managed roles for permission calculations)
          const roles = rolesData.map((role) => ({
            id: role.id,
            name: role.name,
            position: role.position,
            permissions: role.permissions,
            managed: role.managed,
          }));

          // Cache roles with TTL
          if (roles.length > 0) {
            await client.del(key);
            const roleData = roles.reduce((acc, role) => {
              acc[role.id] = JSON.stringify(role);
              return acc;
            }, {} as Record<string, string>);
            await client.hSet(key, roleData);
            await client.expire(key, CACHE_TTL.GUILD_ROLES);
          }

          // Add guild to guild set
          await client.sAdd(REDIS_KEYS.GUILD_SET, guildId);

          logger.debug(
            `[RedisService] Successfully fetched and cached guild roles for ${guildId}`
          );
          return roles;
        } catch (error) {
          logger.error(
            `[RedisService] Failed to fetch guild roles for ${guildId}:`,
            error
          );
          throw new Error("GUILD_ROLES_FETCH_FAILED");
        }
      }

      const entries = await client.hGetAll(key);
      const roles = Object.values(entries).map((s) => {
        try {
          return JSON.parse(s);
        } catch (error) {
          logger.error(`[RedisService] Failed to parse role data: ${s}`, error);
          throw new Error("INVALID_ROLE_DATA");
        }
      });

      return roles;
    } catch (error) {
      logger.error(
        `[RedisService] Error getting guild roles for ${guildId}:`,
        error
      );
      throw error;
    }
  }


  static async getGuildChannels(
    guildId: string
  ): Promise<GuildChannel[]> {
    const client = this.getClient();
    const key = REDIS_KEYS.GUILD_CHANNELS(guildId);

    try {
      // Check if data exists and is not expired
      const exists = await client.exists(key);
      if (exists === 0) {
        // Data doesn't exist, try to fetch it
        logger.debug(
          `[RedisService] Guild channels not found for guild ${guildId}, attempting to fetch...`
        );

        try {
          const channelsData = await DiscordService.getGuildChannels(guildId);

          // Get bot's guild member info and guild roles to calculate permissions
          const [botMember, guildRoles] = await Promise.all([
            DiscordService.getBotGuildMember(guildId),
            this.getGuildRoles(guildId)
          ]);

          // Transform and cache the channels (text, announcement, and voice channels)
          const channels = channelsData
            .filter((channel) =>
              [
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement,
                ChannelType.GuildVoice,
              ].includes(channel.type)
            ) // Filter to text, voice, and announcement channels
            .map((channel) => {
              // Calculate bot permissions for this channel
              const botPermissions = botMember 
                ? DiscordService.calculateChannelPermissions(channel, botMember, guildRoles)
                : 0n;

              return {
                id: channel.id,
                name: channel.name,
                position: (channel as any).position || 0,
                botPermissions: botPermissions.toString(),
              };
            });

          // Cache channels with TTL
          if (channels.length > 0) {
            await client.del(key);
            const channelData = channels.reduce((acc, channel) => {
              acc[channel.id] = JSON.stringify(channel);
              return acc;
            }, {} as Record<string, string>);
            await client.hSet(key, channelData);
            await client.expire(key, CACHE_TTL.GUILD_CHANNELS);
          }

          // Add guild to guild set
          await client.sAdd(REDIS_KEYS.GUILD_SET, guildId);

          logger.debug(
            `[RedisService] Successfully fetched and cached guild channels for ${guildId}`
          );
          return channels;
        } catch (error) {
          logger.error(
            `[RedisService] Failed to fetch guild channels for ${guildId}:`,
            error
          );
          throw new Error("GUILD_CHANNELS_FETCH_FAILED");
        }
      }

      const entries = await client.hGetAll(key);
      const channels = Object.values(entries)
        .map((s) => {
          try {
            return JSON.parse(s);
          } catch (error) {
            logger.error(
              `[RedisService] Failed to parse channel data: ${s}`,
              error
            );
            throw new Error("INVALID_CHANNEL_DATA");
          }
        })

      return channels;
    } catch (error) {
      logger.error(
        `[RedisService] Error getting guild channels for ${guildId}:`,
        error
      );
      throw error;
    }
  }

  static async getGuildInfo(guildId: string): Promise<GuildInfo> {
    const client = this.getClient();
    const key = REDIS_KEYS.GUILD_INFO(guildId);

    try {
      // Check if data exists and is not expired
      const exists = await client.exists(key);
      if (exists === 0) {
        // Data doesn't exist, try to fetch it
        logger.debug(
          `[RedisService] Guild info not found for guild ${guildId}, attempting to fetch...`
        );

        try {
          const guildData = await DiscordService.getGuildInfo(guildId);

          // Transform and cache the guild info
          const guildInfo = {
            id: guildData.id,
            name: guildData.name,
            icon: guildData.icon,
            owner_id: guildData.owner_id,
          };

          // Cache guild info with TTL
          await client.hSet(key, {
            id: guildInfo.id,
            name: guildInfo.name,
            icon: guildInfo.icon || "",
            owner_id: guildInfo.owner_id,
          });
          await client.expire(key, CACHE_TTL.GUILD_BASICS);

          // Add guild to guild set
          await client.sAdd(REDIS_KEYS.GUILD_SET, guildId);

          logger.debug(
            `[RedisService] Successfully fetched and cached guild info for ${guildId}`
          );
          return guildInfo;
        } catch (error) {
          logger.error(
            `[RedisService] Failed to fetch guild info for ${guildId}:`,
            error
          );
          throw new Error("GUILD_INFO_FETCH_FAILED");
        }
      }

      const guildInfo = await client.hGetAll(key);

      return {
        id: guildInfo.id || "",
        name: guildInfo.name || "",
        icon: guildInfo.icon || null,
        owner_id: guildInfo.owner_id || "",
      };
    } catch (error) {
      logger.error(
        `[RedisService] Error getting guild info for ${guildId}:`,
        error
      );
      throw error;
    }
  }


  // Helper method to check if a guild is accessible
  static async isGuildAccessible(guildId: string): Promise<boolean> {
    const client = this.getClient();
    return await client.sIsMember(REDIS_KEYS.GUILD_SET, guildId);
  }
}
