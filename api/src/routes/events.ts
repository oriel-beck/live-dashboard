import { Elysia } from "elysia";
import { config } from "../config";
import { guildAccess } from "../middleware/auth";
import { DatabaseService } from "../services/database";
import { DiscordService } from "../services/discord";
import { RedisService } from "../services/redis";
import { logger } from "../utils/logger";
import { withAbort } from "../utils/request-utils";

// Helper function to get command permissions with caching
async function getCommandPermissions(guildId: string, signal?: AbortSignal) {
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

  const permissions = await withAbort(DiscordService.getCommandPermissions(guildId), signal, 'Discord command permissions fetch cancelled');

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
    const cleanup: (() => void)[] = []; // Store cleanup functions

    const stream = new ReadableStream({
      async start(controller) {
        // AbortController to cancel ongoing requests when stream closes
        const abortController = new AbortController();
        const { signal } = abortController;
        
        // Store the abort controller for cleanup
        cleanup.push(() => abortController.abort());
        
        // Helper function to send individual data events
        const sendDataEvent = (eventType: string, data: any) => {
          if (signal.aborted || !isActive) return;
          controller.enqueue(
            encoder.encode(
              `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        };

        try {
          // Start all operations in parallel and send results as they complete
          const operations = [
            {
              name: 'guild_info',
              promise: withAbort(RedisService.getGuildInfo(guildId), signal, 'Guild info fetch cancelled')
                .then(result => {
                  sendDataEvent('guild_info_loaded', { guildInfo: result });
                  return result;
                }).catch(error => {
                  if (signal.aborted) return null;
                  logger.error(`[Events] Error fetching guild info for ${guildId}:`, error);
                  sendDataEvent('guild_info_failed', { error: error.message });
                  return null;
                })
            },
            {
              name: 'roles',
              promise: withAbort(RedisService.getGuildRoles(guildId), signal, 'Guild roles fetch cancelled')
                .then(result => {
                  sendDataEvent('roles_loaded', { roles: result });
                  return result;
                }).catch(error => {
                  if (signal.aborted) return [];
                  logger.error(`[Events] Error fetching roles for ${guildId}:`, error);
                  sendDataEvent('roles_failed', { error: error.message });
                  return [];
                })
            },
            {
              name: 'channels',
              promise: withAbort(RedisService.getGuildChannels(guildId), signal, 'Guild channels fetch cancelled')
                .then(result => {
                  sendDataEvent('channels_loaded', { channels: result });
                  return result;
                }).catch(error => {
                  if (signal.aborted) return [];
                  logger.error(`[Events] Error fetching channels for ${guildId}:`, error);
                  sendDataEvent('channels_failed', { error: error.message });
                  return [];
                })
            },
            {
              name: 'commands',
              promise: withAbort(DatabaseService.getDefaultCommandsHierarchical(), signal, 'Commands fetch cancelled')
                .then(result => {
                  sendDataEvent('commands_loaded', { commands: result });
                  return result;
                }).catch(error => {
                  if (signal.aborted) return [];
                  logger.error(`[Events] Error fetching commands:`, error);
                  sendDataEvent('commands_failed', { error: error.message });
                  return [];
                })
            },
            {
              name: 'command_permissions',
              promise: withAbort(getCommandPermissions(guildId, signal), signal, 'Command permissions fetch cancelled')
                .then(result => {
                  sendDataEvent('command_permissions_loaded', { commandPermissions: result });
                  return result;
                }).catch(error => {
                  if (signal.aborted) return [];
                  logger.error(`[Events] Error fetching command permissions for ${guildId}:`, error);
                  sendDataEvent('command_permissions_failed', { error: error.message });
                  return [];
                })
            }
          ];

          // Start all operations and wait for all to complete
          await Promise.allSettled(operations.map(op => op.promise));

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
        
        // Execute all cleanup functions (including AbortController)
        cleanup.forEach(fn => {
          try {
            fn();
          } catch (error) {
            logger.error(`[Events] Error during cleanup:`, error);
          }
        });
        
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
