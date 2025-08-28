import { Request, Response, Router } from "express";
import { CommandConfigService, DefaultCommandService } from "../database";
import { requireAuth, requireGuildAccess } from "../middleware/auth";
import { RedisService } from "../services/redis";
import logger from "../utils/logger";
import { 
  CommandConfigUpdateSchema, 
  ApiResponseSchema,
  GuildDataResponseSchema, 
  CommandConfigResult
} from '@discord-bot/shared-types';

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

      // Validate response data
      const validatedData = GuildDataResponseSchema.parse(responseData);
      
      res.json({
        success: true,
        data: validatedData,
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

// Get guild commands with configuration
router.get(
  "/:guildId/commands",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { withSubcommands } = req.query;
      const includeSubcommands = withSubcommands === "true";

      const commands = await CommandConfigService.getGuildCommands(
        req.params.guildId,
        includeSubcommands
      );

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

// Get specific command configuration
router.get(
  "/:guildId/commands/:commandId",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { guildId, commandId } = req.params;
      const { withSubcommands, subcommandName } = req.query;
      const includeSubcommands = withSubcommands === "true";

      let config;

      if (subcommandName) {
        config = await CommandConfigService.getCommandConfigById(
          guildId,
          commandId,
          subcommandName as string,
          includeSubcommands
        );
      } else {
        config = await CommandConfigService.getCommandConfigById(
          guildId,
          commandId,
          undefined,
          includeSubcommands
        );
      }

      if (config === null) {
        return res.status(404).json({
          success: false,
          error: "Command not found",
        });
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error("Error getting command config:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get command configuration",
      });
    }
  }
);

// Update command configuration (handles both main commands and subcommands)
router.put(
  "/:guildId/commands/:commandId",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { guildId, commandId } = req.params;
      
      // Validate request body
      const updates = CommandConfigUpdateSchema.parse(req.body);

      logger.debug(
        `[API] Updating command config: guildId=${guildId}, commandId=${commandId}`
      );

      await CommandConfigService.updateCommandConfigById(
        guildId,
        commandId,
        updates
      );

      // Get command name for event publishing
      const commandInfo = await CommandConfigService.getCommandConfigById(
        guildId,
        commandId
      );

      // Publish event for real-time updates
      await RedisService.publishGuildEvent(guildId, {
        type: "command.config.update",
        command: {
          id: commandId,
          name: commandInfo?.name,
          guildId,
          parentId: commandInfo?.parentId,
          categoryId: commandInfo?.categoryId,
          description: commandInfo?.description,
          enabled: commandInfo?.enabled,
          discordId: commandInfo?.discordId,
          whitelistedRoles: commandInfo?.whitelistedRoles,
          blacklistedRoles: commandInfo?.blacklistedRoles,
          whitelistedChannels: commandInfo?.whitelistedChannels,
          blacklistedChannels: commandInfo?.blacklistedChannels,
          bypassRoles: commandInfo?.bypassRoles,
        },
      });

      // Get fresh config for response
      const config = await CommandConfigService.getCommandConfigById(
        guildId,
        commandId
      );

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error("Error updating command config:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update command configuration",
      });
    }
  }
);

// Update subcommand configuration
router.put(
  "/:guildId/commands/:commandId/:subcommandName",
  requireGuildAccess,
  async (req: Request, res: Response) => {
    try {
      const { guildId, commandId, subcommandName } = req.params;
      
      // Validate request body
      const updates = CommandConfigUpdateSchema.parse(req.body);

      logger.debug(
        `[API] Updating subcommand config: guildId=${guildId}, commandId=${commandId}, subcommandName=${subcommandName}`
      );

      // Get the main command first to find its Discord ID
      const command = await DefaultCommandService.getCommandById(+commandId, subcommandName);
      if (!command?.discordId) {
        return res.status(404).json({
          success: false,
          error: "Command not found",
        });
      }
      // Update the subcommand configuration
      await CommandConfigService.updateCommandConfigById(
        guildId,
        command.discordId.toString(),
        updates,
        subcommandName
      );

      // Get command info for event publishing
      const commandInfo = await CommandConfigService.getCommandConfigById(
        guildId,
        commandId,
        subcommandName
      );

      const subcommandInfo = commandInfo?.subcommands[subcommandName] as CommandConfigResult;

      // Publish event for real-time updates
      await RedisService.publishGuildEvent(guildId, {
        type: "command.config.update",
        command: {
          id: commandId,
          name: commandInfo?.name,
          guildId,
          categoryId: commandInfo?.categoryId,
          description: commandInfo?.description,
          enabled: commandInfo?.enabled,
          discordId: commandInfo?.discordId,
          whitelistedRoles: commandInfo?.whitelistedRoles,
          blacklistedRoles: commandInfo?.blacklistedRoles,
          whitelistedChannels: commandInfo?.whitelistedChannels,
          blacklistedChannels: commandInfo?.blacklistedChannels,
          bypassRoles: commandInfo?.bypassRoles,
        },
        subcommand: subcommandName
          ? {
              id: subcommandInfo?.id ?? '',
              name: subcommandInfo?.name ?? '',
              description: subcommandInfo?.description ?? '',
              enabled: updates.enabled ?? subcommandInfo?.enabled ?? false,
              cooldown: subcommandInfo?.cooldown ?? 0,
              whitelistedRoles: commandInfo?.whitelistedRoles ?? [],
              blacklistedRoles: commandInfo?.blacklistedRoles ?? [],
              whitelistedChannels: commandInfo?.whitelistedChannels ?? [],
              blacklistedChannels: commandInfo?.blacklistedChannels ?? [],
              bypassRoles: commandInfo?.bypassRoles ?? [],
            }
          : undefined,
      });

      res.json({
        success: true,
      });
    } catch (error) {
      logger.error("Error updating subcommand config:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update subcommand configuration",
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

    logger.info("SSE started for guild:", guildId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial data with lazy loading
    try {
      const guildData = await RedisService.getGuildDataWithLazyLoad(guildId);

      res.write(
        `event: update\ndata: ${JSON.stringify({
          type: "initial",
          guildId,
          guildInfo: guildData.guildInfo,
          roles: guildData.roles,
          channels: guildData.channels,
          commands: await CommandConfigService.getGuildCommands(guildId, true),
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
      logger.info("SSE closed for guild:", guildId);
      await RedisService.unsubscribeFromGuildEvents(guildId);
      res.end();
    });
  }
);

export default router;
