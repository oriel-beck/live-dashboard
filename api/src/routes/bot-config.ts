import {
  BotConfigUpdateRequestSchema,
  type BotConfig,
  type BotConfigUpdateRequest,
} from "@discord-bot/shared-types";
import { Elysia } from "elysia";
import { config } from "../config";
import { sessionMiddleware } from "../middleware/session";
import { DiscordService } from "../services/discord";
import { logger } from "../utils/logger";
import { withAbort } from "../utils/request-utils";

// Bot Configuration Service
class BotConfigService {
  /**
   * Get current bot user information from Discord
   */
  static async getCurrentBotUser(): Promise<any> {
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${config.discord.botToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Discord API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error("[BotConfig] Error getting current bot user:", error);
      throw error;
    }
  }

  /**
   * Update bot user profile on Discord
   */
  static async updateBotProfile(
    botConfig: BotConfigUpdateRequest
  ): Promise<any> {
    try {
      const updateData: any = {};

      // Add username if nickname is provided
      if (botConfig.nickname && botConfig.nickname.trim()) {
        updateData.username = botConfig.nickname.trim();
      }

      // Add avatar if provided (should be base64 data URI)
      if (botConfig.avatar) {
        updateData.avatar = botConfig.avatar;
      }

      // Add banner if provided (should be base64 data URI)
      if (botConfig.banner) {
        updateData.banner = botConfig.banner;
      }

      // Only make the API call if we have something to update
      if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields to update");
      }

      const response = await fetch("https://discord.com/api/v10/users/@me", {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${config.discord.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Discord API error: ${response.status} ${response.statusText} - ${errorData}`
        );
      }

      const updatedUser = await response.json();
      logger.info("[BotConfig] Successfully updated bot profile on Discord");
      return updatedUser;
    } catch (error) {
      logger.error("[BotConfig] Error updating bot profile:", error);
      throw error;
    }
  }

  /**
   * Get bot configuration for display (current Discord user info)
   */
  static async getBotConfig(guildId: string): Promise<BotConfig> {
    try {
      const botUser = await this.getCurrentBotUser();

      return {
        guildId,
        avatar: botUser.avatar
          ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png?size=512`
          : undefined,
        banner: botUser.banner
          ? `https://cdn.discordapp.com/banners/${botUser.id}/${botUser.banner}.png?size=1024`
          : undefined,
        nickname: botUser.username, // For bots, username is the display name
      };
    } catch (error) {
      logger.error(
        `[BotConfig] Error getting bot config for guild ${guildId}:`,
        error
      );
      throw error;
    }
  }
}

export const botConfigPlugin = new Elysia({
  name: "bot-config",
  prefix: "/guilds/:guildId/bot-config",
})
  .use(sessionMiddleware)
  .derive(async (context: any) => {
    const { params, set } = context;
    const guildId = params?.guildId;

    if (!context.isAuthenticated || !context.session || !context.accessToken) {
      set.status = 401;
      throw new Error("Authentication required");
    }

    if (!guildId) {
      set.status = 400;
      throw new Error("Guild ID required");
    }

    try {
      // Check if user has access to this guild
      const userGuilds = await DiscordService.getUserGuilds(
        context.accessToken
      );
      const hasAccess = await DiscordService.checkGuildAccess(
        guildId,
        userGuilds
      );

      if (!hasAccess) {
        set.status = 403;
        throw new Error("Access denied to this guild");
      }

      return {
        guildId,
        userId: context.session.user.id,
        accessToken: context.accessToken,
      };
    } catch (error) {
      logger.error(
        `[BotConfig] Error checking guild access for ${guildId}:`,
        error
      );

      if (
        error instanceof Error &&
        (error.message === "Authentication required" ||
          error.message === "Guild ID required" ||
          error.message === "Access denied to this guild")
      ) {
        throw error;
      }

      set.status = 500;
      throw new Error("Internal server error");
    }
  })
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
  .get("/", async ({ guildId, set, request }) => {
    // Use the request signal for cancellation
    const signal = request.signal as AbortSignal | undefined;

    try {
      const config = await withAbort(
        BotConfigService.getBotConfig(guildId),
        signal,
        `Bot config fetch cancelled for guild ${guildId}`
      );

      return {
        success: true,
        data: config,
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
  .put("/", async ({ body, guildId, userId, set }) => {
    try {
      // Validate request body
      const validatedBody = BotConfigUpdateRequestSchema.parse(body);

      // Update bot profile on Discord
      const updatedUser = await BotConfigService.updateBotProfile(
        validatedBody
      );

      // Return the updated configuration
      const updatedConfig: BotConfig = {
        guildId,
        avatar: updatedUser.avatar
          ? `https://cdn.discordapp.com/avatars/${updatedUser.id}/${updatedUser.avatar}.png?size=512`
          : undefined,
        banner: updatedUser.banner
          ? `https://cdn.discordapp.com/banners/${updatedUser.id}/${updatedUser.banner}.png?size=1024`
          : undefined,
        nickname: updatedUser.username,
      };

      return {
        success: true,
        data: updatedConfig,
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
  .delete("/", async ({ guildId, userId, set }) => {
    try {
      // Reset bot profile on Discord (remove avatar and banner)
      const resetData = {
        avatar: null,
        banner: null,
      };

      const response = await fetch("https://discord.com/api/v10/users/@me", {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${config.discord.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resetData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Discord API error: ${response.status} ${response.statusText} - ${errorData}`
        );
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
