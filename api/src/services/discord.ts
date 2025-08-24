import { User, UserGuild } from '../types';
import { config } from '../config';
import { redis } from './redis';

export class DiscordService {
  private static readonly API_BASE = config.discord.apiUrl;
  private static readonly BOT_TOKEN = config.discord.botToken;
  private static readonly GUILD_CACHE_TTL = 5 * 60; // 5 minutes in seconds

  static async sendMessage(channelId: string, content: string) {
    const response = await fetch(`${this.API_BASE}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    return response;
  }

  static async getUserGuilds(accessToken: string, userId: string): Promise<UserGuild[]> {
    // Check cache first
    const cacheKey = `user:${userId}:guilds`;
    const cachedGuilds = await redis.get(cacheKey);
    
    if (cachedGuilds) {
      console.log('Returning cached guilds for user:', userId);
      return JSON.parse(cachedGuilds);
    }

    console.log('Fetching fresh guilds from Discord for user:', userId);
    
    // Fetch fresh guilds from Discord
    const response = await fetch(`${this.API_BASE}/users/@me/guilds`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user guilds');
    }

    const userGuilds = await response.json() as UserGuild[];
    
    // Get bot's guilds from Redis keys (guild:{id} only, not guild:{id}:*)
    // TODO: For large scale (10k+ guilds), consider using a separate guild list cache
    // instead of redis.keys() which is O(N) and can block Redis. Options:
    // 1. Use SCAN with batching for large datasets
    // 2. Maintain bot:guilds:list cache in bot sync-data.ts (recommended)
    // 3. Use Redis Sets with SISMEMBER for O(1) lookups
    const botGuildKeys = await redis.keys('guild:[0-9]*');
    const botGuildKeySet = new Set(botGuildKeys);
    
    // Filter guilds to only include those the bot has access to
    const accessibleGuilds = userGuilds.filter(userGuild => {
      return botGuildKeySet.has(`guild:${userGuild.id}`);
    }).map(guild => ({
      ...guild,
      botHasAccess: true
    }));

    // Cache the filtered guilds for 5 minutes
    await redis.setex(cacheKey, this.GUILD_CACHE_TTL, JSON.stringify(accessibleGuilds));
    
    return accessibleGuilds;
  }

  static async getUserInfo(accessToken: string): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/@me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json() as User;
  }

  static async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.discord.clientId || '',
        client_secret: config.discord.clientSecret || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokenData = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return tokenData;
  }


}
