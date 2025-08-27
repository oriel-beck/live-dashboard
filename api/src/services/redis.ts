import Redis from 'ioredis';
import { config } from '../config';
import { CACHE_TTL, REDIS_KEYS, TIME_CONSTANTS } from '../constants';
import { DiscordService } from './discord';
import { UserGuild, GuildRole, GuildChannel } from '../types';
import { makeRequestWithRetry } from '../utils/request-utils';

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
  static async getGuildRoles(guildId: string) {
    const key = REDIS_KEYS.GUILD_ROLES(guildId);
    
    // Check if data exists and is not expired
    const exists = await redis.exists(key);
    if (exists === 0) {
      // Data doesn't exist, this is a "ghost guild" or data hasn't been loaded yet
      console.warn(`[RedisService] Guild roles not found for guild ${guildId} - may be a ghost guild`);
      return [];
    }

    const entries = await redis.hgetall(key);
    const roles = Object.values(entries).map((s) => JSON.parse(s));
    
    // Check if any role data is stale (older than 1 hour)
    const now = Date.now();
    const oneHourAgo = now - TIME_CONSTANTS.ONE_HOUR;
    const hasStaleData = roles.some((role: any) => 
      !role.lastUpdated || role.lastUpdated < oneHourAgo
    );

    if (hasStaleData) {
      console.log(`[RedisService] Guild ${guildId} has stale role data, consider refreshing`);
    }

    return roles;
  }

  static async getGuildChannels(guildId: string) {
    const key = REDIS_KEYS.GUILD_CHANNELS(guildId);
    
    // Check if data exists and is not expired
    const exists = await redis.exists(key);
    if (exists === 0) {
      // Data doesn't exist, this is a "ghost guild" or data hasn't been loaded yet
      console.warn(`[RedisService] Guild channels not found for guild ${guildId} - may be a ghost guild`);
      return [];
    }

    const entries = await redis.hgetall(key);
    const channels = Object.values(entries).map((s) => JSON.parse(s));
    
    // Check if any channel data is stale (older than 1 hour)
    const now = Date.now();
    const oneHourAgo = now - TIME_CONSTANTS.ONE_HOUR;
    const hasStaleData = channels.some((channel: any) => 
      !channel.lastUpdated || channel.lastUpdated < oneHourAgo
    );

    if (hasStaleData) {
      console.log(`[RedisService] Guild ${guildId} has stale channel data, consider refreshing`);
    }

    return channels;
  }

  static async getGuildInfo(guildId: string) {
    const key = REDIS_KEYS.GUILD_INFO(guildId);
    
    // Check if data exists and is not expired
    const exists = await redis.exists(key);
    if (exists === 0) {
      // Data doesn't exist, this is a "ghost guild" or data hasn't been loaded yet
      console.warn(`[RedisService] Guild info not found for guild ${guildId} - may be a ghost guild`);
      return {};
    }

    const guildInfo = await redis.hgetall(key);
    
    // Check if guild data is stale (older than 24 hours)
    const lastUpdated = guildInfo.lastUpdated;
    if (lastUpdated) {
      const now = Date.now();
      const twentyFourHoursAgo = now - TIME_CONSTANTS.TWENTY_FOUR_HOURS;
      if (parseInt(lastUpdated) < twentyFourHoursAgo) {
        console.log(`[RedisService] Guild ${guildId} has stale data (last updated: ${new Date(parseInt(lastUpdated)).toISOString()})`);
      }
    }

    return guildInfo;
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
      console.log(`[RedisService] Returning cached guild data for ${guildId}`);
      return {
        guildInfo,
        roles: await this.getGuildRoles(guildId),
        channels: await this.getGuildChannels(guildId),
      };
    }

    // Data missing -> try to fetch data
    console.log(`[RedisService] Guild data missing for ${guildId}, attempting to fetch...`);
    try {
      const fetchedData = await this.fetchGuildDataFromBot(guildId);
      
      // Data fetch works -> cache the new data with TTL -> return the data
      await this.cacheGuildData(guildId, fetchedData);
      console.log(`[RedisService] Successfully fetched and cached guild data for ${guildId}`);
      
      return {
        guildInfo: fetchedData.guildInfo,
        roles: fetchedData.roles,
        channels: fetchedData.channels,
      };
    } catch (error) {
      // Data fetch fails -> remove the guild from the set
      console.error(`[RedisService] Failed to fetch guild data for ${guildId}:`, error);
      await this.removeGuildFromSet(guildId);
      throw new Error('GUILD_FETCH_FAILED');
    }
  }

  // Helper method to fetch guild data from bot
  private static async fetchGuildDataFromBot(guildId: string): Promise<{
    guildInfo: any;
    roles: any[];
    channels: any[];
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
        lastUpdated: Date.now(),
      };

      const roles = rolesData.map((role: any) => ({
        id: role.id,
        name: role.name,
        position: role.position,
        color: role.color,
        permissions: role.permissions,
        managed: role.managed,
        lastUpdated: Date.now(),
      }));

      const channels = channelsData
        .filter((channel: any) => channel.type !== 1) // Filter out DM channels
        .map((channel: any) => ({
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
    } catch (error: any) {
      console.error(`[RedisService] Error fetching guild data for ${guildId}:`, error);
      throw new Error(`Failed to fetch guild data from Discord API: ${error.message || 'Unknown error'}`);
    }
  }

  // Helper method to cache guild data with TTL
  private static async cacheGuildData(guildId: string, data: any) {
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
      
      data.roles.forEach((role: any) => {
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
      
      data.channels.forEach((channel: any) => {
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
    console.log(`[RedisService] Removed guild ${guildId} from guild set due to fetch failure`);
  }

  static async publishGuildEvent(guildId: string, event: any) {
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

  // New method to check if guild data is stale
  static async isGuildDataStale(guildId: string): Promise<boolean> {
    return await DiscordService.isGuildDataStale(guildId);
  }

  // New method to get all guild IDs from the bot's guild set
  static async getAllGuildIds(): Promise<string[]> {
    return await redis.smembers(REDIS_KEYS.GUILD_SET);
  }

  // New method to get stale guilds (guilds not updated in the last 24 hours)
  static async getStaleGuilds(): Promise<string[]> {
    const allGuildIds = await this.getAllGuildIds();
    const staleGuilds: string[] = [];

    for (const guildId of allGuildIds) {
      const isStale = await this.isGuildDataStale(guildId);
      if (isStale) {
        staleGuilds.push(guildId);
      }
    }

    return staleGuilds;
  }
}
