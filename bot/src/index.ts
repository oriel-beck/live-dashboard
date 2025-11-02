// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// Configure REST API proxy (Nirn proxy for rate limiting)
const nirnHost = process.env.NIRN_HOST || "nirn-proxy";
const nirnPort = process.env.NIRN_PORT || "8081";
const restProxyUrl = `http://${nirnHost}:${nirnPort}/api`;

import { Client, Events, GatewayIntentBits, Options } from "discord.js";

// Redis import removed - no longer needed for metrics
import { CommandLoader } from "./utils/command-loader";
import { CommandManager } from "./utils/command-manager";
import { BaseCommand } from "./types/command";
import { REST, Routes, ApplicationCommand } from "discord.js";
import { ApiClient } from "./utils/api-client";
import logger from "./utils/logger";
import { register, updateShardMetrics } from "./utils/metrics";
import { startDataSync } from "./utils/sync-data.js";
import { RabbitMQService } from "./services/rabbitmq";
import { QUEUE_NAMES } from "./types/rabbitmq";
import { CLUSTER_EVENTS, ClusterStartEventData, ClusterStopEventData } from "@discord-bot/shared-types";

// Get cluster configuration from environment variables
// This bot instance MUST run as part of a cluster - it requires CLUSTER_ID, SHARD_LIST, and TOTAL_SHARDS
const clusterId = parseInt(process.env.CLUSTER_ID || "0");
const shardListEnv = process.env.SHARD_LIST;
const totalShards = parseInt(process.env.TOTAL_SHARDS || "0");

// Validate required environment variables for cluster mode
if (!shardListEnv || shardListEnv === "[]" || totalShards === 0) {
  logger.error(
    "[Bot] Invalid cluster configuration. This bot instance must run as part of a cluster."
  );
  logger.error(
    "[Bot] Required environment variables: CLUSTER_ID, SHARD_LIST (non-empty array), TOTAL_SHARDS"
  );
  process.exit(1);
}

const shardList = JSON.parse(shardListEnv);

if (!Array.isArray(shardList) || shardList.length === 0) {
  logger.error(
    "[Bot] SHARD_LIST must be a non-empty array of shard IDs"
  );
  process.exit(1);
}

logger.info(
  `[Cluster ${clusterId}] Starting cluster with shards ${shardList.join(
    ", "
  )} (${shardList.length}/${totalShards})`
);

const clientId = process.env.CLIENT_ID!;

// Limit collections so process RAM stays low. We rely on Redis as the real cache.
const client = new Client({
  shards: shardList,
  shardCount: totalShards,
  intents: [GatewayIntentBits.Guilds],
  rest: {
    api: restProxyUrl,
  },
  // Remove partials for memory optimization
  makeCache: Options.cacheWithLimits({
    // Essential managers - only keep the bot user/member
    UserManager: {
      maxSize: 0,
      keepOverLimit: (user) => user.id === clientId,
    }, // Keep minimal users
    GuildMemberManager: {
      maxSize: 0,
      keepOverLimit: (member) => member.id === clientId,
    }, // Keep minimal members

    ApplicationCommandManager: 0,
    ApplicationEmojiManager: 0,
    AutoModerationRuleManager: 0,
    BaseGuildEmojiManager: 0,
    DMMessageManager: 0,
    EntitlementManager: 0,
    GuildBanManager: 0,
    GuildEmojiManager: 0,
    GuildForumThreadManager: 0,
    GuildInviteManager: 0,
    GuildMessageManager: 0,
    GuildScheduledEventManager: 0,
    GuildStickerManager: 0,
    GuildTextThreadManager: 0,
    MessageManager: 0,
    PresenceManager: 0,
    ReactionManager: 0,
    ReactionUserManager: 0,
    StageInstanceManager: 0,
    ThreadManager: 0,
    ThreadMemberManager: 0,
    VoiceStateManager: 0,
  }),
});

// Add cluster information to client for compatibility
client.cluster = {
  id: clusterId,
  shardList: shardList,
} as any;

// Initialize command manager
const commandManager = new CommandManager(client);

// Export command manager for API access
export { commandManager };

// Redis client removed - no longer needed for metrics

// RabbitMQ service for metrics communication
const rabbitMQ = new RabbitMQService();

// Health monitoring is done via:
// 1. Docker container status (cluster manager checks if container is running)
// 2. RabbitMQ events (cluster sends start/stop events via sendClusterStartEvent/sendClusterStopEvent)
// No HTTP health check server needed
let isReady = false;

// Deploy commands to Discord and sync to API
async function deployAndSyncCommands(commands: BaseCommand[]): Promise<void> {
  const BOT_TOKEN = process.env.BOT_TOKEN!;
  const API_BASE_URL = process.env.API_BASE_URL || "http://api:3000";
  
  // Extract application ID from bot token
  const APPLICATION_ID = Buffer.from(
    BOT_TOKEN.split(".")[0],
    "base64"
  ).toString();

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
  logger.info(`[Cluster ${clusterId}] Deploying ${commands.length} commands to Discord...`);
  
  const deployedCommands = (await rest.put(
    Routes.applicationCommands(APPLICATION_ID),
    { body: commandData }
  )) as ApplicationCommand[];

  logger.info(`[Cluster ${clusterId}] Deployed ${deployedCommands.length} commands to Discord`);

  // Sync to API database
  const apiClient = new ApiClient(API_BASE_URL);
  logger.info(`[Cluster ${clusterId}] Syncing commands to API...`);

  for (const deployedCmd of deployedCommands) {
    const localCommand = commands.find(
      (cmd) => cmd.data.name === deployedCmd.name
    );

    if (!localCommand) {
      logger.warn(
        `[Cluster ${clusterId}] Warning: Deployed command ${deployedCmd.name} not found in local commands`
      );
      continue;
    }

    // Get file path from the command (set during loading)
    const filePath = (localCommand as any).filePath || `src/commands/${deployedCmd.name}.ts`;
    
    // Register main command in API (upsert)
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
      
      logger.debug(`[Cluster ${clusterId}] Synced command ${deployedCmd.name} to API`);
    } catch (error) {
      logger.error(
        `[Cluster ${clusterId}] Failed to sync command ${deployedCmd.name} to API:`,
        error
      );
    }
  }

  logger.info(`[Cluster ${clusterId}] Commands synced to API successfully`);
}

// Load commands from files, deploy to Discord, sync to API, and register locally
async function initializeCommands() {
  try {
    const shardId = client.cluster?.shardList[0] || 0;
    logger.info(
      `[Cluster ${clusterId}, Shard ${shardId}] Loading commands from files...`
    );

    // Load commands from local files
    const commands = await CommandLoader.loadCommandsFromFiles();
    
    if (commands.length === 0) {
      logger.warn(
        `[Cluster ${clusterId}, Shard ${shardId}] No commands found in files`
      );
      return;
    }

    // Validate commands
    const validCommands: BaseCommand[] = [];
    for (const command of commands) {
      if (CommandLoader.validateCommand(command)) {
        validCommands.push(command);
      } else {
        logger.error(
          `[Cluster ${clusterId}, Shard ${shardId}] Failed to validate command: ${
            command.data?.name || "unknown"
          }`
        );
      }
    }

    logger.info(
      `[Cluster ${clusterId}, Shard ${shardId}] Loaded ${validCommands.length} valid commands from files`
    );

    // Only the first cluster (cluster 0) should deploy commands to Discord and sync to API
    // This prevents multiple clusters from deploying the same commands
    if (clusterId === 0 && shardList.includes(0)) {
      try {
        logger.info(
          `[Cluster ${clusterId}] Deploying commands to Discord and syncing to API...`
        );
        await deployAndSyncCommands(validCommands);
        logger.info(
          `[Cluster ${clusterId}] Commands deployed and synced successfully`
        );
      } catch (error) {
        logger.error(
          `[Cluster ${clusterId}] Failed to deploy/sync commands:`,
          error
        );
        // Continue even if deployment fails - we'll still register commands locally
      }
    } else {
      logger.debug(
        `[Cluster ${clusterId}] Skipping command deployment (only cluster 0 deploys)`
      );
    }

    // Register commands locally for this bot instance
    for (const command of validCommands) {
      commandManager.registerCommand(command);
    }

    logger.info(
      `[Cluster ${clusterId}, Shard ${shardId}] Registered ${
        commandManager.getCommands().size
      } commands locally`
    );
    return true;
  } catch (error) {
    const shardId = client.cluster?.shardList[0] || 0;
    logger.error(
      `[Cluster ${clusterId}, Shard ${shardId}] Error loading commands:`,
      error
    );
    return false;
  }
}

// Send metrics to cluster manager via RabbitMQ
async function sendMetricsToManager() {
  try {
    const metrics = await register.metrics();

    // Send metrics as a task to RabbitMQ
    await rabbitMQ.publishTask(QUEUE_NAMES.METRICS_CLUSTER, {
      id: `metrics-${clusterId}-${Date.now()}`,
      type: "cluster_metrics",
      data: {
        clusterId: clusterId,
        shardList: shardList,
        metrics: metrics,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    });

    logger.debug(
      `[Cluster ${clusterId}] Successfully sent metrics to manager via RabbitMQ`
    );
  } catch (error) {
    logger.warn(
      `[Cluster ${clusterId}] Failed to send metrics to manager via RabbitMQ:`,
      error
    );
  }
}

// Send cluster start event to manager
async function sendClusterStartEvent() {
  try {
    const eventData: ClusterStartEventData = {
      clusterId: clusterId,
      shardList: shardList,
      timestamp: new Date().toISOString(),
    };

    await rabbitMQ.publishTask(QUEUE_NAMES.CLUSTER_START, {
      id: `start-${clusterId}-${Date.now()}`,
      type: CLUSTER_EVENTS.START,
      data: eventData,
      timestamp: new Date(),
    });

    logger.info(
      `[Cluster ${clusterId}] Sent cluster start event to manager via RabbitMQ`
    );
  } catch (error) {
    logger.warn(
      `[Cluster ${clusterId}] Failed to send cluster start event:`,
      error
    );
  }
}

// Send cluster stop event to manager
async function sendClusterStopEvent() {
  try {
    const eventData: ClusterStopEventData = {
      clusterId: clusterId,
      shardList: shardList,
      timestamp: new Date().toISOString(),
      reason: 'process_termination',
    };

    await rabbitMQ.publishTask(QUEUE_NAMES.CLUSTER_STOP, {
      id: `stop-${clusterId}-${Date.now()}`,
      type: CLUSTER_EVENTS.STOP,
      data: eventData,
      timestamp: new Date(),
    });

    logger.info(
      `[Cluster ${clusterId}] Sent cluster stop event to manager via RabbitMQ`
    );
  } catch (error) {
    logger.warn(
      `[Cluster ${clusterId}] Failed to send cluster stop event:`,
      error
    );
  }
}

// Setup metrics reporting to cluster manager
function setupMetricsReporting() {
  // Add small delay based on cluster ID to prevent timestamp conflicts
  const delay = clusterId * 500; // 500ms delay per cluster for manager reports
  setTimeout(() => {
    setInterval(sendMetricsToManager, 10000);
    logger.info(
      `[Cluster ${clusterId}] Metrics reporting to manager enabled (delayed ${delay}ms)`
    );
  }, delay);
}

// Initialize RabbitMQ connection
async function initializeRabbitMQ() {
  try {
    await rabbitMQ.connect();
    await rabbitMQ.initializeDefaults();
    logger.info(`[Cluster ${clusterId}] RabbitMQ connection established`);
  } catch (error) {
    logger.warn(`[Cluster ${clusterId}] Failed to connect to RabbitMQ:`, error);
    // Continue without RabbitMQ - metrics will just fail silently
  }
}

// Start data sync and command system
startDataSync(client);

// Initialize RabbitMQ
initializeRabbitMQ();

// Setup command system when bot is ready
client.once(Events.ClientReady, async () => {
  const shardIds = client.cluster?.shardList;
  logger.info(
    `[Cluster ${clusterId}] Bot ready as ${
      client.user?.tag
    } (Shards: ${shardIds?.join(", ")})`
  );

  // Send cluster start event - bot is now ready
  await sendClusterStartEvent();

  // Update shard metrics
  updateShardMetrics(client);

  // Update shard metrics periodically (every 5 minutes)
  setInterval(() => {
    updateShardMetrics(client);
  }, 5 * 60 * 1000);

  // Load and register commands
  const commandsLoaded = await initializeCommands();
  if (!commandsLoaded) {
    logger.error(`[Cluster ${clusterId}] Failed to load commands, exiting...`);
    process.exit(1);
  }

  // Mark as ready for health checks
  isReady = true;

  logger.debug(
    `[Cluster ${clusterId}] Command framework initialized successfully!`
  );
  logger.debug(
    `[Cluster ${clusterId}] Note: Global commands need to be deployed manually via Discord Developer Portal or a deployment script`
  );
});

// Handle client errors
client.on("error", (error) => {
  logger.error(`[Cluster ${clusterId}] Client error:`, error);
});

// Handle process exit - send stop event
process.on('SIGINT', async () => {
  logger.info(`[Cluster ${clusterId}] Received SIGINT, sending stop event...`);
  await sendClusterStopEvent();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info(`[Cluster ${clusterId}] Received SIGTERM, sending stop event...`);
  await sendClusterStopEvent();
  process.exit(0);
});

// Start metrics reporting
setupMetricsReporting();

// Login the client
client.login(process.env.BOT_TOKEN!);
