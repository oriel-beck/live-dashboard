import { readdirSync } from 'fs';
import { join } from 'path';
import { BaseCommand } from '../types/command';

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
          
          console.log(`[CommandLoader] Loaded command: ${commandInstance.name} from ${exportName}`);
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
        
        console.log(`[CommandLoader] Loaded command: ${commandInstance.name} from default export`);
        return commandInstance;
      }
      
      console.warn(`[CommandLoader] No BaseCommand class found in ${filePath}`);
      return null;
    } catch (error) {
      console.error(`[CommandLoader] Error loading command from ${filePath}:`, error);
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
      
      console.log(`[CommandLoader] Found ${commandFiles.length} command files:`, commandFiles);
      
      // Load each command file
      for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const command = await this.loadCommandFromFile(filePath);
        
        if (command) {
          commands.push(command);
        }
      }
      
      console.log(`[CommandLoader] Successfully loaded ${commands.length} commands`);
      return commands;
      
    } catch (error) {
      console.error('[CommandLoader] Error reading commands directory:', error);
      return [];
    }
  }

  /**
   * Load commands from subdirectories as well (for organized command structure)
   */
  static async loadAllCommandsRecursive(): Promise<BaseCommand[]> {
    const commands: BaseCommand[] = [];
    
    const loadFromDirectory = async (dirPath: string): Promise<void> => {
      try {
        const items = readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = join(dirPath, item.name);
          
          if (item.isDirectory()) {
            // Recursively load from subdirectories
            await loadFromDirectory(fullPath);
          } else if (
            item.isFile() && 
            item.name.endsWith('.ts') && 
            !item.name.endsWith('.d.ts') &&
            item.name !== 'index.ts'
          ) {
            const command = await this.loadCommandFromFile(fullPath);
            if (command) {
              commands.push(command);
            }
          }
        }
      } catch (error) {
        console.error(`[CommandLoader] Error reading directory ${dirPath}:`, error);
      }
    };
    
    const commandsPath = join(__dirname, '../commands');
    await loadFromDirectory(commandsPath);
    
    console.log(`[CommandLoader] Successfully loaded ${commands.length} commands recursively`);
    return commands;
  }

  /**
   * Validate that a command is properly configured
   */
  static validateCommand(command: BaseCommand): boolean {
    try {
      // Check required properties
      if (!command.data) {
        console.error(`[CommandLoader] Command missing data property`);
        return false;
      }
      
      if (!command.data.name) {
        console.error(`[CommandLoader] Command missing name`);
        return false;
      }
      
      if (!command.data.description) {
        console.error(`[CommandLoader] Command ${command.data.name} missing description`);
        return false;
      }
      
      if (typeof command.execute !== 'function') {
        console.error(`[CommandLoader] Command ${command.data.name} missing execute method`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[CommandLoader] Error validating command:`, error);
      return false;
    }
  }
}
