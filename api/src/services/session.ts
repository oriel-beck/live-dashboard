import { NextFunction, Response } from 'express';
import { AuthenticatedRequest, User, UserGuild } from '../types';
import { redis } from './redis';
import { DiscordService } from './discord';

export class SessionService {
  // Store user session data with partial data only
  static async storeUserSession(sessionId: string, userData: {
    user: User;
    guilds: UserGuild[];
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }): Promise<void> {
    // Save only essential user data (remove sensitive/unnecessary fields)
    const partialUser = {
      id: userData.user.id,
      username: userData.user.username,
      discriminator: userData.user.discriminator,
      avatar: userData.user.avatar,
      // email is intentionally excluded for privacy
    };

    // Save only essential guild data (remove features)
    const partialGuilds = userData.guilds.map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner,
      permissions: guild.permissions,
      botHasAccess: guild.botHasAccess,
      // features field is intentionally excluded
    }));

    const sessionData = {
      user: partialUser,
      guilds: partialGuilds,
      accessToken: userData.accessToken,
      refreshToken: userData.refreshToken,
      expiresAt: Date.now() + (userData.expiresIn * 1000), // Convert seconds to milliseconds
      createdAt: new Date().toISOString(),
    };

    // Store session data in Redis with 7 day expiration
    await redis.setex(
      `session:${sessionId}`, 
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify(sessionData)
    );
  }

  // Retrieve user session data
  static async getUserSession(sessionId: string): Promise<{
    user: User;
    guilds: UserGuild[];
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    createdAt: string;
  } | null> {
    try {
      const sessionData = await redis.get(`session:${sessionId}`);
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Error retrieving session data:', error);
      return null;
    }
  }

  // Refresh access token if expired
  static async refreshTokenIfNeeded(sessionId: string): Promise<{
    user: User;
    guilds: UserGuild[];
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    createdAt: string;
  } | null> {
    const sessionData = await this.getUserSession(sessionId);
    
    if (!sessionData) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (sessionData.expiresAt - now > bufferTime) {
      // Token is still valid, return current session
      return sessionData;
    }

    try {
      console.log('Refreshing expired access token for user:', sessionData.user.id);
      
      // Refresh the access token
      const newTokenData = await DiscordService.refreshAccessToken(sessionData.refreshToken);
      
      // Get fresh guilds with new token (will be partial data)
      const freshGuilds = await DiscordService.getUserGuilds(newTokenData.access_token, sessionData.user.id);
      
      // Update session with new token data (keeping partial data approach)
      const updatedSessionData = {
        user: sessionData.user, // Keep existing partial user data
        guilds: freshGuilds, // Fresh partial guild data
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token,
        expiresAt: Date.now() + (newTokenData.expires_in * 1000),
        createdAt: sessionData.createdAt,
      };

      // Update the session in Redis
      await redis.setex(
        `session:${sessionId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(updatedSessionData)
      );

      return updatedSessionData;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // If refresh fails, clear the session
      await this.clearUserSession(sessionId);
      return null;
    }
  }

  // Clear user session
  static async clearUserSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }

  // Generate a unique session ID
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Attach user to request from session
  static async attachUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return next();
    }

    try {
      // Try to get session data, refreshing token if needed
      const sessionData = await this.refreshTokenIfNeeded(sessionId);
      
      if (sessionData) {
        // Attach user data with guilds to the request
        req.user = {
          ...sessionData.user,
          guilds: sessionData.guilds
        };
        req.sessionId = sessionId;
        req.sessionData = {
          userId: sessionData.user.id,
          accessToken: sessionData.accessToken,
          refreshToken: sessionData.refreshToken,
          expiresAt: sessionData.expiresAt,
        };
      }
    } catch (error) {
      console.error('Error attaching user to request:', error);
      // Clear invalid session
      await this.clearUserSession(sessionId);
    }

    next();
  }

  // Check if user has access to a guild
  static async hasGuildAccess(guildId: string, sessionId: string): Promise<boolean> {
    const sessionData = await SessionService.refreshTokenIfNeeded(sessionId);
    
    if (!sessionData) {
      return false;
    }

    // Check if user has manage permissions for this guild
    const userGuild = sessionData.guilds.find(guild => guild.id === guildId);
    
    if (!userGuild) {
      return false;
    }

    // Check if user is owner (always has access)
    if (userGuild.owner) {
      return true;
    }

    // Check for required permissions
    const permissions = BigInt(userGuild.permissions);
    
    // Permission bits according to Discord API
    const ADMINISTRATOR = BigInt(1 << 3);     // Admin permission (overrides all)
    const MANAGE_GUILD = BigInt(1 << 5);      // Manage Server permission
    
    // User must have either Administrator or Manage Server permission
    return (permissions & ADMINISTRATOR) === ADMINISTRATOR || 
           (permissions & MANAGE_GUILD) === MANAGE_GUILD;
  }
}
