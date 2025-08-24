import { NextFunction, Response } from 'express';
import { AuthenticatedRequest, User, UserGuild } from '../types';
import { redis } from './redis';
import { DiscordService } from './discord';

export class SessionService {
  // Store user session data
  static async storeUserSession(sessionId: string, userData: {
    user: User;
    guilds: UserGuild[];
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }): Promise<void> {
    const sessionData = {
      user: userData.user,
      guilds: userData.guilds,
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
    const sessionData = await redis.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return null;
    }

    try {
      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Failed to parse session data:', error);
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
      
      // Get fresh guilds with new token
      const freshGuilds = await DiscordService.getUserGuilds(newTokenData.access_token, sessionData.user.id);
      
      // Update session with new token data
      const updatedSessionData = {
        user: sessionData.user,
        guilds: freshGuilds,
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

  // Generate session ID
  static generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Middleware to attach user data to request
  static async attachUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return next();
    }

    try {
      // Check if token needs refresh and refresh if needed
      const sessionData = await SessionService.refreshTokenIfNeeded(sessionId);
      
      if (sessionData) {
        // Filter guilds to only include those the user can manage
        const manageableGuilds = sessionData.guilds.filter(guild => {
          // Check if user is owner (always has access)
          if (guild.owner) {
            return true;
          }

          // Check for required permissions (Administrator or Manage Server)
          const permissions = BigInt(guild.permissions);
          const ADMINISTRATOR = BigInt(1 << 3);
          const MANAGE_GUILD = BigInt(1 << 5);

          return (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
                 (permissions & MANAGE_GUILD) === MANAGE_GUILD;
        });

        req.user = {
          ...sessionData.user,
          guilds: manageableGuilds
        };
        req.sessionId = sessionId;
        req.sessionData = {
          userId: sessionData.user.id,
          accessToken: sessionData.accessToken
        };
      }
    } catch (error) {
      console.error('Error attaching user:', error);
    }

    next();
  }

  // Check if user has access to a guild
  static async hasGuildAccess(userId: string, guildId: string, sessionId: string): Promise<boolean> {
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
