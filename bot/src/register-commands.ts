// Load environment variables first
import { config } from "dotenv";
import { resolve, join } from "path";
import { readdirSync } from "fs";
config({ path: resolve(__dirname, "../../.env") });

import { ApiClient } from "./utils/api-client";
import { CommandLoader } from "./utils/command-loader";
import logger from "./utils/logger";

// Script to register existing commands with their file paths
async function registerCommands() {
  const apiClient = new ApiClient("http://localhost:3000");
  const commandsPath = join(__dirname, "commands");

  try {
    // Get all TypeScript files in the commands directory
    const commandFiles = readdirSync(commandsPath)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
      .filter((file) => file !== "index.ts"); // Skip index file if it exists

    const commands = [];

    // Load each command file to get its metadata
    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = await CommandLoader.loadCommandFromFile(filePath);

      if (command) {
        commands.push({
          name: command.name,
          description: command.description,
          cooldown: command.cooldown || 0,
          permissions: "0",
          enabled: true,
          categoryId: null,
          parentId: null,
          filePath: `src/commands/${file}`,
        });
      }
    }

    logger.info(`Starting command registration... Found ${commands.length} commands`);
    logger.debug("Commands to register:", commands);

    for (const command of commands) {
      try {
        console.log(`[RegisterCommands] Sending command:`, JSON.stringify(command, null, 2));
        console.log(`[RegisterCommands] Command object keys:`, Object.keys(command));
        console.log(`[RegisterCommands] Command filePath:`, command.filePath);
        const result = await apiClient.registerDefaultCommand(command);
        if (result.success) {
          logger.info(`Successfully registered command: ${command.name}`);
        } else {
          logger.error(
            `Failed to register command ${command.name}:`,
            result.error
          );
        }
      } catch (error) {
        logger.error(`Error registering command ${command.name}:`, error);
      }
    }

    logger.info("Command registration completed!");
  } catch (error) {
    logger.error("Error during command registration:", error);
  }
}

// Run the registration
registerCommands()
  .then(() => {
    logger.info("Script completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
