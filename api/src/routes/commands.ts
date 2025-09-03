import { Request, Response, Router } from 'express';
import { DefaultCommandService } from '../database';
import { requireAuth, requireBotAuth } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Register a default command (called by deploy script)
router.post('/register', requireBotAuth, async (req: Request, res: Response) => {
  try {
    const {
      discordId,
      name,
      description,
      cooldown,
      permissions,
      enabled,
      parentId,
    } = req.body;

    const command = await DefaultCommandService.upsertDefaultCommand({
      discordId: discordId ? BigInt(discordId) : null,
      name,
      description,
      cooldown: cooldown || 0,
      permissions: BigInt(permissions || 0),
      enabled: enabled ?? true,
      parentId: parentId ? +parentId : null,
    });

    res.json({
      success: true,
      message: 'Command registered successfully',
      data: {
        id: command.id.toString(),
        discordId: command.discordId?.toString(),
        name: command.name,
        description: command.description,
        cooldown: command.cooldown,
        permissions: command.permissions.toString(),
        enabled: command.enabled,
        parentId: command.parentId?.toString(),
        createdAt: command.createdAt,
        updatedAt: command.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error registering default command:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register command'
    });
  }
});

// Get all default commands (for dashboard)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const commands = await DefaultCommandService.getAllMainCommands();
    
    res.json({
      success: true,
      data: commands.map(cmd => ({
        id: cmd.id.toString(),
        discordId: cmd.discordId?.toString(),
        name: cmd.name,
        description: cmd.description,
        cooldown: cmd.cooldown,
        permissions: cmd.permissions.toString(),
        enabled: cmd.enabled,
        parentId: cmd.parentId?.toString(),
        createdAt: cmd.createdAt,
        updatedAt: cmd.updatedAt,
      }))
    });
  } catch (error) {
    logger.error('Error fetching commands:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commands'
    });
  }
});

// Get command by ID
router.get('/:commandId', requireAuth, async (req: Request, res: Response) => {
  try {
    const command = await DefaultCommandService.getCommandByDiscordId(req.params.commandId);
    
    if (!command) {
      return res.status(404).json({
        success: false,
        error: 'Command not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: command.id.toString(),
        discordId: command.discordId?.toString(),
        name: command.name,
        description: command.description,
        cooldown: command.cooldown,
        permissions: command.permissions.toString(),
        enabled: command.enabled,
        parentId: command.parentId?.toString(),
        createdAt: command.createdAt,
        updatedAt: command.updatedAt,
      }
    });
  } catch (error) {
    logger.error('Error fetching command:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch command'
    });
  }
});

export default router;
