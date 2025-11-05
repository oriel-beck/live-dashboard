// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// Extend Client type to include cluster property
declare module "discord.js" {
  interface Client {
    cluster?: {
      id: number;
      shardList: number[];
    };
  }
}

import { Events } from "discord.js";
import { CommandManager } from "./utils/command-manager";
import { startDataSync } from "./utils/sync-data";
import { RabbitMQService, logger } from "@discord-bot/services";
import { loadClusterConfig } from "./utils/cluster-config";
import { createDiscordClient } from "./utils/client-factory";
import { initializeCommands } from "./utils/command-initializer";
import {
  sendClusterStartEvent,
  sendClusterStopEvent,
  initializeRabbitMQ,
} from "./utils/cluster-events";

// Configure REST API proxy (Nirn proxy for rate limiting)
const nirnHost = process.env.NIRN_HOST || "nirn-proxy";
const nirnPort = process.env.NIRN_PORT || "8081";
const restProxyUrl = `http://${nirnHost}:${nirnPort}/api`;

// Load and validate cluster configuration
const config = loadClusterConfig();

// Create Discord client with optimized memory settings
const client = createDiscordClient(config, restProxyUrl);

// Initialize command manager
const commandManager = new CommandManager(client);

// Initialize RabbitMQ service
const rabbitMQ = new RabbitMQService();

// Initialize RabbitMQ connection (must happen before startDataSync)
// We need to wait for connection, but if it fails, bot can still run without SSE events
initializeRabbitMQ(rabbitMQ, config.clusterId)
  .then(() => {
    logger.info(`[Cluster ${config.clusterId}] RabbitMQ initialized successfully`);
  })
  .catch((error) => {
    logger.error(`[Cluster ${config.clusterId}] Failed to initialize RabbitMQ:`, error);
    logger.warn(`[Cluster ${config.clusterId}] Bot will continue but SSE events may not work`);
  });

// Start data sync (RabbitMQ connection is async, but publishing will retry if not ready)
startDataSync(client, rabbitMQ);

// Setup event handlers
client.once(Events.ClientReady, async () => {
  const shardIds = client.cluster?.shardList;
  logger.info(
    `[Cluster ${config.clusterId}] Bot ready as ${
      client.user?.tag
    } (Shards: ${shardIds?.join(", ")})`
  );

  await sendClusterStartEvent(rabbitMQ, config);

  const commandsLoaded = await initializeCommands(
    client,
    commandManager,
    config
  );
  if (!commandsLoaded) {
    logger.error(
      `[Cluster ${config.clusterId}] Failed to load commands, exiting...`
    );
    process.exit(1);
  }

  logger.debug(
    `[Cluster ${config.clusterId}] Command framework initialized successfully!`
  );
});

client.on("error", (error) => {
  logger.error(`[Cluster ${config.clusterId}] Client error:`, error);
});

// Handle process exit - send stop event
const handleShutdown = async () => {
  logger.info(
    `[Cluster ${config.clusterId}] Received shutdown signal, sending stop event...`
  );
  await sendClusterStopEvent(rabbitMQ, config);
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

// Login the client
client.login(process.env.BOT_TOKEN!);
