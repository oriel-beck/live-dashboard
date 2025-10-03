import {
  APIGuildChannel,
  APIGuildMember,
  APIUser,
  BotProfile,
  BotProfileSchema,
  CACHE_TTL,
  CommandPermissionsUpdate,
  DiscordTokenResponse,
  DiscordTokenResponseSchema,
  DiscordUser,
  DiscordUserSchema,
  Guild,
  GuildApplicationCommandPermissions,
  GuildRole,
  GuildSchema,
  REDIS_KEYS,
  UserGuild,
} from "@discord-bot/shared-types";
import { config } from "../config";
import { logger } from "../utils/logger";
import { makeRequestWithRetry } from "../utils/request-utils";
import { RedisService } from "./redis";

export class DiscordService {
  /**
   * Get Discord OAuth authorization URL
   */
  static getDiscordAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: config.discord.clientId!,
      redirect_uri: config.discord.redirectUri,
      response_type: "code",
      scope: "identify guilds",
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  static async exchangeCodeForToken(
    code: string
  ): Promise<DiscordTokenResponse> {
    try {
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: config.discord.clientId!,
          client_secret: config.discord.clientSecret!,
          grant_type: "authorization_code",
          code,
          redirect_uri: config.discord.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Discord OAuth error: ${response.status} ${response.statusText}`
        );
      }

      const tokenData = await response.json();
      return DiscordTokenResponseSchema.parse(tokenData);
    } catch (error) {
      logger.error("[DiscordService] Error exchanging code for token:", error);
      throw error;
    }
  }

  /**
   * Get user information from Discord API
   */
  static async getUserInfo(accessToken: string): Promise<DiscordUser> {
    try {
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Discord API error: ${response.status} ${response.statusText}`
        );
      }

      const userData = await response.json();
      return DiscordUserSchema.parse(userData);
    } catch (error) {
      logger.error("[DiscordService] Error getting user info:", error);
      throw error;
    }
  }

  /**
   * Get user's guilds from Discord API
   */
  static async getUserGuilds(accessToken: string): Promise<UserGuild[]> {
    try {
      const response = await makeRequestWithRetry<UserGuild[]>(
        "https://discord.com/api/users/@me/guilds",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        "Discord getUserGuilds",
        3,
        1000
      );

      // First filter by user permissions
      const guildsWithPermissions = response.filter((guild) => {
        if (guild.owner) {
          return true;
        }

        const permissions = parseInt(guild.permissions);
        const hasAdministrator = (permissions & 0x8) === 0x8; // Administrator permission
        const hasManageServer = (permissions & 0x20) === 0x20; // Manage Server permission

        return hasAdministrator || hasManageServer;
      });

      // Batch check which guilds the bot is in using SMISMEMBER (single Redis call)
      const botGuildChecks = await RedisService.getClient().smIsMember(
        REDIS_KEYS.GUILD_SET,
        guildsWithPermissions.map((g) => g.id)
      );

      // Filter to only include guilds where bot is present
      const manageableGuilds = guildsWithPermissions.filter((guild, index) => {
        const isBotInGuild = botGuildChecks[index];

        if (isBotInGuild) {
          logger.debug(
            `[DiscordService] Guild ${guild.name} (${guild.id}): User has permissions and bot is present`
          );
          return true;
        } else {
          logger.debug(
            `[DiscordService] Guild ${guild.name} (${guild.id}): User has permissions but bot is not present`
          );
          return false;
        }
      });

      logger.debug(
        `[DiscordService] Filtered ${response.length} guilds to ${manageableGuilds.length} manageable guilds`
      );

      return manageableGuilds;
    } catch (error) {
      logger.error("[DiscordService] Error getting user guilds:", error);
      throw error;
    }
  }

  /**
   * Get guild information from Discord API
   */
  static async getGuildInfo(guildId: string): Promise<Guild> {
    try {
      const response = await makeRequestWithRetry(
        `${config.discord.apiUrl}/guilds/${guildId}`,
        {
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getGuildInfo ${guildId}`,
        3,
        1000
      );

      return GuildSchema.parse(response);
    } catch (error) {
      logger.error(
        `[DiscordService] Error getting guild info for ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get guild roles from Discord API
   */
  static async getGuildRoles(
    guildId: string
  ): Promise<(GuildRole & { managed: boolean })[]> {
    try {
      const response = await makeRequestWithRetry<
        (GuildRole & { managed: boolean })[]
      >(
        `${config.discord.apiUrl}/guilds/${guildId}/roles`,
        {
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getGuildRoles ${guildId}`,
        3,
        1000
      );

      return response.filter((role) => !role.managed);
    } catch (error) {
      logger.error(
        `[DiscordService] Error getting guild roles for ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get guild channels from Discord API
   */
  static async getGuildChannels(guildId: string): Promise<APIGuildChannel<any>[]> {
    try {
      const response = await makeRequestWithRetry<APIGuildChannel<any>[]>(
        `${config.discord.apiUrl}/guilds/${guildId}/channels`,
        {
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getGuildChannels ${guildId}`,
        3,
        1000
      );

      return response;
    } catch (error) {
      logger.error(
        `[DiscordService] Error getting guild channels for ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get command permissions for a guild
   */
  static async getCommandPermissions(
    guildId: string
  ): Promise<GuildApplicationCommandPermissions[]> {
    try {
      const response = await makeRequestWithRetry<
        GuildApplicationCommandPermissions[]
      >(
        `${config.discord.apiUrl}/applications/${config.discord.clientId}/guilds/${guildId}/commands/permissions`,
        {
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getCommandPermissions ${guildId}`,
        3,
        1000
      );

      return response;
    } catch (error) {
      logger.error(
        `[DiscordService] Error getting command permissions for ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update command permissions for a specific command in a guild
   */
  static async updateCommandPermissions(
    guildId: string,
    commandId: string,
    permissions: CommandPermissionsUpdate
  ): Promise<GuildApplicationCommandPermissions> {
    try {
      const response = await makeRequestWithRetry(
        `${config.discord.apiUrl}/applications/${config.discord.clientId}/guilds/${guildId}/commands/${commandId}/permissions`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(permissions),
        },
        `Discord updateCommandPermissions ${guildId}/${commandId}`,
        3,
        1000
      );

      return response as any;
    } catch (error) {
      logger.error(
        `[DiscordService] Error updating command permissions for ${guildId}/${commandId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Check if user has permission to access guild
   */
  static checkGuildAccess(
    guildId: string,
    userGuilds: UserGuild[]
  ): boolean {
    return userGuilds.some((guild) => guild.id === guildId);
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string
  ): Promise<DiscordTokenResponse> {
    try {
      const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: config.discord.clientId!,
          client_secret: config.discord.clientSecret!,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Discord OAuth refresh error: ${response.status} ${response.statusText}`
        );
      }

      const tokenData = await response.json();
      return DiscordTokenResponseSchema.parse(tokenData);
    } catch (error) {
      logger.error("[DiscordService] Error refreshing access token:", error);
      throw error;
    }
  }

  /**
   * Get bot profile data with caching
   */
  static async getBotProfile(guildId: string, signal?: AbortSignal): Promise<BotProfile> {
    const client = RedisService.getClient();
    const cacheKey = REDIS_KEYS.BOT_PROFILE(guildId);

    // Try to get from cache first
    const cached = await client.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return BotProfileSchema.parse(parsed);
      } catch (error) {
        logger.error(
          `[DiscordService] Failed to parse cached bot profile: ${cached}`,
          error
        );
        // If parsing fails, clear the cache and fetch fresh data
        await client.del(cacheKey);
      }
    }

    try {
      // Now get the bot's guild member info and guild roles in parallel
      const [guildMemberResponse, guildRoles] = await Promise.all([
        fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${config.discord.clientId}`,
          {
            headers: {
              Authorization: `Bot ${config.discord.botToken}`,
              "Content-Type": "application/json",
            },
            signal,
          }
        ),
        this.getGuildRoles(guildId)
      ]);

      if (!guildMemberResponse.ok) {
        throw new Error(
          `Could not fetch bot guild member for ${guildId}: ${guildMemberResponse.status} ${guildMemberResponse.statusText}`
        );
      }

      const guildMember: APIGuildMember = await guildMemberResponse.json();
      const memberUser: APIUser = guildMember.user;

      // Calculate bot permissions from roles
      const botPermissions = this.calculateBotGuildPermissions(guildId, guildMember, guildRoles);

      // Calculate avatar URL
      let avatarUrl: string | null = null;
      if (guildMember.avatar) {
        avatarUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${memberUser.id}/avatars/${guildMember.avatar}.webp?size=512`;
      } else if (memberUser.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${memberUser.id}/${memberUser.avatar}.webp?size=512`;
      }

      // Calculate banner URL
      let bannerUrl: string | null = null;
      if (guildMember.banner) {
        bannerUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${memberUser.id}/banners/${guildMember.banner}.webp?size=1024`;
      } else if (memberUser.banner) {
        bannerUrl = `https://cdn.discordapp.com/banners/${memberUser.id}/${memberUser.banner}.webp?size=1024`;
      }

      const botProfile: BotProfile = {
        nickname: guildMember.nick ?? null,
        globalName: memberUser.global_name ?? null,
        username: memberUser.username,
        avatar: avatarUrl,
        banner: bannerUrl,
        permissions: botPermissions.toString(),
      };

      // Cache for 10 minutes
      await client.setEx(
        cacheKey,
        CACHE_TTL.BOT_PROFILE,
        JSON.stringify(botProfile)
      );

      return botProfile;
    } catch (error) {
      logger.error(
        `[DiscordService] Error getting bot profile for guild ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get bot's guild member info
   */
  static async getBotGuildMember(guildId: string): Promise<APIGuildMember | null> {
    try {
      // First get the bot's user ID
      const botUserResponse = await fetch(
        `https://discord.com/api/v10/users/@me`,
        {
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!botUserResponse.ok) {
        logger.debug(`[DiscordService] Could not fetch bot user info: ${botUserResponse.status}`);
        return null;
      }

      const botUser: APIUser = await botUserResponse.json();

      // Now get the bot's guild member info
      const guildMemberResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${botUser.id}`,
        {
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!guildMemberResponse.ok) {
        logger.debug(`[DiscordService] Could not fetch bot guild member for ${guildId}: ${guildMemberResponse.status}`);
        return null;
      }

      return await guildMemberResponse.json();
    } catch (error) {
      logger.debug(`[DiscordService] Error getting bot guild member for ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Calculate bot's permissions for a specific channel
   */
  static calculateChannelPermissions(channel: APIGuildChannel<any>, botMember: APIGuildMember, guildRoles: (GuildRole & { managed: boolean })[]): bigint {
    try {
      // Calculate base permissions from bot's roles
      let permissions = 0n;
      const botRoleIds = botMember.roles || [];
      
      // Add permissions from each role the bot has
      for (const roleId of botRoleIds) {
        const role = guildRoles.find(r => r.id === roleId);
        if (role) {
          permissions |= BigInt(role.permissions);
        }
      }
      
      // Add @everyone role permissions
      const everyoneRole = guildRoles.find(r => r.id === channel.guild_id);
      if (everyoneRole) {
        permissions |= BigInt(everyoneRole.permissions);
      }
      
      // Apply channel-specific overwrites
      if (channel.permission_overwrites) {
        for (const overwrite of channel.permission_overwrites) {
          // Check if this overwrite applies to the bot
          if (overwrite.id === channel.guild_id || botRoleIds.includes(overwrite.id)) {
            permissions &= ~BigInt(overwrite.deny || 0); // Remove denied permissions
            permissions |= BigInt(overwrite.allow || 0);  // Add allowed permissions
          }
        }
      }
      
      return permissions;
    } catch (error) {
      logger.debug(`[DiscordService] Error calculating channel permissions:`, error);
      return 0n;
    }
  }

  /**
   * Calculate bot's permissions in a guild based on its roles
   */
  static calculateBotGuildPermissions(guildId: string, guildMember: APIGuildMember, guildRoles: (GuildRole & { managed: boolean })[]): bigint {
    let permissions = 0n;
    
    // Get bot's role IDs
    const botRoleIds = guildMember.roles || [];
    
    // Add permissions from each role the bot has
    for (const roleId of botRoleIds) {
      const role = guildRoles.find(r => r.id === roleId);
      if (role) {
        permissions |= BigInt(role.permissions);
      }
    }
    
    // Add @everyone role permissions (usually 0, but some guilds might have basic permissions)
    // The @everyone role ID is the same as the guild ID
    const everyoneRole = guildRoles.find(r => r.id === guildId);
    if (everyoneRole) {
      permissions |= BigInt(everyoneRole.permissions);
    }
    
    return permissions;
  }

  /**
   * Update bot guild profile and cache the result
   */
  static async updateBotProfile(
    guildId: string,
    updates: {
      avatar?: string | null;
      banner?: string | null;
      nick?: string | null;
    }
  ): Promise<BotProfile> {
    try {
      // Update the bot's guild member profile via Discord API
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/@me`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${config.discord.botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to update bot guild member: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      // Immediately refresh the cache with fresh data and return the updated profile
      const updatedProfile = await this.refreshBotProfileCache(guildId);

      logger.info(
        `[DiscordService] Updated bot guild member profile for guild ${guildId}`
      );
      return updatedProfile;
    } catch (error) {
      logger.error(
        `[DiscordService] Error updating bot guild member for guild ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Refresh bot profile cache by fetching latest data
   */
  static async refreshBotProfileCache(guildId: string): Promise<BotProfile> {
    try {
      // Fetch fresh data and cache it
      const profile = await this.getBotProfile(guildId);
      logger.info(
        `[DiscordService] Refreshed bot profile cache for guild ${guildId}`
      );
      return profile;
    } catch (error) {
      logger.error(
        `[DiscordService] Error refreshing bot profile cache for guild ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Invalidate bot profile cache for a guild (fallback method)
   */
  static async invalidateBotProfileCache(guildId: string): Promise<void> {
    const client = RedisService.getClient();
    const cacheKey = REDIS_KEYS.BOT_PROFILE(guildId);
    await client.del(cacheKey);
    logger.info(
      `[DiscordService] Invalidated bot profile cache for guild ${guildId}`
    );
  }
}
