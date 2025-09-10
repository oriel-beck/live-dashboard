import {
  DiscordLoginRequestSchema,
  UserGuildSchema,
  UserSchema
} from '@discord-bot/shared-types';
import { Elysia } from 'elysia';
import { config } from '../config';
import { authMetrics } from '../middleware/elysia-metrics';
import { sessionMiddleware } from '../middleware/session';
import { DiscordService } from '../services/discord';
import { SessionService } from '../services/session';
import { logger } from '../utils/logger';

export const authPlugin = new Elysia({ name: 'auth', prefix: '/auth' })
  .use(sessionMiddleware)
  // POST /auth/login - Exchange Discord OAuth code for token
  .post('/login', async ({ body, set }) => {
    try {
      const validatedBody = DiscordLoginRequestSchema.parse(body);

      // Exchange code for token
      const tokenData = await DiscordService.exchangeCodeForToken(validatedBody.code);

      // Get user info
      const userData = await DiscordService.getUserInfo(tokenData.access_token);

      // Record successful authentication
      authMetrics.recordAttempt('discord', 'success');

      return {
        success: true,
        data: {
          user: userData,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        },
      };
    } catch (error) {
      logger.error('[Auth] Login error:', error);

      // Record failed authentication
      authMetrics.recordAttempt('discord', 'failure');

      if (error instanceof Error && error.name === 'ZodError') {
        set.status = 400;
        return {
          success: false,
          error: 'Validation failed',
          details: error.message,
        };
      }

      set.status = 401;
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  })
  
  // GET /auth/discord - OAuth redirect endpoint
  .get('/discord', async ({ set }) => {
    try {
      const discordAuthUrl = DiscordService.getDiscordAuthUrl();
      set.status = 302;
      set.headers['Location'] = discordAuthUrl;
      return {};
    } catch (error) {
      logger.error('[Auth] Discord redirect error:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Failed to generate Discord auth URL',
      };
    }
  })
  
  // GET /auth/discord/callback - OAuth callback endpoint
  .get('/discord/callback', async ({ query, set, cookie }) => {
    try {
      const { code, error, state } = query;
      
      if (error) {
        logger.error('[Auth] Discord OAuth error:', error);
        set.status = 302;
        set.headers['Location'] = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/error?error=${encodeURIComponent(error)}`;
        return {};
      }
      
      if (!code) {
        set.status = 302;
        set.headers['Location'] = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/error?error=no_code`;
        return {};
      }
      
      // Exchange code for token
      const tokenData = await DiscordService.exchangeCodeForToken(code);
      
      // Get user info
      const userData = await DiscordService.getUserInfo(tokenData.access_token);
      
      // Create session data
      const sessionData = {
        user: {
          id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar,
          email: userData.email || undefined,
        },
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in, // Use Discord token expiry
        expiresAt: Date.now() + (tokenData.expires_in * 1000), // Convert seconds to milliseconds
      };
      
      // Save session to Redis
      const sessionId = await SessionService.storeUserSession(sessionData);
      
      // Set session cookie
      cookie.session.set({
        value: sessionId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: config.session.maxAge / 1000, // Convert to seconds
        path: '/',
      });
      
      // Record successful authentication
      authMetrics.recordAttempt('discord', 'success');
      
      // Redirect to dashboard
      const redirectUrl = state ? decodeURIComponent(state) : `${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard`;
      set.status = 302;
      set.headers['Location'] = redirectUrl;
      return {};
    } catch (error) {
      logger.error('[Auth] Discord callback error:', error);
      
      // Record failed authentication
      authMetrics.recordAttempt('discord', 'failure');
      
      set.status = 302;
      set.headers['Location'] = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/error?error=callback_failed`;
      return {};
    }
  })
  
  // POST /auth/logout - Logout endpoint (Dashboard needs this)
  .post('/logout', async () => {
    try {
      // Clear any session data if needed
      // For now, just return success
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      logger.error('[Auth] Logout error:', error);
      return {
        success: false,
        error: 'Failed to logout',
      };
    }
  })
  
  // GET /auth/user - Get current user info (Dashboard expects this)
  .get('/user', async ({ cookie, set }) => {
    const sessionId = cookie.session?.value;
    
    if (!sessionId) {
      set.status = 401;
      return {
        success: false,
        error: 'Session required',
      };
    }

    try {
      // Get a valid access token (refreshes if needed)
      const accessToken = await SessionService.getValidAccessToken(sessionId);
      
      if (!accessToken) {
        set.status = 401;
        return {
          success: false,
          error: 'Invalid or expired session',
        };
      }

      // Get fresh user data from Discord
      const userData = await DiscordService.getUserInfo(accessToken);
      const userGuilds = await DiscordService.getUserGuilds(accessToken);

      // Format user data according to UserSchema
      const formattedUser = UserSchema.parse({
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar,
        email: userData.email,
        guilds: userGuilds.map((guild) => UserGuildSchema.parse(guild)),
      });

      return {
        success: true,
        data: formattedUser,
      };
    } catch (error) {
      logger.error('[Auth] User error:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        set.status = 400;
        return {
          success: false,
          error: 'Validation failed',
          details: error.message,
        };
      }

      set.status = 401;
      return {
        success: false,
        error: 'Failed to get user info',
      };
    }
  })
  
  // GET /auth/user/guilds - Get user guilds endpoint (Dashboard needs this)
  .get('/user/guilds', async ({ cookie, set }) => {
    const sessionId = cookie.session?.value;
    
    if (!sessionId) {
      set.status = 401;
      return {
        success: false,
        error: 'Session required',
      };
    }

    try {
      // Get a valid access token (refreshes if needed)
      const accessToken = await SessionService.getValidAccessToken(sessionId);
      
      if (!accessToken) {
        set.status = 401;
        return {
          success: false,
          error: 'Invalid or expired session',
        };
      }

      const userGuilds = await DiscordService.getUserGuilds(accessToken);
      const guilds = userGuilds.map((guild) => UserGuildSchema.parse(guild));

      return {
        success: true,
        data: guilds,
      };
    } catch (error) {
      logger.error('[Auth] User guilds error:', error);

      if (error instanceof Error && error.name === 'ZodError') {
        set.status = 400;
        return {
          success: false,
          error: 'Validation failed',
          details: error.message,
        };
      }

      set.status = 401;
      return {
        success: false,
        error: 'Failed to get user guilds',
      };
    }
  });