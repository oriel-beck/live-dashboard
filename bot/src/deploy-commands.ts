#!/usr/bin/env ts-node

/**
 * Command deployment script
 * Run this script when you need to deploy/update global commands to Discord
 * Usage: npm run deploy-commands
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env") });

// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function () {
  return this.toString();
};

import { REST, Routes, ApplicationCommand } from "discord.js";
import { CommandLoader } from "./utils/command-loader";
import { ApiClient } from "./utils/api-client";
import logger from "./utils/logger";
import { BaseCommand } from "./types/command";

async function deployGlobalCommands(
  commands: BaseCommand[]
): Promise<ApplicationCommand[]> {
  const BOT_TOKEN = process.env.BOT_TOKEN!;

  // Extract application ID from bot token
  const APPLICATION_ID = Buffer.from(
    BOT_TOKEN.split(".")[0],
    "base64"
  ).toString();

  // Get command data for Discord API with default permissions
  const commandData = commands.map((command) => {
    const baseData = command.data.toJSON();

    // Set default member permissions based on command requirements
    // If no permissions required, allow all members (0)
    // If permissions required, use the permission bits
    const defaultMemberPermissions = command.defaultPermissions || 0n;

    return {
      ...baseData,
      default_member_permissions: defaultMemberPermissions.toString(),
      dm_permission: false, // Commands only work in servers
    };
  });

  // Deploy commands using REST API
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

  logger.info("[Deploy] Started refreshing application (/) commands.");
  logger.debug(`[Deploy] Using application ID: ${APPLICATION_ID}`);

  const deployedCommands = (await rest.put(
    Routes.applicationCommands(APPLICATION_ID),
    { body: commandData }
  )) as ApplicationCommand[];

  logger.debug(
    `[Deploy] Successfully deployed ${deployedCommands.length} commands globally!`
  );
  logger.debug(
    "[Deploy] Commands now use Discord's application command permissions system."
  );
  logger.debug(
    "[Deploy] Server admins can manage permissions via Discord's interface."
  );

  return deployedCommands;
}

async function registerCommandsInDatabase(
  localCommands: BaseCommand[],
  deployedCommands: ApplicationCommand[]
) {
  const apiClient = new ApiClient("http://localhost:3000");
  for (const deployedCmd of deployedCommands) {
    const localCommand = localCommands.find(
      (cmd) => cmd.name === deployedCmd.name
    );

    if (!localCommand) {
      logger.warn(
        `[Deploy] Warning: Deployed command ${deployedCmd.name} not found in local commands`
      );
      continue;
    }

    // Register main command (upsert - creates or updates)
    const mainCommandResponse = await apiClient.registerDefaultCommand({
      discordId: BigInt(deployedCmd.id),
      name: localCommand.name,
      description: localCommand.description,
      cooldown: localCommand.cooldown,
      permissions: localCommand.defaultPermissions,
      enabled: true,
      parentId: null,
      categoryId: null,
    });

    const mainCommandId = Number(mainCommandResponse.data?.id);
    if (!mainCommandId) {
      logger.error(`[Deploy] Failed to register command: ${deployedCmd.name}`);
      continue;
    }

    logger.debug(
      `[Deploy] Registered command: ${deployedCmd.name} (${deployedCmd.id} -> ${mainCommandId})`
    );

    // Register subcommands and subcommand groups using the database ID
    if (deployedCmd.options) {
      await registerSubcommands(
        apiClient,
        deployedCmd,
        mainCommandId,
        localCommand
      );
    }
  }
}

async function registerSubcommands(
  apiClient: ApiClient,
  deployedCmd: ApplicationCommand,
  parentId: number,
  parentCommand: BaseCommand
) {
  if (!deployedCmd.options) return;

  for (const option of deployedCmd.options) {
    // Handle subcommand groups
    if (option.type === 2) {
      // SUB_COMMAND_GROUP
      // Register subcommand group (upsert - creates or updates)
      const groupResponse = await apiClient.registerDefaultCommand({
        name: option.name,
        description: option.description || "Subcommand group",
        cooldown: parentCommand.cooldown, // Groups don't have cooldowns
        permissions: parentCommand.defaultPermissions || 0n,
        enabled: true,
        parentId: parentId,
        discordId: null,
        categoryId: null,
      });

      const groupId = groupResponse.data!.id;
      logger.debug(
        `[Deploy] Registered subcommand group: ${option.name} (${groupId})`
      );

      // Register subcommands within the group
      if (option.options) {
        for (const subOption of option.options) {
          if (subOption.type === 1) {
            // SUB_COMMAND
            await apiClient.registerDefaultCommand({
              name: subOption.name,
              description: subOption.description || "Subcommand",
              cooldown: parentCommand.cooldown, // Default subcommand cooldown
              permissions: parentCommand.defaultPermissions || 0n,
              enabled: true,
              parentId: groupId,
              discordId: null,
              categoryId: null,
            });
            logger.debug(
              `[Deploy] Registered nested subcommand: ${subOption.name}`
            );
          }
        }
      }
    }
    // Handle direct subcommands
    else if (option.type === 1) {
      // SUB_COMMAND
      await apiClient.registerDefaultCommand({
        name: option.name,
        description: option.description || "Subcommand",
        cooldown: parentCommand.cooldown, // Default subcommand cooldown
        permissions: parentCommand.defaultPermissions || 0n,
        enabled: true,
        parentId: parentId,
        discordId: null,
        categoryId: null,
      });
      logger.debug(`[Deploy] Registered subcommand: ${option.name}`);
    }
  }
}

async function deployCommands() {
  logger.info("[Deploy] Starting command deployment...");

  try {
    // Load and validate commands
    logger.debug("[Deploy] Loading commands...");
    const commands = await CommandLoader.loadAllCommands();

    // Validate commands
    const validCommands = [];
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        validCommands.push(command);
      } else {
        logger.error(
          `[Deploy] Failed to validate command: ${command.name || "unknown"}`
        );
      }
    }

    logger.debug(`[Deploy] Loaded ${validCommands.length} valid commands`);

    // Deploy global commands to Discord
    logger.debug("[Deploy] Deploying global commands...");
    const deployedCommands = await deployGlobalCommands(validCommands);

    // Register commands in database
    logger.debug("[Deploy] Registering commands in database...");
    await registerCommandsInDatabase(validCommands, deployedCommands);

    logger.info("[Deploy] ✅ Commands deployed and registered successfully!");
    logger.debug(
      "[Deploy] Note: It may take up to 1 hour for global commands to appear in all servers"
    );
  } catch (error) {
    logger.error("[Deploy] ❌ Error deploying commands:", error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  deployCommands();
}

export { deployCommands };
