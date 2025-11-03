import { REST, Routes, ApplicationCommand } from "discord.js";
import { BaseCommand } from "../types/command";
import { ApiClient } from "./api-client";
import { logger, BotClusterConfig } from "@discord-bot/shared-types";

/**
 * Deploy commands to Discord and sync to API database
 */
export async function deployAndSyncCommands(
  commands: BaseCommand[],
  config: BotClusterConfig
): Promise<void> {
  const BOT_TOKEN = process.env.BOT_TOKEN!;
  const API_BASE_URL = process.env.API_BASE_URL || "http://api:3000";

  let APPLICATION_ID = process.env.DISCORD_CLIENT_ID;

  if (!APPLICATION_ID) {
    throw new Error("APPLICATION_ID is required for command deployment");
  }

  // Get command data for Discord API
  const commandData = commands.map((command) => {
    const baseData = command.data.toJSON();
    return {
      ...baseData,
      default_member_permissions: (command.defaultPermissions || 0n).toString(),
      dm_permission: false,
    };
  });

  // Deploy to Discord
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  logger.info(
    `[Cluster ${config.clusterId}] Deploying ${commands.length} commands to Discord...`
  );

  const deployedCommands = (await rest.put(
    Routes.applicationCommands(APPLICATION_ID),
    { body: commandData }
  )) as ApplicationCommand[];

  logger.info(
    `[Cluster ${config.clusterId}] Deployed ${deployedCommands.length} commands to Discord`
  );

  // Sync to API database
  const apiClient = new ApiClient(API_BASE_URL);
  logger.info(`[Cluster ${config.clusterId}] Syncing commands to API...`);

  for (const deployedCmd of deployedCommands) {
    const localCommand = commands.find(
      (cmd) => cmd.data.name === deployedCmd.name
    );

    if (!localCommand) {
      logger.warn(
        `[Cluster ${config.clusterId}] Warning: Deployed command ${deployedCmd.name} not found in local commands`
      );
      continue;
    }

    const filePath =
      (localCommand as any).filePath || `src/commands/${deployedCmd.name}.ts`;

    try {
      await apiClient.registerDefaultCommand({
        discordId: deployedCmd.id.toString(),
        name: localCommand.data.name,
        description: localCommand.data.description,
        cooldown: localCommand.cooldown || 0,
        permissions: (localCommand.defaultPermissions || 0n).toString(),
        enabled: true,
        parentId: null,
        categoryId: null,
        filePath: filePath,
      });

      logger.debug(
        `[Cluster ${config.clusterId}] Synced command ${deployedCmd.name} to API`
      );
    } catch (error) {
      logger.error(
        `[Cluster ${config.clusterId}] Failed to sync command ${deployedCmd.name} to API:`,
        error
      );
    }
  }

  logger.info(
    `[Cluster ${config.clusterId}] Commands synced to API successfully`
  );
}
