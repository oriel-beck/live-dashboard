import { Elysia } from 'elysia';
import { DatabaseService } from '../services/database';
import { botAuth } from '../middleware/auth';
import { 
  DefaultCommandRegistrationSchema
} from '@discord-bot/shared-types';
import { logger } from '../utils/logger';

export const commandPlugin = new Elysia({ name: 'command' })
  // Bot-only command registration routes
  .group('/commands', (app) => app
    .use(botAuth)
    // POST /commands/register - Register a default command (Bot only)
    .post('/register', async ({ body, set }) => {
      try {
        const validatedCommand = DefaultCommandRegistrationSchema.parse(body);
        
        // Register the command in the database
        const result = await DatabaseService.upsertDefaultCommand(validatedCommand);
        
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('[Commands] Registration error:', error);

        if (error instanceof Error && error.name === 'ZodError') {
          set.status = 400;
          return {
            success: false,
            error: 'Validation failed',
            details: error.message,
          };
        }

        set.status = 500;
        return {
          success: false,
          error: 'Failed to register command',
        };
      }
    })
  );
