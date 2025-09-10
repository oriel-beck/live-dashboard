import { RedisService } from '../services/redis';
import { DatabaseService } from '../services/database';
import { DiscordService } from '../services/discord';
import { RequestHandler, ResponseHandler } from '@nex-app/bun-server';
import { logger } from '../utils/logger';

// Helper function to check if user has access to a guild
async function checkUserGuildAccess(req: RequestHandler, guildId: string): Promise<boolean> {
  const authHeader = req.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  try {
    const token = authHeader.substring(7);
    const userGuilds = await DiscordService.getUserGuilds(token);
    return await DiscordService.checkGuildAccess(guildId, userGuilds);
  } catch (error) {
    req.state.logger.error(`[Events] Error checking user access for guild ${guildId}:`, error);
    return false;
  }
}

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

export async function handleEventsSSE(req: RequestHandler, res: ResponseHandler) {
  const guildId = req.params.path.guildId;

  if (!guildId) {
    res.setStatus(400);
    return res.send({
      success: false,
      error: "Guild ID is required",
    });
  }

  // Check if user has access to this guild
  const hasAccess = await checkUserGuildAccess(req, guildId);
  if (!hasAccess) {
    res.setStatus(403);
    return res.send({
      success: false,
      error: "Access denied to this guild",
    });
  }

  const clientId = req.request.headers.get('x-client-id') || crypto.randomUUID();

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
        req.state.logger.error(`[Events] Error sending initial data for guild ${guildId}:`, error);
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
          req.state.logger.error(`Heartbeat error for client ${clientId}:`, error);
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
          req.state.logger.error(`SSE write error for client ${clientId}:`, error);
          clearInterval(heartbeatInterval);
          controller.close();
        }
      });
    },
    cancel() {
      req.state.logger.debug(`SSE stream cancelled for guild: ${guildId}, client: ${clientId}`);
    }
  });

  // Return the SSE response directly
  return new Response(stream, {
    status: 200,
  });
}
