import {
  DiscordLoginRequestSchema,
  DiscordTokenResponse,
  DiscordUser,
  UserGuildSchema,
  UserSchema
} from '@discord-bot/shared-types';
import { Elysia } from 'elysia';
import { config } from '../config';
import { sessionMiddleware } from '../middleware/session';
import { DiscordService } from '../services/discord';
import { SessionService } from '../services/session';
import { logger } from '../utils/logger';
import { withAbort } from '../utils/request-utils';

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
  .get('/discord/callback', async ({ query, set, cookie, request }) => {
    // Use the request signal for cancellation
    const signal = request.signal as AbortSignal | undefined;

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
      
      // Exchange code for token with cancellation support
      const tokenData = await withAbort(
        DiscordService.exchangeCodeForToken(code),
        signal,
        'OAuth token exchange cancelled'
      ) as DiscordTokenResponse;

      if (signal?.aborted) return; // Check after first API call
      
      // Get user info with cancellation support
      const userData = await withAbort(
        DiscordService.getUserInfo(tokenData.access_token),
        signal,
        'User info fetch cancelled'
      ) as DiscordUser;

      if (signal?.aborted) return; // Check after second API call
      
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
      
      // Save session to Redis with cancellation support
      const sessionId = await withAbort(
        SessionService.storeUserSession(sessionData),
        signal,
        'Session storage cancelled'
      );

      if (signal?.aborted) return; // Check after session storage
      
      // Set session cookie
      cookie.session.set({
        value: sessionId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: config.session.maxAge / 1000, // Convert to seconds
        path: '/',
      });
      
      // Redirect to dashboard
      const redirectUrl = state ? decodeURIComponent(state) : `${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard`;
      set.status = 302;
      set.headers['Location'] = redirectUrl;
      return {};
    } catch (error) {
        if (signal?.aborted) {
        logger.debug('[Auth] Request cancelled during OAuth callback');
        return; // Client already disconnected
      }

      logger.error('[Auth] Discord callback error:', error);
      
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
  .get('/user', async ({ cookie, set, request }) => {
    const sessionId = cookie.session?.value;
    
    if (!sessionId) {
      set.status = 401;
      return {
        success: false,
        error: 'Session required',
      };
    }

    // Use the request signal for cancellation
    const signal = request.signal as AbortSignal | undefined;

    try {
      // Get a valid access token (refreshes if needed) with cancellation support
      const accessToken = await withAbort(
        SessionService.getValidAccessToken(sessionId),
        signal,
        'Access token validation cancelled'
      ) as string;
      
      if (!accessToken) {
        set.status = 401;
        return {
          success: false,
          error: 'Invalid or expired session',
        };
      }

      if (signal?.aborted) return; // Check after token validation

      // Get fresh user data from Discord in parallel with cancellation support
      const [userData, userGuilds] = await withAbort(
        Promise.all([
          DiscordService.getUserInfo(accessToken),
          DiscordService.getUserGuilds(accessToken)
        ]),
        signal,
        'User data fetch cancelled'
      ) as [DiscordUser, any[]];

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
        if (signal?.aborted) {
        logger.debug('[Auth] Request cancelled during user info fetch');
        return; // Client already disconnected
      }

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