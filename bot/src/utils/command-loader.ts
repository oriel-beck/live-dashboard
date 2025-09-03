import { readdirSync } from 'fs';
import { join } from 'path';
import { BaseCommand } from '../types/command';
import logger from './logger';

export class CommandLoader {
  private static async loadCommandFromFile(filePath: string): Promise<BaseCommand | null> {
    try {
      // Clear require cache to allow hot reloading
      delete require.cache[require.resolve(filePath)];
      
      // Use require for CommonJS modules
      const commandModule = require(filePath);
      
      // Look for exported classes that extend BaseCommand
      for (const [exportName, exportValue] of Object.entries(commandModule)) {
        if (
          typeof exportValue === 'function' &&
          exportValue.prototype instanceof BaseCommand
        ) {
          // Create an instance of the command class
          const CommandClass = exportValue as new () => BaseCommand;
          const commandInstance = new CommandClass();
          return commandInstance;
        }
      }
      
      // Also check for default export
      if (
        commandModule.default &&
        typeof commandModule.default === 'function' &&
        commandModule.default.prototype instanceof BaseCommand
      ) {
        const CommandClass = commandModule.default as new () => BaseCommand;
        const commandInstance = new CommandClass();
        return commandInstance;
      }
      
      logger.warn(`[CommandLoader] No BaseCommand class found in ${filePath}`);
      return null;
    } catch (error) {
      logger.error(`[CommandLoader] Error loading command from ${filePath}:`, error);
      return null;
    }
  }

  static async loadAllCommands(): Promise<BaseCommand[]> {
    const commands: BaseCommand[] = [];
    const commandsPath = join(__dirname, '../commands');
    
    try {
      // Get all TypeScript files in the commands directory
      const commandFiles = readdirSync(commandsPath)
        .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'))
        .filter(file => file !== 'index.ts'); // Skip index file if it exists
      
      // Load each command file
      for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const command = await this.loadCommandFromFile(filePath);
        
        if (command) {
          commands.push(command);
        }
      }
      
      logger.info(`[CommandLoader] Successfully loaded ${commands.length} commands`);
      return commands;
      
    } catch (error) {
      logger.error('[CommandLoader] Error reading commands directory:', error);
      return [];
    }
  }



  /**
   * Validate that a command is properly configured
   */
  static validateCommand(command: BaseCommand): boolean {
    try {
      // Check required properties
      if (!command.data) {
        logger.error(`[CommandLoader] Command missing data property`);
        return false;
      }
      
      if (!command.data.name) {
        logger.error(`[CommandLoader] Command missing name`);
        return false;
      }
      
      if (!command.data.description) {
        logger.error(`[CommandLoader] Command ${command.data.name} missing description`);
        return false;
      }
      
      if (typeof command.execute !== 'function') {
        logger.error(`[CommandLoader] Command ${command.data.name} missing execute method`);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`[CommandLoader] Error validating command:`, error);
      return false;
    }
  }
}
