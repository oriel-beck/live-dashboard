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

/**
 * @swagger
 * /guilds/{guildId}:
 *   get:
 *     summary: Get guild information
 *     description: Retrieve detailed information about a Discord guild including roles, channels, and metadata
 *     tags: [Guilds]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *         description: Discord guild ID
 *     responses:
 *       200:
 *         description: Guild information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/GuildData'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user doesn't have access to this guild
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Guild not found or bot no longer has access
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Guild not found or bot no longer has access"
 *                 redirectToGuilds:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /guilds/{guildId}/commands:
 *   get:
 *     summary: Get guild commands
 *     description: Retrieve all available commands for a guild
 *     tags: [Guilds, Commands]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *         description: Discord guild ID
 *     responses:
 *       200:
 *         description: Commands retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/Command'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user doesn't have access to this guild
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /guilds/{guildId}/commands/{commandId}:
 *   get:
 *     summary: Get command configuration
 *     description: Retrieve configuration details for a specific command
 *     tags: [Guilds, Commands]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *         description: Discord guild ID
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: string
 *         description: Command ID
 *     responses:
 *       200:
 *         description: Command configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Command'
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user doesn't have access to this guild
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Command not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:guildId/commands/:commandId",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { commandId } = req.params;

      const command = await DefaultCommandService.getCommandByDiscordId(BigInt(commandId));

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

/**
 * @swagger
 * /guilds/{guildId}/commands/{commandId}/permissions:
 *   put:
 *     summary: Update command permissions
 *     description: Update permissions for a specific command in a guild
 *     tags: [Guilds, Commands]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *         description: Discord guild ID
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: string
 *         description: Command ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/CommandPermission'
 *                 description: Array of permission objects
 *             required:
 *               - permissions
 *     responses:
 *       200:
 *         description: Command permissions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Updated permission data
 *       400:
 *         description: Bad request - invalid permissions format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - user not authenticated or Discord session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Command not found or not registered with Discord
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /guilds/{guildId}/commands/{commandId}/permissions:
 *   delete:
 *     summary: Delete command permissions
 *     description: Remove command-specific permissions and sync with application-level permissions
 *     tags: [Guilds, Commands]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *         description: Discord guild ID
 *       - in: path
 *         name: commandId
 *         required: true
 *         schema:
 *           type: string
 *         description: Command ID
 *     responses:
 *       200:
 *         description: Command permissions deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Command synced with application permissions"
 *       401:
 *         description: Unauthorized - user not authenticated or Discord session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Command not found or not registered with Discord
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /guilds/{guildId}/events:
 *   get:
 *     summary: Server-Sent Events for real-time updates
 *     description: Establish a Server-Sent Events connection for real-time guild updates
 *     tags: [Guilds, Real-time]
 *     parameters:
 *       - in: path
 *         name: guildId
 *         required: true
 *         schema:
 *           type: string
 *         description: Discord guild ID
 *     responses:
 *       200:
 *         description: SSE connection established successfully
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream
 *             example: |
 *               event: update
 *               data: {"type":"initial","guildId":"123456789","guildInfo":{...}}
 *               
 *               event: update
 *               data: {"type":"command.permissions.sync","command":{"id":"123","synced":true}}
 *       401:
 *         description: Unauthorized - user not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user doesn't have access to this guild
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
