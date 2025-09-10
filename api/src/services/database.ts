import { AppDataSource } from '../config/database';
import { logger } from '../utils/logger';
import { DefaultCommand } from '../entities/DefaultCommand';
import { CommandCategory } from '../entities/CommandCategory';
import { Repository, IsNull } from 'typeorm';
import { DefaultCommandRegistration } from '@discord-bot/shared-types';

export class DatabaseService {
  static async initialize(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        logger.info('[Database] Connected successfully');
        
        // Run migrations automatically on startup
        await AppDataSource.runMigrations();
        logger.info('[Database] Migrations completed');
      }
    } catch (error) {
      logger.error('[Database] Failed to connect:', error);
      throw error;
    }
  }

  static getConnection() {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return AppDataSource;
  }

  static getRepository<T extends object>(entity: new () => T): Repository<T> {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return AppDataSource.getRepository(entity);
  }

  static async close(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('[Database] Connection closed');
    }
  }

  // Default Command operations
  static async upsertDefaultCommand(command: DefaultCommandRegistration): Promise<DefaultCommand> {
    const repository = this.getRepository(DefaultCommand);

    try {
      // Check if command exists by discord_id or name
      let existingCommand = await repository.findOne({
        where: [
          { discordId: command.discordId?.toString() || undefined },
          { name: command.name }
        ]
      });

      if (existingCommand) {
        // Update existing command
        existingCommand.discordId = command.discordId?.toString() || null;
        existingCommand.name = command.name;
        existingCommand.description = command.description;
        existingCommand.cooldown = command.cooldown || 0;
        existingCommand.permissions = command.permissions?.toString() || '0';
        existingCommand.enabled = command.enabled !== false;
        existingCommand.parentId = command.parentId || null;
        existingCommand.categoryId = command.categoryId || null;
        
        return await repository.save(existingCommand);
      } else {
        // Create new command
        const newCommand = repository.create({
          discordId: command.discordId?.toString() || null,
          name: command.name,
          description: command.description,
          cooldown: command.cooldown || 0,
          permissions: command.permissions?.toString() || '0',
          enabled: command.enabled !== false,
          parentId: command.parentId || null,
          categoryId: command.categoryId || null
        });
        
        return await repository.save(newCommand);
      }
    } catch (error) {
      logger.error('[Database] Error upserting default command:', error);
      throw error;
    }
  }

  static async getDefaultCommands(): Promise<DefaultCommand[]> {
    const repository = this.getRepository(DefaultCommand);
    
    try {
      return await repository.find({
        relations: ['category'],
        order: { name: 'ASC' }
      });
    } catch (error) {
      logger.error('[Database] Error getting default commands:', error);
      throw error;
    }
  }

  static async getDefaultCommandsHierarchical(): Promise<DefaultCommand[]> {
    const repository = this.getRepository(DefaultCommand);
    
    try {
      // Get all commands with their subcommands
      const commands = await repository.find({
        relations: ['category', 'subcommands'],
        where: { parentId: IsNull() }, // Only get parent commands
        order: { name: 'ASC' }
      });
      
      return commands;
    } catch (error) {
      logger.error('[Database] Error getting hierarchical default commands:', error);
      throw error;
    }
  }

  static async getDefaultCommandByDiscordId(discordId: bigint): Promise<DefaultCommand | null> {
    const repository = this.getRepository(DefaultCommand);
    
    try {
      return await repository.findOne({
        where: { discordId: discordId.toString() },
        relations: ['category', 'parent', 'subcommands']
      });
    } catch (error) {
      logger.error('[Database] Error getting default command by Discord ID:', error);
      throw error;
    }
  }

  // Command Category operations
  static async getCommandCategories(): Promise<CommandCategory[]> {
    const repository = this.getRepository(CommandCategory);
    
    try {
      return await repository.find({
        relations: ['commands'],
        order: { name: 'ASC' }
      });
    } catch (error) {
      logger.error('[Database] Error getting command categories:', error);
      throw error;
    }
  }

  static async getCommandCategoryById(id: number): Promise<CommandCategory | null> {
    const repository = this.getRepository(CommandCategory);
    
    try {
      return await repository.findOne({
        where: { id },
        relations: ['commands']
      });
    } catch (error) {
      logger.error('[Database] Error getting command category by ID:', error);
      throw error;
    }
  }

  static async createCommandCategory(category: {
    name: string;
    description: string;
  }): Promise<CommandCategory> {
    const repository = this.getRepository(CommandCategory);
    
    try {
      const newCategory = repository.create(category);
      return await repository.save(newCategory);
    } catch (error) {
      logger.error('[Database] Error creating command category:', error);
      throw error;
    }
  }

  static async updateCommandCategory(id: number, updates: Partial<CommandCategory>): Promise<CommandCategory | null> {
    const repository = this.getRepository(CommandCategory);
    
    try {
      await repository.update(id, updates);
      return await this.getCommandCategoryById(id);
    } catch (error) {
      logger.error('[Database] Error updating command category:', error);
      throw error;
    }
  }

  static async deleteCommandCategory(id: number): Promise<boolean> {
    const repository = this.getRepository(CommandCategory);
    
    try {
      const result = await repository.delete(id);
      return (result.affected ?? 0) > 0;
    } catch (error) {
      logger.error('[Database] Error deleting command category:', error);
      throw error;
    }
  }

  // Guild-specific command operations
  static async getGuildCommandConfig(guildId: string, commandId: string): Promise<any> {
    // This would need to be implemented based on your guild command configuration needs
    // For now, returning null as this seems to be a placeholder
    return null;
  }

  static async updateGuildCommandConfig(guildId: string, commandId: string, config: any): Promise<any> {
    // This would need to be implemented based on your guild command configuration needs
    // For now, returning null as this seems to be a placeholder
    return null;
  }
}