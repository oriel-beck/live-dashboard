import { DatabaseService } from '../services/database';
import { BaseCommandDataSchema } from '@discord-bot/shared-types';
import { RequestHandler, ResponseHandler } from '@nex-app/bun-server';
import { z } from 'zod';

export async function handleGetAllCommands(req: RequestHandler, res: ResponseHandler) {
  try {
    const commands = await DatabaseService.getAllMainCommands();
    return res.send({
      success: true,
      data: commands,
    });
  } catch (error) {
    req.state.logger.error('[Commands] Error getting all commands:', error);
    
    res.setStatus(500);
    return res.send({
      success: false,
      error: "Internal server error",
    });
  }
}

export async function handleGetCommandById(req: RequestHandler, res: ResponseHandler) {
  const commandId = req.params.path.commandId;

  if (!commandId || isNaN(Number(commandId))) {
    res.setStatus(400);
    return res.send({
      success: false,
      error: "Valid command ID is required",
    });
  }

  try {
    const id = Number(commandId);
    const command = await DatabaseService.getCommandById(id);

    if (!command || command.length === 0) {
      res.setStatus(404);
      return res.send({
        success: false,
        error: "Command not found",
      });
    }

    return res.send({
      success: true,
      data: command[0],
    });
  } catch (error) {
    req.state.logger.error(`[Commands] Error getting command ${commandId}:`, error);
    
    res.setStatus(500);
    return res.send({
      success: false,
      error: "Internal server error",
    });
  }
}

export async function handleUpdateCommand(req: RequestHandler, res: ResponseHandler) {
  const commandId = req.params.path.commandId;

  if (!commandId || isNaN(Number(commandId))) {
    res.setStatus(400);
    return res.send({
      success: false,
      error: "Valid command ID is required",
    });
  }

  try {
    const id = Number(commandId);
    const rawBody = await req.request.json();
    const body = BaseCommandDataSchema.partial().pick({ enabled: true, cooldown: true }).parse(rawBody);

    if (body.enabled !== undefined) {
      const updatedCommand = await DatabaseService.updateCommandEnabled(id, body.enabled);
      return res.send({
        success: true,
        data: updatedCommand[0],
      });
    }

    if (body.cooldown !== undefined) {
      const updatedCommand = await DatabaseService.updateCommandCooldown(id, body.cooldown);
      return res.send({
        success: true,
        data: updatedCommand[0],
      });
    }

    res.setStatus(400);
    return res.send({
      success: false,
      error: "No valid fields to update",
    });
  } catch (error) {
    req.state.logger.error(`[Commands] Error updating command ${commandId}:`, error);

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
      error: "Internal server error",
    });
  }
}

export async function handleDeleteCommand(req: RequestHandler, res: ResponseHandler) {
  const commandId = req.params.path.commandId;

  if (!commandId || isNaN(Number(commandId))) {
    res.setStatus(400);
    return res.send({
      success: false,
      error: "Valid command ID is required",
    });
  }

  try {
    const id = Number(commandId);
    const deletedCommand = await DatabaseService.deleteCommand(id);

    return res.send({
      success: true,
      data: deletedCommand[0],
    });
  } catch (error) {
    req.state.logger.error(`[Commands] Error deleting command ${commandId}:`, error);
    
    res.setStatus(500);
    return res.send({
      success: false,
      error: "Internal server error",
    });
  }
}
