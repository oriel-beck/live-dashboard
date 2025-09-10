import { Elysia } from 'elysia';
import { RedisService } from '../services/redis';
import { DatabaseService } from '../services/database';
import { DiscordService } from '../services/discord';
import { guildAccess } from '../middleware/auth';
import { logger } from '../utils/logger';
import { config } from '../config';

// Helper function to get command permissions with caching
async function getCommandPermissions(guildId: string) {
  const client = RedisService.getClient();
  const cacheKey = `guild:${guildId}:command_permissions`;
  
  const cached = await client.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      logger.error(`[Events] Failed to parse cached command permissions: ${cached}`, error);
      // If parsing fails, clear the cache and fetch fresh data
      await client.del(cacheKey);
    }
  }

  const permissions = await DiscordService.getCommandPermissions(guildId);
  
  // Cache for 5 minutes
  await client.setEx(cacheKey, 300, JSON.stringify(permissions));
  
  return permissions;
}

export const eventRoutes = new Elysia({ prefix: '/guilds' })
  .use(guildAccess)
  
  // GET /guilds/:guildId/events - Server-Sent Events endpoint
  .get('/:guildId/events', async ({ params, headers, set }) => {
    const { guildId } = params as { guildId: string };

    if (!guildId) {
      set.status = 400;
      return {
        success: false,
        error: 'Guild ID is required',
      };
    }

    const clientId = headers['x-client-id'] || crypto.randomUUID();

    // Set SSE headers (including CORS for SSE)
    set.headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': config.corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control, X-Client-ID',
    };

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection confirmation
        const connectEvent = `event: connected\ndata: ${JSON.stringify({ 
          clientId, 
          guildId, 
          timestamp: Date.now() 
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(connectEvent));

        // Send initial data event with all guild data
        try {
          const [guildInfo, roles, channels, commands, commandPermissions] = await Promise.all([
            RedisService.getGuildInfo(guildId),
            RedisService.getGuildRoles(guildId),
            RedisService.getGuildChannels(guildId),
            DatabaseService.getDefaultCommandsHierarchical(),
            getCommandPermissions(guildId)
          ]);

          const initialEvent = `event: initial\ndata: ${JSON.stringify({
            guildInfo,
            roles,
            channels,
            commands,
            commandPermissions
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(initialEvent));
        } catch (error) {
          logger.error(`[Events] Error sending initial data for guild ${guildId}:`, error);
          const errorEvent = `event: guild_fetch_failed\ndata: ${JSON.stringify({
            guildId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorEvent));
        }

        // Set up heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeatEvent = `: heartbeat ${Date.now()}\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeatEvent));
          } catch (error) {
            logger.error(`Heartbeat error for client ${clientId}:`, error);
            clearInterval(heartbeatInterval);
            controller.close();
          }
        }, 30000); // 30 second heartbeat

        // Subscribe to guild events
        RedisService.subscribeToGuildEvents(guildId, (message) => {
          try {
            const updateEvent = `event: update\ndata: ${message}\n\n`;
            controller.enqueue(new TextEncoder().encode(updateEvent));
          } catch (error) {
            logger.error(`SSE write error for client ${clientId}:`, error);
            clearInterval(heartbeatInterval);
            controller.close();
          }
        });
      },
      cancel() {
        logger.debug(`SSE stream cancelled for guild: ${guildId}, client: ${clientId}`);
      }
    });

    // Return the SSE response directly
    return new Response(stream, {
      status: 200,
    });
  });