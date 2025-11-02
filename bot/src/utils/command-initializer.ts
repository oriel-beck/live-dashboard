import { Client } from "discord.js";
import { CommandLoader } from "./command-loader";
import { CommandManager } from "./command-manager";
import { BaseCommand } from "../types/command";
import { deployAndSyncCommands } from "./command-deployment";
import logger from "./logger";
import type { ClusterConfig } from "./cluster-config";

/**
 * Initialize commands: load, validate, deploy (if cluster 0), and register locally
 */
export async function initializeCommands(
  client: Client,
  commandManager: CommandManager,
  config: ClusterConfig
): Promise<boolean> {
  try {
    const shardId = client.cluster?.shardList[0] || 0;
    logger.info(
      `[Cluster ${config.clusterId}, Shard ${shardId}] Loading commands from files...`
    );

    const commands = await CommandLoader.loadCommandsFromFiles();

    if (commands.length === 0) {
      logger.warn(
        `[Cluster ${config.clusterId}, Shard ${shardId}] No commands found in files`
      );
      return false;
    }

    // Validate commands
    const validCommands: BaseCommand[] = [];
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        validCommands.push(command);
      } else {
        logger.error(
          `[Cluster ${config.clusterId}, Shard ${shardId}] Failed to validate command: ${
            command.data?.name || "unknown"
          }`
        );
      }
    }

    logger.info(
      `[Cluster ${config.clusterId}, Shard ${shardId}] Loaded ${validCommands.length} valid commands from files`
    );

    // Only cluster 0 with shard 0 should deploy commands to Discord and sync to API
    if (config.clusterId === 0 && config.shardList.includes(0)) {
      try {
        logger.info(
          `[Cluster ${config.clusterId}] Deploying commands to Discord and syncing to API...`
        );
        await deployAndSyncCommands(validCommands, config);
        logger.info(
          `[Cluster ${config.clusterId}] Commands deployed and synced successfully`
        );
      } catch (error) {
        logger.error(
          `[Cluster ${config.clusterId}] Failed to deploy/sync commands:`,
          error
        );
        // Continue even if deployment fails - we'll still register commands locally
      }
    } else {
      logger.debug(
        `[Cluster ${config.clusterId}] Skipping command deployment (only cluster 0 deploys)`
      );
    }

    // Register commands locally for this bot instance
    for (const command of validCommands) {
      commandManager.registerCommand(command);
    }

    logger.info(
      `[Cluster ${config.clusterId}, Shard ${shardId}] Registered ${
        commandManager.getCommands().size
      } commands locally`
    );
    return true;
  } catch (error) {
    const shardId = client.cluster?.shardList[0] || 0;
    logger.error(
      `[Cluster ${config.clusterId}, Shard ${shardId}] Error loading commands:`,
      error
    );
    return false;
  }
}
