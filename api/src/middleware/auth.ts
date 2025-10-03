import { Elysia } from 'elysia';
import { DiscordService } from '../services/discord';
import { logger } from '../utils/logger';


// Auth middleware for bot authentication
export const botAuth = new Elysia({ name: 'botAuth' })
  .derive(async ({ headers, set }) => {
    const authHeader = headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return {
        error: 'Authorization header required',
        isBot: false,
        token: null
      };
    }

    try {
      const token = authHeader.substring(7);
      
      // Check if token is the bot token
      if (token === process.env.BOT_TOKEN) {
        return {
          isBot: true,
          token,
          error: null
        };
      }
      
      set.status = 401;
      return {
        error: 'Invalid bot token',
        isBot: false,
        token: null
      };
    } catch (error) {
      logger.error('[Auth] Bot authentication failed:', error);
      set.status = 401;
      return {
        error: 'Invalid bot token',
        isBot: false,
        token: null
      };
    }
  });

// Guild access middleware - checks if user has access to a specific guild
export const guildAccess = new Elysia({ name: 'guildAccess' })
  .derive(async ({ headers, params, set }) => {
    const authHeader = headers.authorization;
    const guildId = (params as any).guildId;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return {
        error: 'Authorization header required',
        hasAccess: false
      };
    }

    try {
      const token = authHeader.substring(7);
      
      // Check if it's bot token (bot bypasses guild access checks)
      if (token === process.env.BOT_TOKEN) {
        return {
          hasAccess: true,
          error: null
        };
      }
      
      // For user tokens, check guild access
      const userGuilds = await DiscordService.getUserGuilds(token);
      const hasAccess = DiscordService.checkGuildAccess(guildId, userGuilds);
      
      if (!hasAccess) {
        set.status = 403;
        return {
          error: 'Access denied to this guild',
          hasAccess: false
        };
      }
      
      return {
        hasAccess: true,
        error: null
      };
    } catch (error) {
      logger.error(`[Auth] Guild access check failed for guild ${guildId}:`, error);
      set.status = 403;
      return {
        error: 'Failed to verify guild access',
        hasAccess: false
      };
    }
  });
