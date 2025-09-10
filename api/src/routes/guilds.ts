import { CommandPermissionsUpdateSchema } from "@discord-bot/shared-types";
import { Elysia } from "elysia";
import { guildAccess } from "../middleware/auth";
import { commandPermissionMetrics } from "../middleware/elysia-metrics";
import { sessionMiddleware } from "../middleware/session";
import { DatabaseService } from "../services/database";
import { DiscordService } from "../services/discord";
import { RedisService } from "../services/redis";
import { logger } from "../utils/logger";

export const guildPlugin = new Elysia({ name: "guild", prefix: "/guilds" })
  .use(sessionMiddleware)
  .use(guildAccess)
  // GET /guilds/:guildId/commands/:commandId - Get command configuration by Discord ID
  .get(
    "/:guildId/commands/:commandId",
    async ({ params, set }) => {
      const { guildId, commandId } = params as {
        guildId: string;
        commandId: string;
      };

      if (!guildId || !commandId) {
        set.status = 400;
        return {
          success: false,
          error: "Guild ID and Command ID are required",
        };
      }

      try {
        // Get command by Discord ID
        const command = await DatabaseService.getDefaultCommandByDiscordId(BigInt(commandId));
        
        if (!command) {
          set.status = 404;
          return {
            success: false,
            error: "Command not found",
          };
        }

        return {
          success: true,
          data: command,
        };
      } catch (error) {
        logger.error(
          `[Guilds] Error getting command config for ${commandId}:`,
          error
        );

        set.status = 500;
        return {
          success: false,
          error: "Failed to get command configuration",
        };
      }
    }
  )
  // PUT /guilds/:guildId/commands/:commandId/permissions - Update command permissions
  .put(
    "/:guildId/commands/:commandId/permissions",
    async ({ params, body, set }) => {
      const { guildId, commandId } = params as {
        guildId: string;
        commandId: string;
      };

      if (!guildId || !commandId) {
        set.status = 400;
        return {
          success: false,
          error: "Guild ID and Command ID are required",
        };
      }

      try {
        const validatedBody = CommandPermissionsUpdateSchema.parse(body);

        const updatedPermissions =
          await DiscordService.updateCommandPermissions(
            guildId,
            commandId,
            validatedBody
          );

        // Invalidate command permissions cache
        const client = RedisService.getClient();
        await client.del(`guild:${guildId}:command_permissions`);

        // Record successful permission update
        commandPermissionMetrics.recordUpdate(guildId, commandId, "success");

        return updatedPermissions;
      } catch (error) {
        logger.error(
          `[Guilds] Error updating permissions for command ${commandId}:`,
          error
        );

        // Record failed permission update
        commandPermissionMetrics.recordUpdate(guildId, commandId, "failure");

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
          error: "Failed to update command permissions",
        };
      }
    }
  );
