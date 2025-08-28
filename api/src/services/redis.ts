import Redis from 'ioredis';
import { config } from '../config';
import { CACHE_TTL, REDIS_KEYS } from '../constants';
import { DiscordService } from './discord';
import { UserGuild, GuildRole, GuildChannel, CachedGuildRole, CachedGuildChannel, CachedGuildInfo } from '../types';
import { makeRequestWithRetry } from '../utils/request-utils';
import logger from '../utils/logger';

// Redis client for data operations
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

// Redis client for pub/sub (separate connection)
export const redisPublisher = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

// Redis client for subscriptions (separate connection)
export const redisSubscriber = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

export class RedisService {
  static async getGuildRoles(guildId: string): Promise<CachedGuildRole[]> {
    const key = REDIS_KEYS.GUILD_ROLES(guildId);
    
    // Check if data exists and is not expired
    const exists = await redis.exists(key);
    if (exists === 0) {
      // Data doesn't exist, try to fetch it
      logger.info(`[RedisService] Guild roles not found for guild ${guildId}, attempting to fetch...`);
      try {
        const rolesData = await makeRequestWithRetry<GuildRole[]>(
          `${config.discord.apiUrl}/guilds/${guildId}/roles`,
          {
            headers: {
              'Authorization': `Bot ${config.discord.botToken}`,
              'Content-Type': 'application/json',
            },
          },
          `guild roles (guild ${guildId})`
        );

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
            lastUpdated: now,
          }));

        // Cache roles with TTL
        if (roles.length > 0) {
          const pipeline = redis.pipeline().del(key);
          roles.forEach((role) => {
            pipeline.hset(key, role.id, JSON.stringify(role));
          });
          await pipeline.exec();
          await redis.expire(key, CACHE_TTL.GUILD_ROLES);
        }

        // Add guild to guild set
        await redis.sadd(REDIS_KEYS.GUILD_SET, guildId);
        
        logger.info(`[RedisService] Successfully fetched and cached guild roles for ${guildId}`);
        return roles;
      } catch (error) {
        logger.error(`[RedisService] Failed to fetch guild roles for ${guildId}:`, error);
        throw new Error('GUILD_ROLES_FETCH_FAILED');
      }
    }

    const entries = await redis.hgetall(key);
    const roles = Object.values(entries).map((s) => JSON.parse(s));
    
    return roles;
  }

  static async getGuildChannels(guildId: string): Promise<CachedGuildChannel[]> {
    const key = REDIS_KEYS.GUILD_CHANNELS(guildId);
    
    // Check if data exists and is not expired
    const exists = await redis.exists(key);
    if (exists === 0) {
      // Data doesn't exist, try to fetch it
      logger.info(`[RedisService] Guild channels not found for guild ${guildId}, attempting to fetch...`);
      try {
        const channelsData = await makeRequestWithRetry<GuildChannel[]>(
          `${config.discord.apiUrl}/guilds/${guildId}/channels`,
          {
            headers: {
              'Authorization': `Bot ${config.discord.botToken}`,
              'Content-Type': 'application/json',
            },
          },
          `guild channels (guild ${guildId})`
        );

        // Transform and cache the channels (text, announcement, and voice channels)
        const now = Date.now();
        const channels = channelsData
          .filter((channel) => channel.type !== 1) // Filter out DM channels
          .filter((channel) => [0, 2, 5].includes(channel.type)) // Filter to text, voice, and announcement channels
          .map((channel) => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parentId: channel.parent_id,
            position: channel.position,
            lastUpdated: now,
          }));

        // Cache channels with TTL
        if (channels.length > 0) {
          const pipeline = redis.pipeline().del(key);
          channels.forEach((channel) => {
            pipeline.hset(key, channel.id, JSON.stringify(channel));
          });
          await pipeline.exec();
          await redis.expire(key, CACHE_TTL.GUILD_CHANNELS);
        }

        // Add guild to guild set
        await redis.sadd(REDIS_KEYS.GUILD_SET, guildId);
        
        logger.info(`[RedisService] Successfully fetched and cached guild channels for ${guildId}`);
        return channels;
      } catch (error) {
        logger.error(`[RedisService] Failed to fetch guild channels for ${guildId}:`, error);
        throw new Error('GUILD_CHANNELS_FETCH_FAILED');
      }
    }

    const entries = await redis.hgetall(key);
    const channels = Object.values(entries).map((s) => JSON.parse(s));
    
    return channels;
  }

  static async getGuildInfo(guildId: string): Promise<CachedGuildInfo> {
    const key = REDIS_KEYS.GUILD_INFO(guildId);
    
    // Check if data exists and is not expired
    const exists = await redis.exists(key);
    if (exists === 0) {
      // Data doesn't exist, try to fetch it
      logger.info(`[RedisService] Guild info not found for guild ${guildId}, attempting to fetch...`);
      try {
        const guildData = await makeRequestWithRetry<UserGuild>(
          `${config.discord.apiUrl}/guilds/${guildId}`,
          {
            headers: {
              'Authorization': `Bot ${config.discord.botToken}`,
              'Content-Type': 'application/json',
            },
          },
          `guild data (guild ${guildId})`
        );

        // Transform and cache the guild info
        const now = Date.now();
        const guildInfo = {
          id: guildData.id,
          name: guildData.name,
          icon: guildData.icon,
          owner: guildData.owner,
          lastUpdated: now,
        };

        // Cache guild info with TTL
        await redis.hset(key, Object.entries(guildInfo).flat());
        await redis.expire(key, CACHE_TTL.GUILD_BASICS);

        // Add guild to guild set
        await redis.sadd(REDIS_KEYS.GUILD_SET, guildId);
        
        logger.info(`[RedisService] Successfully fetched and cached guild info for ${guildId}`);
        return guildInfo;
      } catch (error) {
        logger.error(`[RedisService] Failed to fetch guild info for ${guildId}:`, error);
        throw new Error('GUILD_INFO_FETCH_FAILED');
      }
    }

    const guildInfo = await redis.hgetall(key);
    
    return {
      id: guildInfo.id || '',
      name: guildInfo.name || '',
      icon: guildInfo.icon || null,
      owner: guildInfo.owner === 'true',
      lastUpdated: parseInt(guildInfo.lastUpdated || '0'),
    };
  }

  // New method for lazy loading guild data with proper error handling
  static async getGuildDataWithLazyLoad(guildId: string) {
    // First check if guild is accessible (exists in bot's guild set)
    const isAccessible = await this.isGuildAccessible(guildId);
    if (!isAccessible) {
      throw new Error('GUILD_NOT_ACCESSIBLE');
    }

    // Check if guild data exists
    const guildInfo = await this.getGuildInfo(guildId);
    const hasData = Object.keys(guildInfo).length > 0;

    if (hasData) {
      // Data exists -> return data
      // Returning cached guild data - removed verbose logging
      return {
        guildInfo,
        roles: await this.getGuildRoles(guildId),
        channels: await this.getGuildChannels(guildId),
      };
    }

    // Data missing -> try to fetch data
    logger.info(`[RedisService] Guild data missing for ${guildId}, attempting to fetch...`);
    try {
      const fetchedData = await this.fetchGuildDataFromBot(guildId);
      
      // Data fetch works -> cache the new data with TTL -> return the data
      await this.cacheGuildData(guildId, fetchedData);
      logger.info(`[RedisService] Successfully fetched and cached guild data for ${guildId}`);
      
      return {
        guildInfo: fetchedData.guildInfo,
        roles: fetchedData.roles,
        channels: fetchedData.channels,
      };
    } catch (error) {
      // Data fetch fails -> remove the guild from the set
      logger.error(`[RedisService] Failed to fetch guild data for ${guildId}:`, error);
      await this.removeGuildFromSet(guildId);
      throw new Error('GUILD_FETCH_FAILED');
    }
  }

  // Helper method to fetch guild data from bot
  private static async fetchGuildDataFromBot(guildId: string): Promise<{
    guildInfo: CachedGuildInfo;
    roles: CachedGuildRole[];
    channels: CachedGuildChannel[];
  }> {
    try {
      // Make all requests concurrently, but each has its own retry logic
      const [guildData, rolesData, channelsData] = await Promise.all([
        makeRequestWithRetry<UserGuild>(
          `${config.discord.apiUrl}/guilds/${guildId}`,
          {
            headers: {
              'Authorization': `Bot ${config.discord.botToken}`,
              'Content-Type': 'application/json',
            },
          },
          `guild data (guild ${guildId})`
        ),
        makeRequestWithRetry<GuildRole[]>(
          `${config.discord.apiUrl}/guilds/${guildId}/roles`,
          {
            headers: {
              'Authorization': `Bot ${config.discord.botToken}`,
              'Content-Type': 'application/json',
            },
          },
          `guild roles (guild ${guildId})`
        ),
        makeRequestWithRetry<GuildChannel[]>(
          `${config.discord.apiUrl}/guilds/${guildId}/channels`,
          {
            headers: {
              'Authorization': `Bot ${config.discord.botToken}`,
              'Content-Type': 'application/json',
            },
          },
          `guild channels (guild ${guildId})`
        ),
      ]);

      // Transform the data to match our expected format
      const guildInfo = {
        id: guildData.id,
        name: guildData.name,
        icon: guildData.icon,
        owner: guildData.owner,
        permissions: guildData.permissions,
        lastUpdated: Date.now(),
      };

      const roles = rolesData
        .filter((role) => !role.managed) // Filter out managed roles
        .map((role) => ({
          id: role.id,
          name: role.name,
          position: role.position,
          color: role.color,
          permissions: role.permissions,
          managed: role.managed,
          lastUpdated: Date.now(),
        }));

      const channels = channelsData
        .filter((channel) => channel.type !== 1) // Filter out DM channels
        .filter((channel) => [0, 2, 5].includes(channel.type)) // Filter to text, voice, and announcement channels
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parentId: channel.parent_id,
          position: channel.position,
          lastUpdated: Date.now(),
        }));

      return {
        guildInfo,
        roles,
        channels,
      };
    } catch (error: unknown) {
      logger.error(`[RedisService] Error fetching guild data for ${guildId}:`, error);
      throw new Error(`Failed to fetch guild data from Discord API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to cache guild data with TTL
  private static async cacheGuildData(guildId: string, data: {
    guildInfo: CachedGuildInfo;
    roles: CachedGuildRole[];
    channels: CachedGuildChannel[];
  }) {
    const now = Date.now();
    
    // Cache guild basics with TTL
    const guildInfo = {
      ...data.guildInfo,
      lastUpdated: now,
    };
    await redis.hset(REDIS_KEYS.GUILD_INFO(guildId), Object.entries(guildInfo).flat());
    await redis.expire(REDIS_KEYS.GUILD_INFO(guildId), CACHE_TTL.GUILD_BASICS);

    // Cache roles with TTL
    if (data.roles && data.roles.length > 0) {
      const rolesKey = REDIS_KEYS.GUILD_ROLES(guildId);
      const pipeline = redis.pipeline().del(rolesKey);
      
      data.roles.forEach((role) => {
        pipeline.hset(rolesKey, role.id, JSON.stringify({
          ...role,
          lastUpdated: now,
        }));
      });
      
      await pipeline.exec();
      await redis.expire(rolesKey, CACHE_TTL.GUILD_ROLES);
    }

    // Cache channels with TTL
    if (data.channels && data.channels.length > 0) {
      const channelsKey = REDIS_KEYS.GUILD_CHANNELS(guildId);
      const pipeline = redis.pipeline().del(channelsKey);
      
      data.channels.forEach((channel) => {
        pipeline.hset(channelsKey, channel.id, JSON.stringify({
          ...channel,
          lastUpdated: now,
        }));
      });
      
      await pipeline.exec();
      await redis.expire(channelsKey, CACHE_TTL.GUILD_CHANNELS);
    }
  }

  // Helper method to remove guild from set
  private static async removeGuildFromSet(guildId: string) {
    await redis.srem(REDIS_KEYS.GUILD_SET, guildId);
    logger.warn(`[RedisService] Removed guild ${guildId} from guild set due to fetch failure`);
  }

  static async publishGuildEvent(guildId: string, event: unknown) {
    await redisPublisher.publish(
      REDIS_KEYS.GUILD_EVENTS(guildId),
      JSON.stringify(event)
    );
  }

  static async subscribeToGuildEvents(guildId: string, callback: (message: string) => void) {
    await redisSubscriber.subscribe(REDIS_KEYS.GUILD_EVENTS(guildId));
    redisSubscriber.on('message', (_channel, message) => {
      callback(message);
    });
  }

  static async unsubscribeFromGuildEvents(guildId: string) {
    await redisSubscriber.unsubscribe(REDIS_KEYS.GUILD_EVENTS(guildId));
  }

  // New method to check if a guild is accessible (exists in bot's guild set)
  static async isGuildAccessible(guildId: string): Promise<boolean> {
    return await DiscordService.isGuildAccessible(guildId);
  }

  // New method to get guild last update time
  static async getGuildLastUpdate(guildId: string): Promise<number | null> {
    return await DiscordService.getGuildLastUpdate(guildId);
  }

  // New method to get all guild IDs from the bot's guild set
  static async getAllGuildIds(): Promise<string[]> {
    return await redis.smembers(REDIS_KEYS.GUILD_SET);
  }
}
