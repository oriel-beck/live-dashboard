import {
  ApplicationCommandPermission,
  CACHE_TTL,
  DiscordApplicationCommand,
  GuildApplicationCommandPermissions,
  REDIS_KEYS,
} from "@discord-bot/shared-types";
import { config } from "../config";
import { User, UserGuild } from "../types";
import { RedisService } from "./redis";
import { SessionService } from "./session";

export class DiscordService {
  private static readonly API_BASE = config.discord.apiUrl;
  private static readonly BOT_TOKEN = config.discord.botToken;

  static async getUserGuilds(sessionId: string): Promise<UserGuild[]> {
    // Get session data with automatic refresh if needed
    const sessionData = await SessionService.refreshTokenIfNeeded(sessionId);
    
    if (!sessionData || !sessionData.accessToken) {
      throw new Error("Invalid session - please re-authenticate");
    }

    // Check cache first
    const cacheKey = REDIS_KEYS.USER_GUILDS(sessionData.user.id);
    const cachedGuilds = await RedisService.withRedisConnection((redis) => redis.get(cacheKey));

    if (cachedGuilds) {
      // Returning cached guilds
      return JSON.parse(cachedGuilds);
    }

    // Fetch fresh guilds from Discord
    const response = await fetch(`${this.API_BASE}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${sessionData.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user guilds");
    }

    const userGuilds = (await response.json()) as UserGuild[];
    const userGuildIds = userGuilds.map((guild) => guild.id);

    const sharedGuildsExists = await RedisService.withRedisConnection((redis) => redis.smismember(
      REDIS_KEYS.GUILD_SET,
      userGuildIds
    ));
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
    await RedisService.withRedisConnection((redis) => redis.setex(
      cacheKey,
      CACHE_TTL.USER_GUILDS,
      JSON.stringify(accessibleGuilds)
    ));


    return accessibleGuilds;
  }

  static async getUserInfo(sessionId: string): Promise<User> {
    // Get session data with automatic refresh if needed
    const sessionData = await SessionService.refreshTokenIfNeeded(sessionId);
    if (!sessionData || !sessionData.accessToken) {
      throw new Error("Invalid session - please re-authenticate");
    }

    return this.getUserInfoWithToken(sessionData.accessToken);
  }

  static async getUserInfoWithToken(accessToken: string): Promise<User> {
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
    const result = await RedisService.withRedisConnection((redis) => redis.sismember(
      REDIS_KEYS.GUILD_SET,
      guildId
    ));
    return result === 1;
  }

  // New method to get guild last update time
  static async getGuildLastUpdate(guildId: string): Promise<number | null> {
    const lastUpdated = await RedisService.withRedisConnection((redis) => redis.hget(
      REDIS_KEYS.GUILD_INFO(guildId),
      "lastUpdated"
    ));
    return lastUpdated ? parseInt(lastUpdated) : null;
  }

  // Get application command permissions for a guild
  static async getGuildApplicationCommandPermissions(
    guildId: string
  ): Promise<GuildApplicationCommandPermissions[]> {
    const cacheKey = REDIS_KEYS.GUILD_COMMAND_PERMISSIONS(guildId);
    const cached = await RedisService.withRedisConnection((redis) => redis.get(cacheKey));

    if (cached) {
      return JSON.parse(cached);
    }

    const response = await fetch(
      `${this.API_BASE}/applications/${config.discord.clientId}/guilds/${guildId}/commands/permissions`,
      {
        headers: {
          Authorization: `Bot ${this.BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch command permissions: ${response.status} ${response.statusText}`
      );
    }

    const permissions =
      (await response.json()) as GuildApplicationCommandPermissions[];

    // Cache for 5 minutes
    await RedisService.withRedisConnection((redis) => redis.setex(cacheKey, 300, JSON.stringify(permissions)));

    return permissions;
  }

  // Get application command permissions for a specific command
  static async getCommandPermissions(
    guildId: string,
    commandId: string
  ): Promise<GuildApplicationCommandPermissions | null> {
    const allPermissions = await this.getGuildApplicationCommandPermissions(
      guildId
    );
    return allPermissions.find((p) => p.id === commandId) || null;
  }

  // Update application command permissions
  // NOTE: This method requires a Bearer token with applications.commands.permissions.update scope
  // Bot tokens cannot be used to update command permissions according to Discord API docs
  // The user must have:
  // - Manage Guild and Manage Roles permissions in the guild
  // - Ability to run the command being edited
  // - Permission to manage the resources that will be affected
  static async updateCommandPermissions(
    guildId: string,
    commandId: string,
    permissions: ApplicationCommandPermission[],
    sessionId: string
  ): Promise<GuildApplicationCommandPermissions> {
    // Get session data with automatic refresh if needed
    const sessionData = await SessionService.refreshTokenIfNeeded(sessionId);
    if (!sessionData || !sessionData.accessToken) {
      throw new Error("Invalid session - please re-authenticate");
    }

    const response = await fetch(
      `${this.API_BASE}/applications/${config.discord.clientId}/guilds/${guildId}/commands/${commandId}/permissions`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionData.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ permissions }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update command permissions: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result =
      (await response.json()) as GuildApplicationCommandPermissions;

    // Invalidate cache
    const cacheKey = REDIS_KEYS.GUILD_COMMAND_PERMISSIONS(guildId);
    await RedisService.withRedisConnection((redis) => redis.del(cacheKey));

    return result;
  }

  // Delete application command permissions
  static async deleteCommandPermissions(
    guildId: string,
    commandId: string,
    sessionId: string
  ): Promise<void> {
    // Get session data with automatic refresh if needed
    const sessionData = await SessionService.refreshTokenIfNeeded(sessionId);
    if (!sessionData || !sessionData.accessToken) {
      throw new Error("Invalid session - please re-authenticate");
    }

    const response = await fetch(
      `${this.API_BASE}/applications/${config.discord.clientId}/guilds/${guildId}/commands/${commandId}/permissions`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionData.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete command permissions: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Invalidate cache
    const cacheKey = REDIS_KEYS.GUILD_COMMAND_PERMISSIONS(guildId);
    await RedisService.withRedisConnection((redis) => redis.del(cacheKey));
  }

  // Get guild application commands (to get command IDs)
  static async getGuildApplicationCommands(
    guildId: string
  ): Promise<DiscordApplicationCommand[]> {
    const response = await fetch(
      `${this.API_BASE}/applications/${config.discord.clientId}/guilds/${guildId}/commands`,
      {
        headers: {
          Authorization: `Bot ${this.BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch guild commands: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as DiscordApplicationCommand[];
  }
}
