import { join } from "path";
import { readdir } from "fs/promises";
import { BaseCommand } from "../types/command";
import logger from "./logger";
import { ApiClient } from "./api-client";

export class CommandLoader {
  /**
   * Load all commands from the commands directory
   */
  static async loadCommandsFromFiles(): Promise<BaseCommand[]> {
    const commands: BaseCommand[] = [];
    const commandsDir = join(__dirname, "..", "commands");

    try {
      logger.debug(`[CommandLoader] Loading commands from ${commandsDir}`);
      const files = await readdir(commandsDir);
      const commandFiles = files.filter(
        (file) => file.endsWith(".ts") || file.endsWith(".js")
      );

      logger.debug(
        `[CommandLoader] Found ${commandFiles.length} command files`
      );

      for (const file of commandFiles) {
        const filePath = join(commandsDir, file);
        const command = await this.loadCommandFromFile(filePath);

        if (command) {
          // Store the relative file path for syncing to API
          // Path will be like "src/commands/ping.ts"
          const relativePath = join("src", "commands", file).replace(/\\/g, "/");
          (command as any).filePath = relativePath;
          
          commands.push(command);
          logger.debug(
            `[CommandLoader] Loaded command ${command.data.name} from ${file} (${relativePath})`
          );
        }
      }

      logger.info(
        `[CommandLoader] Successfully loaded ${commands.length} commands from files`
      );
      return commands;
    } catch (error) {
      logger.error("[CommandLoader] Error loading commands from files:", error);
      return [];
    }
  }

  static async loadCommandFromFile(
    filePath: string
  ): Promise<BaseCommand | null> {
    try {
      // Clear require cache to allow hot reloading
      try {
        const resolvedPath = require.resolve(filePath);
        delete require.cache[resolvedPath];
      } catch (e) {
        // If require.resolve fails, try loading anyway (Bun may handle it differently)
        logger.debug(
          `[CommandLoader] Could not resolve cache key for ${filePath}`
        );
      }

      // Use import() or require depending on the runtime
      // For Bun, we can use require for .ts files
      const commandModule = await import(filePath);

      // Look for exported classes that extend BaseCommand
      for (const [exportName, exportValue] of Object.entries(commandModule)) {
        if (
          typeof exportValue === "function" &&
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
        typeof commandModule.default === "function" &&
        commandModule.default.prototype instanceof BaseCommand
      ) {
        const CommandClass = commandModule.default as new () => BaseCommand;
        const commandInstance = new CommandClass();
        return commandInstance;
      }

      logger.warn(`[CommandLoader] No BaseCommand class found in ${filePath}`);
      return null;
    } catch (error) {
      logger.error(
        `[CommandLoader] Error loading command from ${filePath}:`,
        error
      );
      return null;
    }
  }

  /**
   * Load commands from API based on their file paths
   */
  static async loadCommandsFromAPI(): Promise<BaseCommand[]> {
    const commands: BaseCommand[] = [];
    const apiClient = new ApiClient();

    try {
      logger.debug("[CommandLoader] Fetching commands from API...");
      const response = await apiClient.fetchCommands();

      if (!response.success || !response.data) {
        logger.error(
          "[CommandLoader] Failed to fetch commands from API:",
          response.error
        );
        return [];
      }

      // Load each command based on its file path
      for (const commandData of response.data) {
        if (!commandData.filePath) {
          logger.warn(
            `[CommandLoader] Command ${commandData.name} has no file path, skipping`
          );
          continue;
        }

        // Convert relative path to absolute path
        // __dirname is /app/src/utils in compiled JS, so we need to go up 2 levels to get to /app
        // then use the filePath which already includes 'src/'
        const absolutePath = join(__dirname, "..", "..", commandData.filePath);
        const command = await this.loadCommandFromFile(absolutePath);

        if (command) {
          commands.push(command);
          logger.debug(
            `[CommandLoader] Loaded command ${commandData.name} from ${commandData.filePath}`
          );
        } else {
          logger.warn(
            `[CommandLoader] Failed to load command ${commandData.name} from ${commandData.filePath}`
          );
        }
      }

      logger.debug(
        `[CommandLoader] Successfully loaded ${commands.length} commands from API`
      );
      return commands;
    } catch (error) {
      logger.error("[CommandLoader] Error loading commands from API:", error);
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
        logger.error(
          `[CommandLoader] Command ${command.data.name} missing description`
        );
        return false;
      }

      if (typeof command.execute !== "function") {
        logger.error(
          `[CommandLoader] Command ${command.data.name} missing execute method`
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`[CommandLoader] Error validating command:`, error);
      return false;
    }
  }
}
