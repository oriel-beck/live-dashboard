import { User, UserGuild } from "../types";
import { config } from "../config";
import { redis } from "./redis";
import { REDIS_KEYS, CACHE_TTL, TIME_CONSTANTS } from "../constants";
import logger from "../utils/logger";

export class DiscordService {
  private static readonly API_BASE = config.discord.apiUrl;
  private static readonly BOT_TOKEN = config.discord.botToken;

  static async sendMessage(channelId: string, content: string) {
    const response = await fetch(
      `${this.API_BASE}/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${this.BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      }
    );

    return response;
  }

  static async getUserGuilds(
    accessToken: string,
    userId: string
  ): Promise<UserGuild[]> {
    // Check cache first
    const cacheKey = REDIS_KEYS.USER_GUILDS(userId);
    const cachedGuilds = await redis.get(cacheKey);

    if (cachedGuilds) {
      // Returning cached guilds
      return JSON.parse(cachedGuilds);
    }

    // Fetch fresh guilds from Discord
    const response = await fetch(`${this.API_BASE}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user guilds");
    }

    const userGuilds = (await response.json()) as UserGuild[];
    const userGuildIds = userGuilds.map((guild) => guild.id);

    const sharedGuildsExists = await redis.smismember(
      REDIS_KEYS.GUILD_SET,
      userGuildIds
    );
    const sharedGuildIdSet = new Set(
      userGuildIds.filter((_guildId, i) => sharedGuildsExists[i] === 1)
    );

    // Filter guilds to only include those the bot has access to
    // Remove features and only keep essential data
    const accessibleGuilds = userGuilds
      .filter((userGuild) => sharedGuildIdSet.has(userGuild.id))
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
        permissions: guild.permissions,
        botHasAccess: true, // All filtered guilds have bot access
      }));



    // Cache the filtered guilds for 5 minutes
    await redis.setex(
      cacheKey,
      CACHE_TTL.USER_GUILDS,
      JSON.stringify(accessibleGuilds)
    );

    return accessibleGuilds;
  }

  static async getUserInfo(accessToken: string): Promise<User> {
    const response = await fetch(`${this.API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    return (await response.json()) as User;
  }

  static async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.discord.clientId || "",
        client_secret: config.discord.clientSecret || "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh access token");
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return tokenData;
  }

  // New method to check if a guild exists in the bot's guild set
  static async isGuildAccessible(guildId: string): Promise<boolean> {
    const result = await redis.sismember(REDIS_KEYS.GUILD_SET, guildId);
    return result === 1;
  }

  // New method to get guild last update time
  static async getGuildLastUpdate(guildId: string): Promise<number | null> {
    const lastUpdated = await redis.hget(
      REDIS_KEYS.GUILD_INFO(guildId),
      "lastUpdated"
    );
    return lastUpdated ? parseInt(lastUpdated) : null;
  }

  // New method to check if guild data is stale (older than 24 hours)
  static async isGuildDataStale(guildId: string): Promise<boolean> {
    const lastUpdate = await this.getGuildLastUpdate(guildId);
    if (!lastUpdate) return true;

    const twentyFourHoursAgo = Date.now() - TIME_CONSTANTS.TWENTY_FOUR_HOURS;
    return lastUpdate < twentyFourHoursAgo;
  }
}
