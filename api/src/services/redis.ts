import { createClient } from 'redis';
import { CACHE_TTL, REDIS_KEYS, GuildInfo } from "@discord-bot/shared-types";
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  CachedGuildChannel,
  CachedGuildInfo,
  CachedGuildRole,
  GuildChannel,
  GuildRole,
  UserGuild,
} from '../types';
import { makeRequestWithRetry } from '../utils/request-utils';
import { DiscordService } from './discord';

export class RedisService {
  private static client: ReturnType<typeof createClient> | null = null;
  private static publisher: ReturnType<typeof createClient> | null = null;
  private static subscriber: ReturnType<typeof createClient> | null = null;

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
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                logger.error('[Redis] Max retry attempts reached');
                return new Error('Max retries reached');
              }
              return Math.min(retries * 100, 3000);
            },
          },
        });

        // Publisher client
        this.publisher = createClient({
          url: config.redis.url,
          socket: {
            connectTimeout: 5000,
          },
        });

        // Subscriber client
        this.subscriber = createClient({
          url: config.redis.url,
          socket: {
            connectTimeout: 5000,
          },
        });

        // Connect all clients
        await Promise.all([
          this.client.connect(),
          this.publisher.connect(),
          this.subscriber.connect(),
        ]);

        // Set up error handlers
        this.client.on('error', (err) => logger.error('[Redis] Client error:', err));
        this.publisher.on('error', (err) => logger.error('[Redis] Publisher error:', err));
        this.subscriber.on('error', (err) => logger.error('[Redis] Subscriber error:', err));

        // Test connection
        await this.client.ping();
        logger.info('[Redis] Connected successfully');
        return; // Success, exit the retry loop
        
      } catch (error) {
        logger.warn(`[Redis] Connection attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          logger.error('[Redis] All connection attempts failed');
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.info(`[Redis] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  static getClient() {
    if (!this.client) {
      throw new Error('Redis not initialized. Call initialize() first.');
    }
    return this.client;
  }

  static getPublisher() {
    if (!this.publisher) {
      throw new Error('Redis publisher not initialized. Call initialize() first.');
    }
    return this.publisher;
  }

  static getSubscriber() {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call initialize() first.');
    }
    return this.subscriber;
  }

  static async close(): Promise<void> {
    const promises = [];
    
    if (this.client) {
      promises.push(this.client.quit());
      this.client = null;
    }
    
    if (this.publisher) {
      promises.push(this.publisher.quit());
      this.publisher = null;
    }
    
    if (this.subscriber) {
      promises.push(this.subscriber.quit());
      this.subscriber = null;
    }

    await Promise.all(promises);
    logger.info('[Redis] Connections closed');
  }


  static async getGuildRoles(guildId: string): Promise<CachedGuildRole[]> {
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

          // Transform and cache the roles (excluding managed roles)
          const now = Date.now();
          const roles = rolesData
            .filter((role) => !role.managed) // Filter out managed roles
            .map((role) => ({
              id: role.id,
              name: role.name,
              position: role.position,
              color: role.color,
              permissions: role.permissions,
              managed: role.managed,
              hoist: role.hoist,
              mentionable: role.mentionable,
              lastUpdated: now,
            }));

          // Cache roles with TTL
          if (roles.length > 0) {
            await client.del(key);
            const pipeline = client.multi();
            roles.forEach((role) => {
              pipeline.hSet(key, role.id, JSON.stringify(role));
            });
            await pipeline.exec();
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
      logger.error(`[RedisService] Error getting guild roles for ${guildId}:`, error);
      throw error;
    }
  }

  static async getGuildChannels(guildId: string): Promise<CachedGuildChannel[]> {
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

          // Transform and cache the channels (text, announcement, and voice channels)
          const now = Date.now();
          const channels = channelsData
            .filter((channel) => channel.type !== 1) // Filter out DM channels
            .filter((channel) => [0, 2, 5].includes(channel.type)) // Filter to text, voice, and announcement channels
            .map((channel) => ({
              id: channel.id,
              name: channel.name,
              type: channel.type,
              parent_id: channel.parent_id,
              position: channel.position,
              permission_overwrites: channel.permission_overwrites,
              lastUpdated: now,
            }));

          // Cache channels with TTL
          if (channels.length > 0) {
            await client.del(key);
            const pipeline = client.multi();
            channels.forEach((channel) => {
              pipeline.hSet(key, channel.id, JSON.stringify(channel));
            });
            await pipeline.exec();
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
      const channels = Object.values(entries).map((s) => {
        try {
          return JSON.parse(s);
        } catch (error) {
          logger.error(`[RedisService] Failed to parse channel data: ${s}`, error);
          throw new Error("INVALID_CHANNEL_DATA");
        }
      });

      return channels;
    } catch (error) {
      logger.error(`[RedisService] Error getting guild channels for ${guildId}:`, error);
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
            icon: guildInfo.icon || '',
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
      logger.error(`[RedisService] Error getting guild info for ${guildId}:`, error);
      throw error;
    }
  }

  static async publishGuildEvent(guildId: string, event: unknown) {
    const publisher = this.getPublisher();
    await publisher.publish(
      REDIS_KEYS.GUILD_EVENTS(guildId),
      JSON.stringify(event)
    );
  }

  static async subscribeToGuildEvents(
    guildId: string,
    callback: (message: string) => void
  ) {
    const subscriber = this.getSubscriber();
    await subscriber.subscribe(REDIS_KEYS.GUILD_EVENTS(guildId), callback);
  }

  static async unsubscribeFromGuildEvents(guildId: string) {
    const subscriber = this.getSubscriber();
    await subscriber.unsubscribe(REDIS_KEYS.GUILD_EVENTS(guildId));
  }


  // Helper method to check if a guild is accessible
  static async isGuildAccessible(guildId: string): Promise<boolean> {
    const client = this.getClient();
    return await client.sIsMember(REDIS_KEYS.GUILD_SET, guildId);
  }
}