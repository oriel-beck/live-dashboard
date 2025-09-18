import { Elysia } from "elysia";
import { config } from "../config";
import { guildAccess } from "../middleware/auth";
import { DatabaseService } from "../services/database";
import { DiscordService } from "../services/discord";
import { RedisService } from "../services/redis";
import { logger } from "../utils/logger";

// Helper function to get command permissions with caching
async function getCommandPermissions(guildId: string) {
  const client = RedisService.getClient();
  const cacheKey = `guild:${guildId}:command_permissions`;

  const cached = await client.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      logger.error(
        `[Events] Failed to parse cached command permissions: ${cached}`,
        error
      );
      // If parsing fails, clear the cache and fetch fresh data
      await client.del(cacheKey);
    }
  }

  const permissions = await DiscordService.getCommandPermissions(guildId);

  // Cache for 5 minutes
  await client.setEx(cacheKey, 300, JSON.stringify(permissions));

  return permissions;
}

export const eventRoutes = new Elysia({ prefix: "/guilds" })
  .use(guildAccess)

  // GET /guilds/:guildId/events - Server-Sent Events endpoint
  .get("/:guildId/events", async ({ params, set }) => {
    const { guildId } = params as { guildId: string };

    if (!guildId) {
      set.status = 400;
      return {
        success: false,
        error: "Guild ID is required",
      };
    }

    logger.info(
      `[Events] SSE connection started for guild ${guildId}`
    );

    // Record SSE connection in metrics
    import('../middleware/metrics').then(({ recordSseConnection }) => {
      recordSseConnection(guildId, 'connect');
    }).catch(() => {
      // Ignore metrics errors
    });

    // Use a simpler SSE approach with manual chunking
    const encoder = new TextEncoder();
    let isActive = true;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Initial fetch
          const [guildInfo, roles, channels, commands, commandPermissions] =
            await Promise.all([
              RedisService.getGuildInfo(guildId),
              RedisService.getGuildRoles(guildId),
              RedisService.getGuildChannels(guildId),
              DatabaseService.getDefaultCommandsHierarchical(),
              getCommandPermissions(guildId),
            ]);

          // Send initial payload
          controller.enqueue(
            encoder.encode(
              `event: initial\ndata: ${JSON.stringify({
                guildInfo,
                roles,
                channels,
                commands,
                commandPermissions,
              })}\n\n`
            )
          );

          // Keep-alive pings
          heartbeatInterval = setInterval(() => {
            if (isActive) controller.enqueue(encoder.encode(":keep-alive\n\n"));
          }, 15000);

          // Redis subscription
          await RedisService.subscribeToGuildEvents(guildId, (message) => {
            if (!isActive) return;
            controller.enqueue(
              encoder.encode(`event: update\ndata: ${message}\n\n`)
            );
          });
        } catch (error) {
          console.error(`[Events] Error fetching initial data for guild ${guildId}:`, error);
          controller.enqueue(
            encoder.encode(
              `event: guild_fetch_failed\ndata: ${JSON.stringify({
                guildId,
                error: error instanceof Error ? error.message : "Unknown error",
              })}\n\n`
            )
          );
        }
      },
      cancel() {
        console.log(`[Events] SSE connection cancelled for guild ${guildId}`);
        isActive = false;
        
        // Record SSE disconnection in metrics
        import('../middleware/metrics').then(({ recordSseConnection }) => {
          recordSseConnection(guildId, 'disconnect');
        }).catch(() => {
          // Ignore metrics errors
        });
        
        RedisService.unsubscribeFromGuildEvents(guildId).catch((error) => {
          logger.error(`[Events] Error unsubscribing:`, error);
        });
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    });

    set.headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": config.corsOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Cache-Control",
    };

    return new Response(stream, {
      status: 200,
    });
  });
