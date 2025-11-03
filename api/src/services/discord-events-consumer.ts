import {
  RabbitMQService,
  EXCHANGE_NAMES,
  Message,
  REDIS_KEYS,
  CACHE_TTL,
  SSE_EVENT_TYPES,
  SSEEvent,
  GuildApplicationCommandPermissions,
  logger,
} from "@discord-bot/shared-types";
import { RedisService } from "./redis";
import { sseRegistry } from "./sse-registry";

/**
 * Service for consuming Discord events from RabbitMQ
 * Handles both cache updates and SSE broadcasting
 */
export class DiscordEventsConsumer {
  private rabbitMQ: RabbitMQService;
  private isInitialized = false;
  private activeGuildConsumers = new Map<string, () => void>();

  constructor(rabbitMQ: RabbitMQService) {
    this.rabbitMQ = rabbitMQ;
  }

  /**
   * Initialize the consumer service
   * Creates a persistent queue for cache updates
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("[DiscordEventsConsumer] Already initialized");
      return;
    }

    try {
      // Start persistent consumer for cache updates
      await this.startCacheUpdateConsumer();

      this.isInitialized = true;
      logger.info("[DiscordEventsConsumer] Initialized successfully");
    } catch (error) {
      logger.error("[DiscordEventsConsumer] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Start a persistent consumer for cache updates
   * This queue always exists and processes all events for cache updates
   * Also broadcasts to SSE connections if they exist
   */
  private async startCacheUpdateConsumer(): Promise<void> {
    // Subscribe to all guild events (routing key pattern: guild.*)
    // This will create a persistent subscription that processes all events
    await this.rabbitMQ.subscribeToMessages(
      EXCHANGE_NAMES.DISCORD_EVENTS,
      async (message: Message) => {
        try {
          // Update cache
          await this.processEventForCache(message);

          // Also broadcast to SSE if connections exist
          await this.processEventForSSE(message);
        } catch (error) {
          logger.error(
            `[DiscordEventsConsumer] Error processing event:`,
            error
          );
          // Don't throw - let RabbitMQ handle retries
        }
      },
      "guild.*" // Routing key pattern for all guild events
    );

    logger.info(
      `[DiscordEventsConsumer] Started cache update and SSE broadcast consumer`
    );
  }

  /**
   * Start a per-guild consumer for SSE broadcasting
   * Called when first SSE connection is registered for a guild
   * Note: Currently not used since we broadcast from main consumer
   * Kept for future optimization if needed
   */
  async startGuildConsumer(guildId: string): Promise<void> {
    // No-op for now - SSE broadcasting happens in main consumer
    // This is kept for future optimization if we want per-guild queues
    logger.debug(
      `[DiscordEventsConsumer] startGuildConsumer called for ${guildId} (no-op, using main consumer)`
    );
  }

  /**
   * Stop the consumer for a guild
   * Note: Currently no-op since we use main consumer
   */
  stopGuildConsumer(guildId: string): void {
    // No-op for now
    logger.debug(
      `[DiscordEventsConsumer] stopGuildConsumer called for ${guildId} (no-op)`
    );
  }

  /**
   * Process event for cache updates
   */
  private async processEventForCache(message: Message): Promise<void> {
    const { type, payload } = message;

    switch (type) {
      case SSE_EVENT_TYPES.GUILD_UPDATE: {
        const { guildId, data } = payload;
        const client = RedisService.getClient();
        const key = REDIS_KEYS.GUILD_INFO(guildId);

        await client.hSet(key, {
          id: data.id,
          name: data.name,
          icon: data.icon || "",
          owner_id: data.owner_id,
        });
        await client.expire(key, CACHE_TTL.GUILD_BASICS);

        logger.debug(
          `[DiscordEventsConsumer] Updated cache for guild ${guildId}`
        );
        break;
      }

      case SSE_EVENT_TYPES.GUILD_DELETE: {
        const { guildId } = payload;
        const client = RedisService.getClient();

        // Remove from guild set
        await client.sRem(REDIS_KEYS.GUILD_SET, guildId);

        // Remove cached data
        await client.del([
          REDIS_KEYS.GUILD_INFO(guildId),
          REDIS_KEYS.GUILD_ROLES(guildId),
          REDIS_KEYS.GUILD_CHANNELS(guildId),
          REDIS_KEYS.GUILD_COMMAND_PERMISSIONS(guildId),
        ]);

        logger.debug(
          `[DiscordEventsConsumer] Removed cache for guild ${guildId}`
        );
        break;
      }

      case SSE_EVENT_TYPES.ROLE_CREATE:
      case SSE_EVENT_TYPES.ROLE_UPDATE: {
        const { guildId, data } = payload;
        const client = RedisService.getClient();
        const key = REDIS_KEYS.GUILD_ROLES(guildId);

        // Only update cache if it already exists (roles are cached on-demand)
        const cacheExists = await client.exists(key);
        if (cacheExists) {
          await client.hSet(key, data.id, JSON.stringify(data));
          await client.expire(key, CACHE_TTL.GUILD_ROLES);
          logger.debug(
            `[DiscordEventsConsumer] Updated role cache for guild ${guildId}, role ${data.id}`
          );
        }
        break;
      }

      case SSE_EVENT_TYPES.ROLE_DELETE: {
        const { guildId, roleId } = payload;
        const client = RedisService.getClient();
        const key = REDIS_KEYS.GUILD_ROLES(guildId);

        // Only update cache if it already exists
        const cacheExists = await client.exists(key);
        if (cacheExists) {
          await client.hDel(key, roleId);
          logger.debug(
            `[DiscordEventsConsumer] Removed role from cache for guild ${guildId}, role ${roleId}`
          );
        }
        break;
      }

      case SSE_EVENT_TYPES.CHANNEL_CREATE:
      case SSE_EVENT_TYPES.CHANNEL_UPDATE: {
        const { guildId, data } = payload;
        const client = RedisService.getClient();
        const key = REDIS_KEYS.GUILD_CHANNELS(guildId);

        // Only update cache if it already exists (channels are cached on-demand)
        const cacheExists = await client.exists(key);
        if (cacheExists) {
          await client.hSet(key, data.id, JSON.stringify(data));
          await client.expire(key, CACHE_TTL.GUILD_CHANNELS);
          logger.debug(
            `[DiscordEventsConsumer] Updated channel cache for guild ${guildId}, channel ${data.id}`
          );
        }
        break;
      }

      case SSE_EVENT_TYPES.CHANNEL_DELETE: {
        const { guildId, channelId } = payload;
        const client = RedisService.getClient();
        const key = REDIS_KEYS.GUILD_CHANNELS(guildId);

        // Only update cache if it already exists
        const cacheExists = await client.exists(key);
        if (cacheExists) {
          await client.hDel(key, channelId);
          logger.debug(
            `[DiscordEventsConsumer] Removed channel from cache for guild ${guildId}, channel ${channelId}`
          );
        }
        break;
      }

      case SSE_EVENT_TYPES.COMMAND_PERMISSIONS_UPDATE: {
        const { guildId, commandId, permissions } = payload;
        const client = RedisService.getClient();
        const cacheKey = REDIS_KEYS.GUILD_COMMAND_PERMISSIONS(guildId);

        const guildPermissions = await client.get(cacheKey);
        if (guildPermissions) {
          const parsedPermissions = JSON.parse(
            guildPermissions
          ) as GuildApplicationCommandPermissions[];

          const updatedPermissions = parsedPermissions.map((permission) => {
            if (permission.id === commandId) {
              return { ...permission, permissions };
            }
            return permission;
          });

          await client.setEx(
            cacheKey,
            CACHE_TTL.COMMAND_PERMISSIONS,
            JSON.stringify(updatedPermissions)
          );

          logger.debug(
            `[DiscordEventsConsumer] Updated command permissions cache for guild ${guildId}`
          );
        }
        break;
      }

      default:
        // Member permissions and other events don't need cache updates
        break;
    }
  }

  /**
   * Process event for SSE broadcasting
   */
  private async processEventForSSE(message: Message): Promise<void> {
    const { type, payload } = message;

    // Extract guildId from payload
    const guildId = payload.guildId;

    if (!guildId) {
      // Some events might not have guildId (e.g., user events)
      // Skip SSE broadcast for those
      return;
    }

    // Check if there are active SSE connections for this guild
    if (!sseRegistry.hasConnections(guildId)) {
      // No active connections, skip broadcasting
      return;
    }

    // Convert RabbitMQ message to SSE event format
    const sseEvent: SSEEvent = {
      type: type as any,
      ...payload,
    } as SSEEvent;

    // Broadcast to all SSE connections for this guild
    sseRegistry.broadcast(guildId, sseEvent);
  }

  /**
   * Get number of active guild consumers
   */
  getActiveConsumerCount(): number {
    return this.activeGuildConsumers.size;
  }
}
