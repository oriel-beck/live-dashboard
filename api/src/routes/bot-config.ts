import {
  BotConfigUpdateRequestSchema,
  BotConfigResponseSchema,
  SSE_EVENT_TYPES,
  RabbitMQService,
  EXCHANGE_NAMES,
  logger,
} from "@discord-bot/shared-types";
import { Elysia } from "elysia";
import { combinedAuth } from "../middleware/auth";
import { DiscordService } from "../services/discord";
import { sseRegistry } from "../services/sse-registry";
import { withAbort } from "../utils/request-utils";

export const botConfigPlugin = new Elysia({
  name: "bot-config",
  prefix: "/guilds/:guildId/bot-config",
})
  .use(combinedAuth)
  .onError(({ error, set }) => {
    const statusCode = set.status || 500;

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.warn(`[BotConfig] ${statusCode}: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  })

  // GET /guilds/:guildId/bot-config - Get bot configuration
  .get("/", async ({ params, set, request }) => {
    const { guildId } = params as { guildId: string };
    // Use the request signal for cancellation
    const signal = request.signal as AbortSignal | undefined;

    try {
      // Fetch both guild-specific and global bot profiles in parallel
      const res = await withAbort(
        DiscordService.getBotGuildProfile(guildId),
        signal,
        `Bot config fetch cancelled for guild ${guildId}`
      )

      // Validate the response structure
      const validatedResponse = BotConfigResponseSchema.parse(res);

      return {
        success: true,
        data: validatedResponse,
      };
    } catch (error) {
      if (signal?.aborted) {
        logger.debug(`[BotConfig] Request cancelled for guild ${guildId}`);
        return; // Client already disconnected
      }

      logger.error(
        `[BotConfig] Error getting config for guild ${guildId}:`,
        error
      );
      set.status = 500;
      return {
        success: false,
        error: "Failed to get bot configuration",
      };
    }
  })

  // PUT /guilds/:guildId/bot-config - Update bot configuration
  .put("/", async ({ body, params, set }) => {
    const { guildId } = params as { guildId: string };
    try {
      // Validate request body
      const validatedBody = BotConfigUpdateRequestSchema.parse(body);

      // Validate that we have something to update
      if (Object.keys(validatedBody).length === 0) {
        throw new Error("No valid fields to update");
      }

      // Map the request fields to Discord API format
      const updateData = {
        avatar: validatedBody.avatar,
        banner: validatedBody.banner,
        nick: validatedBody.nickname?.trim() || null,
      };

      // Update bot guild member profile on Discord
      const updatedProfile = await DiscordService.updateBotProfile(
        guildId,
        updateData
      );

      // Broadcast SSE update for real-time dashboard updates
      try {
        const sseEvent = {
          type: SSE_EVENT_TYPES.BOT_PROFILE_UPDATE,
          data: updatedProfile,
        } as const;
        
        // Broadcast directly to SSE connections if any exist
        sseRegistry.broadcast(guildId, sseEvent);
        
        // Also publish to RabbitMQ for other instances (if using multiple API instances)
        const rabbitMQ = (global as any).rabbitMQ as RabbitMQService | undefined;
        if (rabbitMQ) {
          await rabbitMQ.publishMessage(
            EXCHANGE_NAMES.DISCORD_EVENTS,
            {
              id: `bot-profile-update-${guildId}-${Date.now()}`,
              type: SSE_EVENT_TYPES.BOT_PROFILE_UPDATE,
              payload: {
                guildId,
                data: updatedProfile,
              },
              timestamp: new Date(),
              source: "api",
            },
            `guild.${guildId}`
          );
        }
        
        logger.info(
          `[BotConfig] Published bot profile update event for guild ${guildId}`
        );
      } catch (error) {
        logger.warn(
          `[BotConfig] Failed to publish SSE event for guild ${guildId}:`,
          error
        );
        // Don't fail the request if SSE publish fails
      }

      return {
        success: true,
        data: updatedProfile,
      };
    } catch (error) {
      logger.error(
        `[BotConfig] Error updating config for guild ${guildId}:`,
        error
      );

      if (error instanceof Error && error.name === "ZodError") {
        set.status = 400;
        return {
          success: false,
          error: "Validation failed",
          details: error.message,
        };
      }

      set.status = 500;
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update bot configuration",
      };
    }
  })

  // DELETE /guilds/:guildId/bot-config - Reset bot configuration
  .delete("/", async ({ params, set }) => {
    const { guildId } = params as { guildId: string };
    try {
      // Reset bot guild member profile (remove avatar, banner, and nickname)
      const resetData = {
        avatar: null,
        banner: null,
        nick: null,
      };

      const resetProfile = await DiscordService.updateBotProfile(
        guildId,
        resetData
      );

      // Cache is automatically refreshed by DiscordService.updateBotProfile

      // Broadcast SSE update for real-time dashboard updates
      try {
        const sseEvent = {
          type: SSE_EVENT_TYPES.BOT_PROFILE_UPDATE,
          data: resetProfile,
        } as const;
        
        // Broadcast directly to SSE connections if any exist
        sseRegistry.broadcast(guildId, sseEvent);
        
        // Also publish to RabbitMQ for other instances (if using multiple API instances)
        const rabbitMQ = (global as any).rabbitMQ as RabbitMQService | undefined;
        if (rabbitMQ) {
          await rabbitMQ.publishMessage(
            EXCHANGE_NAMES.DISCORD_EVENTS,
            {
              id: `bot-profile-reset-${guildId}-${Date.now()}`,
              type: SSE_EVENT_TYPES.BOT_PROFILE_UPDATE,
              payload: {
                guildId,
                data: resetProfile,
              },
              timestamp: new Date(),
              source: "api",
            },
            `guild.${guildId}`
          );
        }
        
        logger.info(
          `[BotConfig] Published bot profile reset event for guild ${guildId}`
        );
      } catch (error) {
        logger.warn(
          `[BotConfig] Failed to publish SSE event for guild ${guildId}:`,
          error
        );
        // Don't fail the request if SSE publish fails
      }

      return {
        success: true,
        message: "Bot configuration reset successfully",
      };
    } catch (error) {
      logger.error(
        `[BotConfig] Error resetting config for guild ${guildId}:`,
        error
      );
      set.status = 500;
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset bot configuration",
      };
    }
  });
