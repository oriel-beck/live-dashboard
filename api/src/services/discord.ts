import { config } from '../config';
import { logger } from '../utils/logger';
import { makeRequestWithRetry } from '../utils/request-utils';
import { RedisService } from './redis';
import { 
  DiscordUserSchema, 
  DiscordTokenResponseSchema,
  DiscordTokenResponse,
  DiscordUser,
  UserGuild,
  Guild,
  GuildRole,
  GuildChannel,
  GuildApplicationCommandPermissions,
  CommandPermissionsUpdate,
  GuildSchema,
  REDIS_KEYS
} from '@discord-bot/shared-types';

export class DiscordService {
  /**
   * Get Discord OAuth authorization URL
   */
  static getDiscordAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: config.discord.clientId!,
      redirect_uri: config.discord.redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
    });
    
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  static async exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.discord.clientId!,
          client_secret: config.discord.clientSecret!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.discord.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord OAuth error: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      return DiscordTokenResponseSchema.parse(tokenData);
    } catch (error) {
      logger.error('[DiscordService] Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Get user information from Discord API
   */
  static async getUserInfo(accessToken: string): Promise<DiscordUser> {
    try {
      const response = await fetch('https://discord.com/api/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      const userData = await response.json();
      return DiscordUserSchema.parse(userData);
    } catch (error) {
      logger.error('[DiscordService] Error getting user info:', error);
      throw error;
    }
  }

  /**
   * Get user's guilds from Discord API
   */
  static async getUserGuilds(accessToken: string): Promise<UserGuild[]> {
    try {
      const response = await makeRequestWithRetry<UserGuild[]>(
        'https://discord.com/api/users/@me/guilds',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        },
        'Discord getUserGuilds',
        3,
        1000
      );

      // First filter by user permissions
      const guildsWithPermissions = response.filter(guild => {
        if (guild.owner) {
          return true;
        }
        
        const permissions = parseInt(guild.permissions);
        const hasAdministrator = (permissions & 0x8) === 0x8; // Administrator permission
        const hasManageServer = (permissions & 0x20) === 0x20; // Manage Server permission
        
        return hasAdministrator || hasManageServer;
      });
      
      // Batch check which guilds the bot is in using SMISMEMBER (single Redis call)
      const botGuildChecks = await RedisService.getClient().smIsMember(REDIS_KEYS.GUILD_SET, guildsWithPermissions.map(g => g.id));
      
      // Filter to only include guilds where bot is present
      const manageableGuilds = guildsWithPermissions.filter((guild, index) => {
        const isBotInGuild = botGuildChecks[index];
        
        if (isBotInGuild) {
          logger.debug(`[DiscordService] Guild ${guild.name} (${guild.id}): User has permissions and bot is present`);
          return true;
        } else {
          logger.debug(`[DiscordService] Guild ${guild.name} (${guild.id}): User has permissions but bot is not present`);
          return false;
        }
      });

      logger.debug(`[DiscordService] Filtered ${response.length} guilds to ${manageableGuilds.length} manageable guilds`);
      
      return manageableGuilds;
    } catch (error) {
      logger.error('[DiscordService] Error getting user guilds:', error);
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
            'Authorization': `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getGuildInfo ${guildId}`,
        3,
        1000
      );

      return GuildSchema.parse(response);
    } catch (error) {
      logger.error(`[DiscordService] Error getting guild info for ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get guild roles from Discord API
   */
  static async getGuildRoles(guildId: string): Promise<GuildRole[]> {
    try {
      const response = await makeRequestWithRetry<GuildRole[]>(
        `${config.discord.apiUrl}/guilds/${guildId}/roles`,
        {
          headers: {
            'Authorization': `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getGuildRoles ${guildId}`,
        3,
        1000
      );

      return response;
    } catch (error) {
      logger.error(`[DiscordService] Error getting guild roles for ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get guild channels from Discord API
   */
  static async getGuildChannels(guildId: string): Promise<GuildChannel[]> {
    try {
      const response = await makeRequestWithRetry<GuildChannel[]>(
        `${config.discord.apiUrl}/guilds/${guildId}/channels`,
        {
          headers: {
            'Authorization': `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getGuildChannels ${guildId}`,
        3,
        1000
      );

      return response;
    } catch (error) {
      logger.error(`[DiscordService] Error getting guild channels for ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get command permissions for a guild
   */
  static async getCommandPermissions(guildId: string): Promise<GuildApplicationCommandPermissions[]> {
    try {
      const response = await makeRequestWithRetry<GuildApplicationCommandPermissions[]>(
        `${config.discord.apiUrl}/applications/${config.discord.clientId}/guilds/${guildId}/commands/permissions`,
        {
          headers: {
            'Authorization': `Bot ${config.discord.botToken}`,
          },
        },
        `Discord getCommandPermissions ${guildId}`,
        3,
        1000
      );

      return response;
    } catch (error) {
      logger.error(`[DiscordService] Error getting command permissions for ${guildId}:`, error);
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
          method: 'PUT',
          headers: {
            'Authorization': `Bot ${config.discord.botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(permissions),
        },
        `Discord updateCommandPermissions ${guildId}/${commandId}`,
        3,
        1000
      );

      return response as any;
    } catch (error) {
      logger.error(`[DiscordService] Error updating command permissions for ${guildId}/${commandId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has permission to access guild
   */
  static async checkGuildAccess(guildId: string, userGuilds: UserGuild[]): Promise<boolean> {
    return userGuilds.some(guild => guild.id === guildId);
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse> {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.discord.clientId!,
          client_secret: config.discord.clientSecret!,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord OAuth refresh error: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      return DiscordTokenResponseSchema.parse(tokenData);
    } catch (error) {
      logger.error('[DiscordService] Error refreshing access token:', error);
      throw error;
    }
  }
}
