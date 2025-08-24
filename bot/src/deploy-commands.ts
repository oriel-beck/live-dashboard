#!/usr/bin/env ts-node

/**
 * Command deployment script
 * Run this script when you need to deploy/update global commands to Discord
 * Usage: npm run deploy-commands
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });

import { REST, Routes, ApplicationCommand } from "discord.js";
import { CommandLoader } from "./utils/command-loader";
import { ApiClient } from "./utils/api-client";

async function deployGlobalCommands(commands: any[]): Promise<ApplicationCommand[]> {
  const BOT_TOKEN = process.env.BOT_TOKEN!;
  
  // Extract application ID from bot token
  const APPLICATION_ID = Buffer.from(BOT_TOKEN.split('.')[0], 'base64').toString();

  // Get command data for Discord API
  const commandData = commands.map((command) => command.data.toJSON());

  // Deploy commands using REST API
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
 
  console.log('[Deploy] Started refreshing application (/) commands.');
  console.log(`[Deploy] Using application ID: ${APPLICATION_ID}`);
  
  const deployedCommands = (await rest.put(
    Routes.applicationCommands(APPLICATION_ID),
    { body: commandData }
  )) as ApplicationCommand[];

  console.log(
    `[Deploy] Successfully deployed ${deployedCommands.length} commands globally!`
  );
  return deployedCommands;
}

async function registerCommandsInDatabase(
  localCommands: any[],
  deployedCommands: ApplicationCommand[]
) {
  const apiClient = new ApiClient();

  for (const deployedCmd of deployedCommands) {
    const localCommand = localCommands.find(cmd => cmd.name === deployedCmd.name);
 
    if (!localCommand) {
      console.warn(
        `[Deploy] Warning: Deployed command ${deployedCmd.name} not found in local commands`
      );
      continue;
    }

    // Register main command (upsert - creates or updates)
    const mainCommandResponse = await apiClient.registerDefaultCommand({
      discordId: deployedCmd.id,
      name: deployedCmd.name,
      description: deployedCmd.description,
      cooldown: 0, // Default cooldown in seconds
      permissions: (localCommand.requiredPermissions || [])
        .reduce((acc: bigint, perm: any) => acc | BigInt(perm), 0n)
        .toString(),
      enabled: true,
      parentId: null,
    });

    const mainCommandId = mainCommandResponse.command.id;
    console.log(
      `[Deploy] Registered command: ${deployedCmd.name} (${deployedCmd.id} -> ${mainCommandId})`
    );

    // Register subcommands and subcommand groups using the database ID
    if (deployedCmd.options) {
      await registerSubcommands(
        apiClient,
        deployedCmd,
        localCommand,
        mainCommandId
      );
    }
  }
}

async function registerSubcommands(
  apiClient: ApiClient,
  deployedCmd: ApplicationCommand,
  localCommand: any,
  parentId: string
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
        cooldown: 0, // Groups don't have cooldowns
        permissions: "0",
        enabled: true,
        parentId,
      });

      const groupId = groupResponse.command.id;
      console.log(
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
              cooldown: 0, // Default subcommand cooldown
              permissions: "0",
              enabled: true,
              parentId: groupId,
            });
            console.log(
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
        cooldown: 0, // Default subcommand cooldown
        permissions: "0",
        enabled: true,
        parentId,
      });
      console.log(`[Deploy] Registered subcommand: ${option.name}`);
    }
  }
}

async function deployCommands() {
  console.log("[Deploy] Starting command deployment...");

  try {
    // Load and validate commands
    console.log("[Deploy] Loading commands...");
    const commands = await CommandLoader.loadAllCommands();
 
    // Validate commands
    const validCommands = [];
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        validCommands.push(command);
      } else {
        console.error(
          `[Deploy] Failed to validate command: ${command.name || "unknown"}`
        );
      }
    }
 
    console.log(`[Deploy] Loaded ${validCommands.length} valid commands`);

    // Deploy global commands to Discord
    console.log("[Deploy] Deploying global commands...");
    const deployedCommands = await deployGlobalCommands(validCommands);
 
    // Register commands in database
    console.log("[Deploy] Registering commands in database...");
    await registerCommandsInDatabase(validCommands, deployedCommands);
 
    console.log("[Deploy] ✅ Commands deployed and registered successfully!");
    console.log(
      "[Deploy] Note: It may take up to 1 hour for global commands to appear in all servers"
    );
  } catch (error) {
    console.error("[Deploy] ❌ Error deploying commands:", error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  deployCommands().catch(console.error);
}

export { deployCommands };
