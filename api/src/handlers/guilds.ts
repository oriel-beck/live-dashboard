import { CommandPermissionsUpdateSchema } from '@discord-bot/shared-types';
import { RequestHandler, ResponseHandler } from '@nex-app/bun-server';
import { z } from 'zod';
import { DiscordService } from '../services/discord';
import { RedisService } from '../services/redis';

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
    req.state.logger.error(`[Guilds] Error checking user access for guild ${guildId}:`, error);
    return false;
  }
}

export async function handleGetGuildInfo(req: RequestHandler, res: ResponseHandler) {
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

  try {
    const guildInfo = await RedisService.getGuildInfo(guildId);
    return res.send({
      success: true,
      data: guildInfo,
    });
  } catch (error) {
    req.state.logger.error(`[Guilds] Error for guild ${guildId}:`, error);

    let statusCode = 500;
    let message = "Internal server error";

    if (error instanceof Error) {
      if (error.message === "GUILD_NOT_ACCESSIBLE") {
        statusCode = 403;
        message = "Guild not accessible";
      } else if (error.message === "GUILD_FETCH_FAILED") {
        statusCode = 404;
        message = "Guild not found";
      }
    }

    res.setStatus(statusCode);
    return res.send({
      success: false,
      error: message,
    });
  }
}

export async function handleGetGuildRoles(req: RequestHandler, res: ResponseHandler) {
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

  try {
    const roles = await RedisService.getGuildRoles(guildId);
    return res.send({
      success: true,
      data: roles,
    });
  } catch (error) {
    req.state.logger.error(`[Guilds] Error getting roles for guild ${guildId}:`, error);

    let statusCode = 500;
    let message = "Internal server error";

    if (error instanceof Error) {
      if (error.message === "GUILD_NOT_ACCESSIBLE") {
        statusCode = 403;
        message = "Guild not accessible";
      } else if (error.message === "GUILD_FETCH_FAILED") {
        statusCode = 404;
        message = "Guild not found";
      }
    }

    res.setStatus(statusCode);
    return res.send({
      success: false,
      error: message,
    });
  }
}

export async function handleGetGuildChannels(req: RequestHandler, res: ResponseHandler) {
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

  try {
    const channels = await RedisService.getGuildChannels(guildId);
    return res.send({
      success: true,
      data: channels,
    });
  } catch (error) {
    req.state.logger.error(`[Guilds] Error getting channels for guild ${guildId}:`, error);

    let statusCode = 500;
    let message = "Internal server error";

    if (error instanceof Error) {
      if (error.message === "GUILD_NOT_ACCESSIBLE") {
        statusCode = 403;
        message = "Guild not accessible";
      } else if (error.message === "GUILD_FETCH_FAILED") {
        statusCode = 404;
        message = "Guild not found";
      }
    }

    res.setStatus(statusCode);
    return res.send({
      success: false,
      error: message,
    });
  }
}

export async function handleUpdateCommandPermissions(req: RequestHandler, res: ResponseHandler) {
  const guildId = req.params.path.guildId;
  const commandId = req.params.path.commandId;

  if (!guildId || !commandId) {
    res.setStatus(400);
    return res.send({
      success: false,
      error: "Guild ID and Command ID are required",
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

  try {
    const rawBody = await req.request.json();
    const body = CommandPermissionsUpdateSchema.parse(rawBody);
    
    const updatedPermissions = await DiscordService.updateCommandPermissions(
      guildId, 
      commandId, 
      body
    );
    
    // Invalidate command permissions cache
    const client = RedisService.getClient();
    await client.del(`guild:${guildId}:command_permissions`);
    
    return res.send(updatedPermissions);
  } catch (error) {
    req.state.logger.error(`[Guilds] Error updating permissions for command ${commandId}:`, error);

    if (error instanceof z.ZodError) {
      res.setStatus(400);
      return res.send({
        success: false,
        error: "Validation failed",
        details: error.message,
      });
    }
    
    res.setStatus(500);
    return res.send({
      success: false,
      error: "Failed to update command permissions",
    });
  }
}
