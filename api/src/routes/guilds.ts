import { Request, Response, Router } from "express";
import { DefaultCommandService } from "../database";
import { requireAuth, requireGuildAccess } from "../middleware/auth";
import { RedisService } from "../services/redis";
import { DiscordService } from "../services/discord";
import { SessionService } from "../services/session";
import { config } from "../config";
import { redis } from "../services/redis";
import logger from "../utils/logger";
import { REDIS_KEYS } from "@discord-bot/shared-types/dist";

const router = Router();

// Apply authentication middleware to all guild routes
router.use(requireAuth);

// Get guild information with lazy loading
router.get(
  "/:guildId",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const guildId = req.params.guildId;

      // Use the new lazy loading method
      const guildData = await RedisService.getGuildDataWithLazyLoad(guildId);

      const responseData = {
        ...guildData.guildInfo,
        roles: guildData.roles,
        channels: guildData.channels,
        lastUpdate: guildData.guildInfo.lastUpdated,
        isStale: false, // Data was just fetched or is fresh
      };

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error: unknown) {
      logger.error("Error fetching guild data:", error);

      // Handle specific error cases for dashboard redirect
      if (
        error instanceof Error &&
        (error.message === "GUILD_NOT_ACCESSIBLE" ||
          error.message === "GUILD_FETCH_FAILED")
      ) {
        return res.status(404).json({
          success: false,
          error: "Guild not found or bot no longer has access",
          redirectToGuilds: true, // Signal to dashboard to redirect to guilds page
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to fetch guild information",
      });
    }
  }
);

// Get guild commands (basic info only)
router.get(
  "/:guildId/commands",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const commands = await DefaultCommandService.getAllMainCommands();

      // Transform to keyed object by command ID
      const result: Record<string, any> = {};
      for (const cmd of commands) {
        result[cmd.id] = cmd;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Error getting guild commands:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get guild commands",
      });
    }
  }
);

// Get command config by ID
router.get(
  "/:guildId/commands/:commandId",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { commandId } = req.params;

      const command = await DefaultCommandService.getCommandById(+commandId);

      if (!command) {
        return res.status(404).json({
          success: false,
          error: "Command not found",
        });
      }

      const commandData = {
        id: command.id,
        name: command.name,
        description: command.description,
        cooldown: command.cooldown,
        enabled: command.enabled,
        categoryId: command.categoryId,
      };

      res.json({
        success: true,
        data: commandData,
      });
    } catch (error) {
      logger.error("Error getting command config:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get command config",
      });
    }
  }
);

// Update command permissions
router.put(
  "/:guildId/commands/:commandId/permissions",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { guildId, commandId } = req.params;
      const { permissions } = req.body;

      console.log(permissions);

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: "Permissions must be an array",
        });
      }

      // Get the Discord command ID from our database
      const command = await DefaultCommandService.getCommandByDiscordId(
        BigInt(commandId)
      );
      if (!command || !command.discordId) {
        return res.status(404).json({
          success: false,
          error: "Command not found or not registered with Discord",
        });
      }

      // Get user's Discord access token for updating permissions
      const authReq = req as any; // AuthenticatedRequest
      if (!authReq.user) {
        return res.status(401).json({
          success: false,
          error:
            "User authentication required for updating command permissions",
        });
      }

      // Update permissions on Discord using user's Bearer token
      let result;
      try {
        result = await DiscordService.updateCommandPermissions(
          guildId,
          command.discordId.toString(),
          permissions,
          authReq.sessionId || ""
        );
      } catch (error) {
        logger.error("Error updating command permissions:", error);
        console.log(error);

        // Check if it's an authentication error
        if (error instanceof Error && error.message.includes("401")) {
          return res.status(401).json({
            success: false,
            error:
              "Discord authentication failed. Your session may have expired. Please re-authenticate.",
          });
        }

        // Check if it's a permissions error
        if (error instanceof Error && error.message.includes("403")) {
          return res.status(403).json({
            success: false,
            error:
              "You don't have permission to update command permissions. You need 'Manage Guild' and 'Manage Roles' permissions.",
          });
        }

        // Generic error
        return res.status(500).json({
          success: false,
          error: "Failed to update command permissions. Please try again.",
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Error updating command permissions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update command permissions",
      });
    }
  }
);

// Delete command permissions (sync with application-level permissions)
router.delete(
  "/:guildId/commands/:commandId/permissions",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { guildId, commandId } = req.params;

      // Get the Discord command ID from our database
      const command = await DefaultCommandService.getCommandByDiscordId(
        BigInt(commandId)
      );
      if (!command || !command.discordId) {
        return res.status(404).json({
          success: false,
          error: "Command not found or not registered with Discord",
        });
      }

      // Get user's Discord access token for updating permissions
      const authReq = req as any; // AuthenticatedRequest
      if (!authReq.user) {
        return res.status(401).json({
          success: false,
          error:
            "User authentication required for updating command permissions",
        });
      }

      // Delete command-specific permissions using user's Bearer token
      // This will make the command inherit application-level permissions
      await DiscordService.deleteCommandPermissions(
        guildId,
        command.discordId.toString(),
        authReq.sessionId
      );

      // Publish update event for real-time dashboard updates
      RedisService.publishGuildEvent(guildId, {
        type: "command.permissions.sync",
        command: {
          id: commandId,
          synced: true,
        },
      });

      res.json({
        success: true,
        message: "Command synced with application permissions",
      });
    } catch (error) {
      logger.error("Error deleting command permissions:", error);

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes("401")) {
        return res.status(401).json({
          success: false,
          error:
            "Discord authentication failed. Your session may have expired. Please re-authenticate.",
        });
      }

      // Check if it's a permissions error
      if (error instanceof Error && error.message.includes("403")) {
        return res.status(403).json({
          success: false,
          error:
            "You don't have permission to update command permissions. You need 'Manage Guild' and 'Manage Roles' permissions.",
        });
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: "Failed to sync command permissions. Please try again.",
      });
    }
  }
);

// Server-Sent Events for real-time updates
router.get(
  "/:guildId/events",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    const { guildId } = req.params;

    logger.debug(`SSE started for guild: ${guildId}`);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial data with lazy loading
    try {
      const guildData = await RedisService.getGuildDataWithLazyLoad(guildId);
      const commands = await DefaultCommandService.getAllMainCommands();

      res.write(
        `event: update\ndata: ${JSON.stringify({
          type: "initial",
          guildId,
          guildInfo: guildData.guildInfo,
          roles: guildData.roles,
          channels: guildData.channels,
          commands: commands,
          commandPermissions:
            await DiscordService.getGuildApplicationCommandPermissions(guildId),
        })}\n\n`
      );
    } catch (error: unknown) {
      logger.error(`[SSE] Failed to load guild data for ${guildId}:`, error);

      // If guild fetch failed, send error event and close connection
      res.write(
        `event: update\ndata: ${JSON.stringify({
          type: "guild_fetch_failed",
          guildId,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch guild data",
        })}\n\n`
      );

      // Close the connection after sending error
      setTimeout(() => {
        res.end();
      }, 1000);

      return;
    }

    // Subscribe to guild events
    await RedisService.subscribeToGuildEvents(guildId, (message) => {
      res.write(`event: update\ndata: ${message}\n\n`);
    });

    req.on("close", async () => {
      logger.debug(`SSE closed for guild: ${guildId}`);
      await RedisService.unsubscribeFromGuildEvents(guildId);
      res.end();
    });
  }
);

export default router;
