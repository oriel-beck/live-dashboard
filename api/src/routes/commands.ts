import { Elysia } from 'elysia';
import { DatabaseService } from '../services/database';
import { botAuth } from '../middleware/auth';
import { 
  DefaultCommandRegistrationSchema,
  logger
} from '@discord-bot/shared-types';

export const commandPlugin = new Elysia({ name: 'command' })
  // Bot-only command registration routes
  .group('/commands', (app) => app
    .use(botAuth)
    // GET /commands - Get all commands with file paths (Bot only)
    .get('/', async ({ set }) => {
      try {
        const commands = await DatabaseService.getDefaultCommandsHierarchical();
        
        return {
          success: true,
          data: commands,
        };
      } catch (error) {
        logger.error('[Commands] Error fetching commands:', error);
        
        set.status = 500;
        return {
          success: false,
          error: 'Failed to fetch commands',
        };
      }
    })
    // POST /commands/register - Register a default command (Bot only)
    .post('/register', async ({ body, set }) => {
      console.log('[Commands] Raw body:', JSON.stringify(body, null, 2));
      console.log('[Commands] Body keys:', Object.keys(body || {}));
      console.log('[Commands] Body filePath:', (body as any)?.filePath);
      try {
        const validatedCommand = DefaultCommandRegistrationSchema.parse(body);
        console.log('[Commands] Validated command:', validatedCommand);
        
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
