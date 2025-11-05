import { Elysia } from 'elysia';
import { SessionService } from '../services/session';
import { logger } from '@discord-bot/services';

export const sessionMiddleware = new Elysia({ name: 'session' })
  .derive(async ({ cookie, set }) => {
    const sessionId = cookie.session?.value;
    
    if (!sessionId) {
      return {
        session: null,
        user: null,
        isAuthenticated: false,
      };
    }

    try {
      // Just get the session data without refreshing tokens
      const session = await SessionService.getUserSession(sessionId);
      
      if (!session) {
        return {
          session: null,
          user: null,
          isAuthenticated: false,
        };
      }

      return {
        session,
        user: session.user,
        isAuthenticated: true,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      };
    } catch (error) {
      logger.error('[Session] Error getting session:', error);
      return {
        session: null,
        user: null,
        isAuthenticated: false,
      };
    }
  });
