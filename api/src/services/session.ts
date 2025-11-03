import { RedisService } from "./redis";
import { DiscordService } from "./discord";
import { User, logger } from "@discord-bot/shared-types";

export class SessionService {
  // Store user session data with partial data only
  static async storeUserSession(
    userData: {
      user: User;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      expiresAt: number;
    }
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    // Save only essential user data (remove sensitive/unnecessary fields)
    const partialUser = {
      id: userData.user.id,
      username: userData.user.username,
      discriminator: userData.user.discriminator,
      avatar: userData.user.avatar,
    };

    const sessionData = {
      user: partialUser,
      accessToken: userData.accessToken,
      refreshToken: userData.refreshToken,
      expiresAt: userData.expiresAt,
      createdAt: new Date().toISOString(),
    };

    // Store session data in Redis with 7 day TTL (session lifetime)
    // The expiresAt field within sessionData is for Discord token expiry (~1 hour)
    const client = RedisService.getClient();
    await client.setEx(
      `session:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days session TTL
      JSON.stringify(sessionData)
    );

    return sessionId;
  }

  // Retrieve user session data
  static async getUserSession(sessionId: string): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    createdAt: string;
  } | null> {
    try {
      const client = RedisService.getClient();
      const sessionData = await client.get(`session:${sessionId}`);
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      logger.error("Error retrieving session data:", error);
      return null;
    }
  }

  // Refresh access token if expired
  static async refreshTokenIfNeeded(sessionId: string): Promise<{
    user: any;
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
    const timeUntilExpiry = sessionData.expiresAt - now;

    if (timeUntilExpiry > bufferTime) {
      // Token is still valid, return current session
      logger.debug(`Token still valid for user ${sessionData.user.id}, expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
      return sessionData;
    }

    try {
      logger.debug(
        "Refreshing expired access token for user:",
        sessionData.user.id
      );

      // Refresh the access token using Discord's refresh token
      const newTokenData = await DiscordService.refreshAccessToken(sessionData.refreshToken);

      // Update session with new token data
      const updatedSessionData = {
        user: sessionData.user, // Keep existing user data
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token,
        expiresAt: Date.now() + (newTokenData.expires_in * 1000), // Convert seconds to milliseconds
        createdAt: sessionData.createdAt,
      };

      // Update the session in Redis
      const client = RedisService.getClient();
      await client.setEx(
        `session:${sessionId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(updatedSessionData)
      );

      logger.debug("Successfully refreshed access token for user:", sessionData.user.id);
      return updatedSessionData;
    } catch (error) {
      logger.error("Failed to refresh token:", error);
      // If refresh fails, clear the session
      await this.clearUserSession(sessionId);
      return null;
    }
  }

  // Get a valid access token (refreshes if needed)
  static async getValidAccessToken(sessionId: string): Promise<string | null> {
    const sessionData = await this.refreshTokenIfNeeded(sessionId);
    return sessionData?.accessToken || null;
  }

  // Clear user session
  static async clearUserSession(sessionId: string): Promise<void> {
    const client = RedisService.getClient();
    await client.del(`session:${sessionId}`);
  }

  // Generate a unique session ID
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

}
